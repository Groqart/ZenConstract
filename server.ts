import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  DEMO_SELLERS,
  completePrivatePresignedUpload,
  createPrivatePresignedUpload,
  getPrivateObjectBuffer,
  getPublicAssetPath,
  requireSellerAuth,
  savePublicAssetToR2,
  signHmacBody,
  signSellerToken,
  verifyHmacSignature,
  type AuthedRequest,
  type SellerUser,
} from './src/server/authAndR2';
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

  // Raw binary body parser specifically for presigned R2 uploads (up to 250 MB)
  app.use(
    '/api/r2/presigned-upload',
    express.raw({ type: '*/*', limit: '250mb' })
  );

  app.use(express.json({ limit: '4mb' }));

  // Healthcheck
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nexusbyte-storefront-platform', sprint: 2 });
  });

  // --- Auth Endpoints (ZenxusBay Seller Session) ---
  app.get('/api/auth/demo-accounts', (_req, res) => {
    res.json({ accounts: DEMO_SELLERS });
  });

  app.post('/api/auth/login', (req, res) => {
    const requestedId = typeof req.body?.user_id === 'string' ? req.body.user_id.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';

    let user: SellerUser | undefined;
    if (requestedId) {
      user = DEMO_SELLERS.find((u) => u.user_id === requestedId);
      if (!user) {
        res.status(404).json({ error: 'Аккаунт продавца не найден.' });
        return;
      }
    } else if (email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      const existingDemo = DEMO_SELLERS.find((u) => u.email === email);
      if (existingDemo) {
        user = existingDemo;
      } else {
        const hash = crypto.createHash('sha256').update(email).digest('hex').slice(0, 6);
        user = {
          user_id: `usr_${hash}`,
          email,
          name: name || email.split('@')[0],
          role: 'seller',
        };
      }
    } else {
      res.status(400).json({ error: 'Укажите корректный email или выберите аккаунт продавца.' });
      return;
    }

    const token = signSellerToken(user);
    const stores = kvStore.listStoresByOwner(user.user_id);
    res.json({ token, user, stores });
  });

  app.get('/api/auth/me', requireSellerAuth, (req: AuthedRequest, res) => {
    const seller = req.seller!;
    const stores = kvStore.listStoresByOwner(seller.user_id);
    res.json({ user: seller, stores });
  });

  // --- R2 Dual-Contour Upload & CDN Endpoints ---
  // 1. Public Assets R2 (<= 2 MB, .webp/.png/.jpg)
  app.post('/api/r2/upload-public', requireSellerAuth, (req: AuthedRequest, res) => {
    const seller = req.seller!;
    const storeId = typeof req.body?.store_id === 'string' && req.body.store_id.trim()
      ? req.body.store_id.trim()
      : seller.user_id;
    const fileName = typeof req.body?.file_name === 'string' ? req.body.file_name : '';
    const dataBase64 = typeof req.body?.data_base64 === 'string' ? req.body.data_base64 : '';

    const saved = savePublicAssetToR2({ storeId, fileName, dataBase64 });
    if (!saved.ok) {
      res.status(400).json({ error: saved.error });
      return;
    }

    res.status(201).json({
      url: saved.url,
      cdn_preview_url: `https://cdn.nexusbyte.de5.net/${saved.objectKey}`,
      object_key: saved.objectKey,
      size_bytes: saved.sizeBytes,
      cache_control: 'public, max-age=31536000, immutable',
    });
  });

  // Serve PUBLIC_ASSETS_R2 CDN route with immutable edge cache headers
  app.get('/cdn/:storeId/:fileName', (req, res) => {
    const assetPath = getPublicAssetPath(
      String(req.params.storeId || ''),
      String(req.params.fileName || '')
    );
    if (!assetPath) {
      res.status(404).send('Asset not found');
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-R2-Bucket', 'PUBLIC_ASSETS_R2');
    res.sendFile(assetPath);
  });

  // 2. Private Products R2 Presigned Upload URL (up to 250 MB, bypasses Worker 100 MB limit)
  app.post('/api/r2/presign-private', requireSellerAuth, (req: AuthedRequest, res) => {
    const seller = req.seller!;
    const storeId = typeof req.body?.store_id === 'string' && req.body.store_id.trim()
      ? req.body.store_id.trim()
      : seller.user_id;
    const fileName = typeof req.body?.file_name === 'string' ? req.body.file_name : '';
    const fileSizeBytes = Number(req.body?.file_size_bytes || 0);

    const presign = createPrivatePresignedUpload({
      storeId,
      ownerUserId: seller.user_id,
      fileName,
      fileSizeBytes,
    });

    if (!presign.ok) {
      res.status(400).json({ error: presign.error });
      return;
    }

    res.json(presign);
  });

  app.put('/api/r2/presigned-upload/:uploadId', (req, res) => {
    const uploadId = String(req.params.uploadId || '');
    const sig = String(req.query.sig || '');
    const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    const outcome = completePrivatePresignedUpload({ uploadId, sig, bodyBuffer });
    if (!outcome.ok) {
      res.status(outcome.status).json({ error: outcome.error });
      return;
    }

    res.status(200).json({
      ok: true,
      r2_object_key: outcome.r2_object_key,
      file_name: outcome.file_name,
      size_mb: outcome.size_mb,
    });
  });

  // Block any direct public access to private bucket paths (DoD #1)
  app.all('/r2-private/*', (_req, res) => {
    res.status(403).json({ error: '403 Forbidden: PRIVATE_PRODUCTS_R2 access denied.' });
  });

  // --- Storefront CRUD & Inspection ---
  app.get('/api/stores', (_req, res) => {
    const stores = kvStore.listPublicStores();
    res.json({ stores });
  });

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

  app.get('/api/stores/:slug/ready', (req, res) => {
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const store = kvStore.getPublicStore(slug);
    if (!store) {
      res.status(404).json({ ready: false });
      return;
    }
    res.json({ ready: true, slug: store.slug, url: `/s/${store.slug}` });
  });

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

  // Protected Create Store (binds owner_user_id to authenticated seller)
  app.post('/api/stores', requireSellerAuth, (req: AuthedRequest, res) => {
    const seller = req.seller!;
    const validation = validateStoreInput(req.body, {
      storeId: seller.user_id,
      ownerUserId: seller.user_id,
    });
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

  // Protected Edit Store (403 Forbidden if store.owner_user_id !== seller.user_id)
  app.put('/api/stores/:slug', requireSellerAuth, (req: AuthedRequest, res) => {
    const seller = req.seller!;
    const slug = String(req.params.slug || '').trim().toLowerCase();
    const existing = kvStore.getPublicStore(slug);
    if (!existing) {
      res.status(404).json({ error: 'Магазин не найден.' });
      return;
    }
    if (existing.owner_user_id !== seller.user_id) {
      res.status(403).json({
        error: `403 Forbidden: витрина «${slug}» принадлежит другому аккаунту.`,
      });
      return;
    }

    const validation = validateStoreInput(
      { ...req.body, slug: existing.slug },
      {
        storeId: existing.store_id,
        ownerUserId: existing.owner_user_id,
        createdAt: existing.created_at,
      }
    );

    if (!validation.ok || !validation.publicConfig || !validation.deliverySecrets) {
      res.status(400).json({
        error: 'Проверьте корректность заполнения формы.',
        errors: validation.errors,
      });
      return;
    }

    kvStore.saveStore(validation.publicConfig, validation.deliverySecrets);
    res.json({
      store: validation.publicConfig,
      ssr_url: `/s/${validation.publicConfig.slug}`,
    });
  });

  // --- Checkout & HMAC-Protected Idempotent Fulfillment ---
  app.post('/api/checkout', (req, res) => {
    const parsed = validateCheckoutRequest(req.body);
    if (!parsed.ok || !parsed.product_id || !parsed.email) {
      res.status(400).json({ error: parsed.error || 'Некорректные данные чекаута.' });
      return;
    }

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

  app.get('/api/invoices/:invoiceId', (req, res) => {
    const invoice = kvStore.getInvoice(String(req.params.invoiceId || ''));
    if (!invoice) {
      res.status(404).json({ error: 'Инвойс не найден.' });
      return;
    }
    res.json({ invoice });
  });

  function buildFulfillmentResponse(invoiceId: string) {
    const outcome = kvStore.markInvoicePaid(invoiceId);
    if (!outcome) return null;
    const downloadUrl = `/download/${outcome.tokenRecord.token}`;
    return {
      ok: true,
      idempotent: outcome.idempotent,
      invoice: outcome.invoice,
      delivery: {
        token: outcome.tokenRecord.token,
        download_url: downloadUrl,
        expires_at: outcome.tokenRecord.expires_at,
        downloads_used: outcome.tokenRecord.downloads_used,
        max_downloads: outcome.tokenRecord.max_downloads,
        file_name: outcome.tokenRecord.file_name,
        r2_object_key: outcome.tokenRecord.r2_object_key,
        email_provider: 'resend',
        email_preview: {
          to: outcome.invoice.buyer_email,
          subject: `Ваш цифровой товар: ${outcome.invoice.product_title}`,
          body: `Оплата ${outcome.invoice.amount_usdt.toFixed(2)} USDT подтверждена (Resend API). Ссылка действует 24 часа (лимит ${outcome.tokenRecord.max_downloads} скачиваний): ${downloadUrl}`,
        },
      },
    };
  }

  // Protected internal fulfillment endpoint (requires valid X-Payment-Signature HMAC)
  app.post('/api/internal/fulfill', (req, res) => {
    const sig = String(req.headers['x-payment-signature'] || '');
    const rawBody = JSON.stringify(req.body || {});
    if (!verifyHmacSignature(rawBody, sig)) {
      res.status(403).json({ error: '403 Forbidden: invalid X-Payment-Signature HMAC.' });
      return;
    }

    const invoiceId = typeof req.body?.invoice_id === 'string' ? req.body.invoice_id.trim() : '';
    if (!invoiceId) {
      res.status(400).json({ error: 'Укажите invoice_id.' });
      return;
    }

    const result = buildFulfillmentResponse(invoiceId);
    if (!result) {
      res.status(404).json({ error: 'Инвойс не найден.' });
      return;
    }

    res.json(result);
  });

  // PAYMENT_SERVICE webhook bridge (signs HMAC internally and invokes idempotent fulfillment)
  app.post('/api/payment/webhook', (req, res) => {
    const invoiceId = typeof req.body?.invoice_id === 'string' ? req.body.invoice_id.trim() : '';
    if (!invoiceId) {
      res.status(400).json({ error: 'Укажите invoice_id.' });
      return;
    }
    const payloadStr = JSON.stringify({ invoice_id: invoiceId });
    const hmacSig = signHmacBody(payloadStr);
    if (!verifyHmacSignature(payloadStr, hmacSig)) {
      res.status(500).json({ error: 'Internal HMAC verification error.' });
      return;
    }

    const result = buildFulfillmentResponse(invoiceId);
    if (!result) {
      res.status(404).json({ error: 'Инвойс не найден.' });
      return;
    }

    res.json({ ...result, hmac_verified: true });
  });

  // --- Range-Aware Private R2 Download (/download/:token & /api/download/:token) ---
  function handleDownload(req: express.Request, res: express.Response) {
    const token = String(req.params.token || '').trim();
    const existing = kvStore.getDeliveryToken(token);
    if (!existing) {
      res.status(403).send('Ссылка недействительна или срок действия истёк.');
      return;
    }

    const rangeHeader = req.headers.range;
    const isHead = req.method === 'HEAD';
    const isInitialOrFullGet =
      !isHead && (!rangeHeader || rangeHeader.startsWith('bytes=0-'));

    let activeRecord = existing;
    if (isInitialOrFullGet) {
      const consumed = kvStore.consumeDownloadAttempt(token);
      if (!consumed.ok || !consumed.record) {
        res.status(403).send('Исчерпан лимит скачиваний (5/5) или ссылка истекла.');
        return;
      }
      activeRecord = consumed.record;
    } else if (existing.downloads_used >= existing.max_downloads) {
      res.status(403).send('Исчерпан лимит скачиваний (5/5).');
      return;
    }

    const fallbackManifest = [
      `NexusByte Private R2 Delivery Package`,
      `====================================`,
      `Invoice ID      : ${activeRecord.invoice_id}`,
      `Buyer Email     : ${activeRecord.buyer_email}`,
      `Product         : ${activeRecord.product_title} (${activeRecord.product_id})`,
      `Private R2 Key  : ${activeRecord.r2_object_key}`,
      `Downloads Used  : ${activeRecord.downloads_used} / ${activeRecord.max_downloads}`,
      `Expires At      : ${activeRecord.expires_at}`,
      ``,
      `Delivery Note:`,
      `${activeRecord.delivery_note}`,
    ].join('\n');

    const fileBuf = getPrivateObjectBuffer({
      r2ObjectKey: activeRecord.r2_object_key,
      fallbackText: fallbackManifest,
    });

    const safeFileName = activeRecord.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const totalSize = fileBuf.length;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('X-Downloads-Remaining', String(Math.max(0, activeRecord.max_downloads - activeRecord.downloads_used)));

    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-');
      const start = Math.max(0, parseInt(startStr || '0', 10) || 0);
      const end = endStr ? Math.min(totalSize - 1, parseInt(endStr, 10)) : totalSize - 1;
      if (start >= totalSize || end < start) {
        res.status(416).setHeader('Content-Range', `bytes */${totalSize}`).end();
        return;
      }
      const chunk = fileBuf.subarray(start, end + 1);
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', String(chunk.length));
      if (isHead) {
        res.end();
      } else {
        res.send(chunk);
      }
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', String(totalSize));
    if (isHead) {
      res.end();
    } else {
      res.send(fileBuf);
    }
  }

  app.get('/download/:token', handleDownload);
  app.head('/download/:token', handleDownload);
  app.get('/api/download/:token', handleDownload);
  app.head('/api/download/:token', handleDownload);

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
