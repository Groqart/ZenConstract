export const WORKER_WRANGLER_TOML = `name = "storefront-worker"
main = "src/index.ts"
compatibility_date = "2026-11-01"

routes = [
  { pattern = "*.nexusbyte.de5.net/*", zone_name = "de5.net" }
]

[[kv_namespaces]]
binding = "STORE_KV"
id = "<YOUR_PUBLIC_KV_NAMESPACE_ID>"

[[kv_namespaces]]
binding = "DELIVERY_KV"
id = "<YOUR_PRIVATE_DELIVERY_KV_ID>"

[[r2_buckets]]
binding = "PRODUCTS_R2"
bucket_name = "nexusbyte-digital-products"

[[services]]
binding = "PAYMENT_SERVICE"
service = "payment-worker"
`;

export const WORKER_INDEX_TS = `import {
  extractSlugFromHost,
  validateCheckoutRequest,
  validateSlug,
  type StoreConfig,
  type DeliverySecret,
} from './storeSchema';
import { renderStorefrontHtml, renderStoreNotFoundHtml } from './ssrRenderer';

export interface Env {
  STORE_KV: KVNamespace;
  DELIVERY_KV: KVNamespace;
  PRODUCTS_R2: R2Bucket;
  PAYMENT_SERVICE: Fetcher; // Cloudflare Service Binding
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostResult = extractSlugFromHost(request.headers.get('Host') || '');

    if (hostResult.type === 'www_redirect') {
      return Response.redirect('https://nexusbyte.de5.net' + url.pathname, 301);
    }

    if (hostResult.type !== 'store' || !hostResult.slug) {
      return new Response('NexusByte Root Domain', { status: 200 });
    }

    const slugCheck = validateSlug(hostResult.slug);
    if (!slugCheck.valid) {
      return new Response(renderStoreNotFoundHtml(hostResult.slug, 'https://nexusbyte.de5.net/create'), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Read public config from KV without cacheTtl if missing (prevents 404 edge caching)
    const rawStore = await env.STORE_KV.get('store:' + slugCheck.normalized);
    if (!rawStore) {
      return new Response(renderStoreNotFoundHtml(slugCheck.normalized, 'https://nexusbyte.de5.net/create'), {
        status: 404,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    const store: StoreConfig = JSON.parse(rawStore);

    // Checkout endpoint: client sends ONLY product_id and email. Price comes strictly from KV.
    if (request.method === 'POST' && url.pathname === '/api/checkout') {
      const body = await request.json().catch(() => null);
      const parsed = validateCheckoutRequest(body);
      if (!parsed.ok || !parsed.product_id || !parsed.email) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }

      const product = store.products.find((p) => p.id === parsed.product_id && p.is_active);
      if (!product) {
        return Response.json({ error: 'Товар не найден или снят с публикации.' }, { status: 404 });
      }

      // Fetch private R2 delivery key only on backend
      const deliveryRaw = await env.DELIVERY_KV.get(\`delivery:\${store.store_id}:\${product.id}\`);
      const delivery: DeliverySecret | null = deliveryRaw ? JSON.parse(deliveryRaw) : null;

      // Internal Service Binding call to PAYMENT_SERVICE (no public API key exposure)
      const paymentRes = await env.PAYMENT_SERVICE.fetch('https://payment.internal/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: store.store_id,
          slug: store.slug,
          product_id: product.id,
          product_title: product.title,
          amount_usdt: product.price_usdt, // Authoritative server price
          buyer_email: parsed.email,
          r2_object_key: delivery?.r2_object_key || null,
        }),
      });

      if (!paymentRes.ok) {
        return Response.json({ error: 'Ошибка платежного шлюза.' }, { status: 502 });
      }

      const invoice = await paymentRes.json<{ invoice_url: string }>();
      return Response.json({ invoice_url: invoice.invoice_url });
    }

    // Edge SSR HTML response (< 300ms TTFB)
    const html = renderStorefrontHtml(store, {
      checkoutEndpoint: '/api/checkout',
      homeUrl: 'https://nexusbyte.de5.net/',
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  },
};
`;
