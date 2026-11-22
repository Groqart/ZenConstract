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

[[d1_databases]]
binding = "DB"
database_name = "nexusbyte-platform"
database_id = "<YOUR_D1_DATABASE_ID>"

[[r2_buckets]]
binding = "PUBLIC_ASSETS_R2"
bucket_name = "nexusbyte-public-assets" # Custom domain: cdn.nexusbyte.de5.net

[[r2_buckets]]
binding = "PRIVATE_PRODUCTS_R2"
bucket_name = "nexusbyte-private-products" # Public access disabled

[[services]]
binding = "PAYMENT_SERVICE"
service = "payment-worker"

# Configure via \`wrangler secret put\`:
# - PAYMENT_HMAC_SECRET
# - RESEND_API_KEY
# - R2_S3_ACCESS_KEY_ID / R2_S3_SECRET_ACCESS_KEY / CF_ACCOUNT_ID
`;

export const WORKER_INDEX_TS = `import { AwsClient } from 'aws4fetch';
import {
  extractSlugFromHost,
  validateCheckoutRequest,
  validateSlug,
  type StoreConfig,
  type DeliverySecret,
  type DeliveryTokenRecord,
} from './storeSchema';
import { renderStorefrontHtml, renderStoreNotFoundHtml } from './ssrRenderer';

export interface Env {
  STORE_KV: KVNamespace;
  DELIVERY_KV: KVNamespace;
  DB: D1Database;
  PUBLIC_ASSETS_R2: R2Bucket;
  PRIVATE_PRODUCTS_R2: R2Bucket;
  PAYMENT_SERVICE: Fetcher;
  PAYMENT_HMAC_SECRET: string;
  RESEND_API_KEY: string;
  R2_S3_ACCESS_KEY_ID: string;
  R2_S3_SECRET_ACCESS_KEY: string;
  CF_ACCOUNT_ID: string;
}

async function verifyHmac(secret: string, bodyText: string, signatureHex: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyText));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return expected === signatureHex.toLowerCase();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const hostResult = extractSlugFromHost(request.headers.get('Host') || '');

    if (hostResult.type === 'www_redirect') {
      return Response.redirect('https://nexusbyte.de5.net' + url.pathname, 301);
    }

    // 1. Public asset upload (<= 2 MB) -> PUBLIC_ASSETS_R2 + Custom Domain CDN
    if (request.method === 'POST' && url.pathname === '/api/r2/upload-public') {
      const form = await request.formData();
      const file = form.get('file') as File | null;
      const storeId = String(form.get('store_id') || '');
      if (!file || file.size > 2 * 1024 * 1024) {
        return Response.json({ error: 'Файл превышает 2 МБ' }, { status: 400 });
      }
      const key = \`\${storeId}/\${crypto.randomUUID()}.webp\`;
      await env.PUBLIC_ASSETS_R2.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type || 'image/webp',
          cacheControl: 'public, max-age=31536000, immutable',
        },
      });
      return Response.json({ url: \`https://cdn.nexusbyte.de5.net/\${key}\` });
    }

    // 2. Presigned Upload URL for large private archives (up to 250 MB, bypasses 100 MB Worker limit)
    if (request.method === 'POST' && url.pathname === '/api/r2/presign-private') {
      const { store_id, file_name } = await request.json<{ store_id: string; file_name: string }>();
      const objectKey = \`\${store_id}/\${crypto.randomUUID()}-\${file_name}\`;
      const r2Client = new AwsClient({
        accessKeyId: env.R2_S3_ACCESS_KEY_ID,
        secretAccessKey: env.R2_S3_SECRET_ACCESS_KEY,
      });
      const presignUrl = \`https://\${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/nexusbyte-private-products/\${objectKey}?X-Amz-Expires=900\`;
      const signed = await r2Client.sign(new Request(presignUrl, { method: 'PUT' }), {
        aws: { signQuery: true },
      });
      return Response.json({ upload_url: signed.url, r2_object_key: objectKey });
    }

    // 3. HMAC-protected & Idempotent fulfillment endpoint called by PAYMENT_SERVICE
    if (request.method === 'POST' && url.pathname === '/internal/fulfill') {
      const bodyText = await request.text();
      const sig = request.headers.get('X-Payment-Signature') || '';
      if (!(await verifyHmac(env.PAYMENT_HMAC_SECRET, bodyText, sig))) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const payload = JSON.parse(bodyText) as {
        invoice_id: string;
        store_id: string;
        product_id: string;
        product_title: string;
        buyer_email: string;
      };

      // Idempotency guard by invoice_id in D1
      const existing = await env.DB.prepare(
        'SELECT token FROM delivery_tokens WHERE invoice_id = ? LIMIT 1'
      ).bind(payload.invoice_id).first<{ token: string }>();

      if (existing) {
        return Response.json({ ok: true, idempotent: true, token: existing.token });
      }

      const secretRaw = await env.DELIVERY_KV.get(\`delivery:\${payload.store_id}:\${payload.product_id}\`);
      const secret: DeliverySecret | null = secretRaw ? JSON.parse(secretRaw) : null;
      if (!secret) {
        return Response.json({ error: 'Delivery object not found' }, { status: 404 });
      }

      const token = crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await env.DB.prepare(
        'INSERT INTO delivery_tokens (token, invoice_id, r2_object_key, file_name, downloads_used, max_downloads, expires_at) VALUES (?, ?, ?, ?, 0, 5, ?)'
      ).bind(token, payload.invoice_id, secret.r2_object_key, secret.file_name, expiresAt).run();

      // Send email via Resend REST API (MailChannels sunset in 2024)
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: \`Bearer \${env.RESEND_API_KEY}\`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'NexusByte Delivery <noreply@nexusbyte.de5.net>',
          to: [payload.buyer_email],
          subject: \`Ваш цифровой товар: \${payload.product_title}\`,
          html: \`<p>Оплата подтверждена. Ссылка действует 24 часа (до 5 скачиваний): <a href="https://nexusbyte.de5.net/download/\${token}">Скачать архив</a></p>\`,
        }),
      });

      return Response.json({ ok: true, token });
    }

    // 4. Range-aware private R2 download (supports 206 Partial Content & HEAD without burning attempts)
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/download/')) {
      const token = url.pathname.slice('/download/'.length);
      const record = await env.DB.prepare(
        'SELECT * FROM delivery_tokens WHERE token = ?'
      ).bind(token).first<DeliveryTokenRecord>();

      if (!record || Date.parse(record.expires_at) < Date.now() || record.downloads_used >= record.max_downloads) {
        return new Response('Ссылка недействительна или исчерпан лимит скачиваний.', { status: 403 });
      }

      const rangeHeader = request.headers.get('Range');
      const isInitialOrFullGet =
        request.method === 'GET' && (!rangeHeader || rangeHeader.startsWith('bytes=0-'));

      if (isInitialOrFullGet) {
        const updated = await env.DB.prepare(
          'UPDATE delivery_tokens SET downloads_used = downloads_used + 1 WHERE token = ? AND downloads_used < max_downloads'
        ).bind(token).run();
        if (updated.meta.changes === 0) {
          return new Response('Лимит скачиваний исчерпан.', { status: 403 });
        }
      }

      const obj = await env.PRIVATE_PRODUCTS_R2.get(record.r2_object_key, {
        range: request.headers,
      });
      if (!obj) {
        return new Response('Файл не найден в R2.', { status: 404 });
      }

      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set('Accept-Ranges', 'bytes');
      headers.set('Cache-Control', 'private, no-store');
      headers.set('Content-Disposition', \`attachment; filename="\${record.file_name}"\`);
      if (obj.range) {
        const offset = 'offset' in obj.range ? obj.range.offset : 0;
        const length = 'length' in obj.range ? obj.range.length : obj.size;
        headers.set('Content-Range', \`bytes \${offset}-\${offset + length - 1}/\${obj.size}\`);
      }

      return new Response(request.method === 'HEAD' ? null : obj.body, {
        status: rangeHeader && obj.range ? 206 : 200,
        headers,
      });
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

    const rawStore = await env.STORE_KV.get('store:' + slugCheck.normalized);
    if (!rawStore) {
      return new Response(renderStoreNotFoundHtml(slugCheck.normalized, 'https://nexusbyte.de5.net/create'), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    const store: StoreConfig = JSON.parse(rawStore);

    if (request.method === 'POST' && url.pathname === '/api/checkout') {
      const body = await request.json().catch(() => null);
      const parsed = validateCheckoutRequest(body);
      if (!parsed.ok || !parsed.product_id || !parsed.email) {
        return Response.json({ error: parsed.error }, { status: 400 });
      }
      const product = store.products.find((p) => p.id === parsed.product_id && p.is_active);
      if (!product) {
        return Response.json({ error: 'Товар не найден.' }, { status: 404 });
      }

      const paymentRes = await env.PAYMENT_SERVICE.fetch('https://payment.internal/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: store.store_id,
          slug: store.slug,
          product_id: product.id,
          product_title: product.title,
          amount_usdt: product.price_usdt,
          buyer_email: parsed.email,
        }),
      });
      if (!paymentRes.ok) {
        return Response.json({ error: 'Ошибка платежного шлюза.' }, { status: 502 });
      }
      const invoice = await paymentRes.json<{ invoice_url: string }>();
      return Response.json({ invoice_url: invoice.invoice_url });
    }

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
