import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { kvStore } from './src/server/kvStore';
import {
  extractSlugFromHost,
  validateCheckoutRequest,
  validateSlug,
  validateStoreInput,
} from './src/worker/storeSchema';
import {
  renderInvoicePageHtml,
  renderStoreNotFoundHtml,
  renderStorefrontHtml,
} from './src/worker/ssrRenderer';
import { WORKER_INDEX_TS, WORKER_WRANGLER_TOML } from './src/worker/workerExport';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nexusbyte-storefront-platform' });
  });

  // List public stores (strictly public store:{slug} JSON)
  app.get('/api/stores', (_req, res) => {
    const stores = kvStore.listPublicStores();
    res.json({ stores });
  });

  // Check subdomain slug format, reserved list, and availability
  app.get('/api/stores/check-slug', (req, res) => {
    const rawSlug = String(req.query.slug || '');
    const validation = validateSlug(rawSlug);
    if (!validation.valid) {
      res.json({
        available: false,
        normalized: validation.normalized,
        reason: validation.reason,
        message: validation.message,
      });
      return;
    }
    const exists = kvStore.hasStoreSlug(validation.normalized);
    if (exists) {
      res.json({
        available: false,
        normalized: validation.normalized,
        reason: 'taken',
        message: `Поддомен «${validation.normalized}.nexusbyte.de5.net» уже занят.`,
      });
      return;
    }
    res.json({
      available: true,
      normalized: validation.normalized,
      message: `Поддомен «${validation.normalized}.nexusbyte.de5.net» свободен.`,
    });
  });

  // KV propagation readiness probe
  app.get('/api/stores/:slug/ready', (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const store = kvStore.getPublicStore(slug);
    if (!store) {
      res.status(404).json({ ready: false });
      return;
    }
    res.json({ ready: true, slug: store.slug, url: `/s/${store.slug}` });
  });

  // Inspector endpoint returning public KV, isolated private delivery secrets, and SSR metrics
  app.get('/api/stores/:slug/inspect', (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const store = kvStore.getPublicStore(slug);
    if (!store) {
      res.status(404).json({ error: 'Магазин не найден.' });
      return;
    }
    const startNs = process.hrtime.bigint();
    const html = renderStorefrontHtml(store);
    const renderMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
    const deliveries = kvStore.getDeliveriesForStore(store.store_id);

    res.json({
      public_kv_key: `store:${store.slug}`,
      public_kv_value: store,
      private_deliveries: deliveries,
      ssr_metrics: {
        html_bytes: Buffer.byteLength(html, 'utf-8'),
        render_ms: Math.round(renderMs * 100) / 100,
        client_js_framework: 'None (Zero-React Edge SSR)',
      },
      ssr_html_preview: html,
    });
  });

  // 1-Click Publish Store
  app.post('/api/stores', (req, res) => {
    const validation = validateStoreInput(req.body);
    if (!validation.ok || !validation.publicConfig || !validation.deliverySecrets) {
      res.status(400).json({
        error: 'Проверьте корректность заполнения формы.',
        errors: validation.errors,
      });
      return;
    }

    if (kvStore.hasStoreSlug(validation.publicConfig.slug)) {
      res.status(409).json({
        error: `Поддомен «${validation.publicConfig.slug}» уже занят.`,
        errors: { slug: `Поддомен «${validation.publicConfig.slug}» уже занят.` },
      });
      return;
    }

    kvStore.saveStore(validation.publicConfig, validation.deliverySecrets);
    res.status(201).json({
      store: validation.publicConfig,
      ssr_url: `/s/${validation.publicConfig.slug}`,
      subdomain_url: `https://${validation.publicConfig.slug}.nexusbyte.de5.net`,
    });
  });

  // Checkout endpoint: Server-side authoritative price lookup + PAYMENT_SERVICE simulation
  app.post('/api/checkout', (req, res) => {
    const parsed = validateCheckoutRequest(req.body);
    if (!parsed.ok || !parsed.product_id || !parsed.email) {
      res.status(400).json({ error: parsed.error || 'Некорректные данные чекаута.' });
      return;
    }

    // Resolve slug from Host header first (Cloudflare Worker pattern) or explicit slug in Studio preview
    const hostInfo = extractSlugFromHost(req.headers.host || '');
    const targetSlug = hostInfo.type === 'store' && hostInfo.slug ? hostInfo.slug : parsed.slug;

    if (!targetSlug) {
      res.status(400).json({ error: 'Не удалось определить магазин для оплаты.' });
      return;
    }

    const store = kvStore.getPublicStore(targetSlug);
    if (!store) {
      res.status(404).json({ error: 'Магазин не найден.' });
      return;
    }

    const product = store.products.find((p) => p.id === parsed.product_id && p.is_active);
    if (!product) {
      res.status(404).json({ error: 'Товар не найден или снят с продажи.' });
      return;
    }

    // Security rule: ignore any client-supplied price; read price_usdt strictly from KV
    const invoice = kvStore.createInvoice({
      store,
      productId: product.id,
      productTitle: product.title,
      amountUsdt: product.price_usdt,
      buyerEmail: parsed.email,
    });

    res.status(201).json({
      invoice,
      invoice_url: `/pay/${invoice.invoice_id}`,
    });
  });

  // Get invoice status
  app.get('/api/invoices/:invoiceId', (req, res) => {
    const invoice = kvStore.getInvoice(String(req.params.invoiceId || ''));
    if (!invoice) {
      res.status(404).json({ error: 'Инвойс не найден.' });
      return;
    }
    res.json({ invoice });
  });

  // PAYMENT_SERVICE webhook simulator -> generates 24h signed R2 delivery token & email payload
  app.post('/api/payment/webhook', (req, res) => {
    const invoiceId = typeof req.body?.invoice_id === 'string' ? req.body.invoice_id.trim() : '';
    if (!invoiceId) {
      res.status(400).json({ error: 'Укажите invoice_id.' });
      return;
    }

    const outcome = kvStore.markInvoicePaid(invoiceId);
    if (!outcome) {
      res.status(404).json({ error: 'Инвойс не найден.' });
      return;
    }

    const downloadUrl = `/api/download/${outcome.tokenRecord.token}`;
    res.json({
      ok: true,
      invoice: outcome.invoice,
      delivery: {
        token: outcome.tokenRecord.token,
        download_url: downloadUrl,
        expires_at: outcome.tokenRecord.expires_at,
        file_name: outcome.tokenRecord.file_name,
        r2_object_key: outcome.tokenRecord.r2_object_key,
        email_preview: {
          to: outcome.invoice.buyer_email,
          subject: `Ваш цифровой товар: ${outcome.invoice.product_title}`,
          body: `Оплата ${outcome.invoice.amount_usdt.toFixed(2)} USDT подтверждена. Ссылка на скачивание действует 24 часа: ${downloadUrl}`,
        },
      },
    });
  });

  // Signed R2 delivery download endpoint
  app.get('/api/download/:token', (req, res) => {
    const token = String(req.params.token || '').trim();
    const record = kvStore.getDeliveryToken(token);
    if (!record) {
      res.status(404).send('Ссылка для скачивания недействительна или истекла.');
      return;
    }

    const safeFileName = record.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const manifestContent = [
      `NexusByte R2 Presigned Delivery Bundle`,
      `======================================`,
      `Order Invoice : ${record.invoice_id}`,
      `Buyer Email   : ${record.buyer_email}`,
      `Product       : ${record.product_title} (${record.product_id})`,
      `Private R2 Key: ${record.r2_object_key}`,
      `Expires At    : ${record.expires_at}`,
      ``,
      `Seller Delivery Note:`,
      `${record.delivery_note}`,
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}.manifest.txt"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(manifestContent);
  });

  // Export Cloudflare Worker bundle code
  app.get('/api/worker-bundle', (_req, res) => {
    res.json({
      wrangler_toml: WORKER_WRANGLER_TOML,
      index_ts: WORKER_INDEX_TS,
    });
  });

  // Standalone Edge SSR Storefront Route (/s/:slug)
  app.get('/s/:slug', (req, res) => {
    const startNs = process.hrtime.bigint();
    const rawSlug = String(req.params.slug || '').trim().toLowerCase();
    const slugCheck = validateSlug(rawSlug);
    if (!slugCheck.valid) {
      res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderStoreNotFoundHtml(rawSlug, '/'));
      return;
    }

    const store = kvStore.getPublicStore(slugCheck.normalized);
    if (!store) {
      res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.send(renderStoreNotFoundHtml(slugCheck.normalized, '/'));
      return;
    }

    const html = renderStorefrontHtml(store, {
      checkoutEndpoint: '/api/checkout',
      homeUrl: '/',
    });
    const renderMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;

    res.status(200);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Server-Timing', `edge-ssr;dur=${renderMs.toFixed(2)}`);
    res.setHeader('X-Rendered-By', 'storefront-worker-ssr');
    res.send(html);
  });

  // Standalone Crypto Invoice Route (/pay/:invoiceId)
  app.get('/pay/:invoiceId', (req, res) => {
    const invoice = kvStore.getInvoice(String(req.params.invoiceId || ''));
    if (!invoice) {
      res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderStoreNotFoundHtml('invoice', '/'));
      return;
    }
    const store = kvStore.getPublicStore(invoice.slug);
    if (!store) {
      res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(renderStoreNotFoundHtml(invoice.slug, '/'));
      return;
    }
    res.status(200).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderInvoicePageHtml(invoice, store));
  });

  // Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NexusByte Storefront server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
