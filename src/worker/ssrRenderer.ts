import {
  ACCENT_PRESETS,
  CheckoutInvoice,
  StoreConfig,
  StoreProduct,
  StoreSection,
  formatProductCountLabel,
  normalizeStoreSections,
  sanitizeSafeCtaUrl,
  sanitizeSafeUrl,
} from './storeSchema';

export function escapeHtml(input: unknown): string {
  const str = String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderOptions {
  checkoutEndpoint?: string;
  homeUrl?: string;
}

export function renderStorefrontHtml(store: StoreConfig, options: RenderOptions = {}): string {
  const isDark = store.meta.theme !== 'light';
  const accent = ACCENT_PRESETS[store.meta.accent_preset] || ACCENT_PRESETS.indigo;
  const checkoutEndpoint = options.checkoutEndpoint || '/api/checkout';
  const homeUrl = options.homeUrl || '/';

  const bgMain = isDark ? '#0b0f19' : '#f8fafc';
  const bgSurface = isDark ? '#131a29' : '#ffffff';
  const bgMuted = isDark ? '#1a2336' : '#f1f5f9';
  const borderCol = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#475569';
  const softBg = isDark ? accent.softBgDark : accent.softBgLight;
  const softText = isDark ? accent.softTextDark : accent.softTextLight;

  const safeAvatar = sanitizeSafeUrl(store.profile.avatar_url) || '';
  const tgHandle = store.profile.telegram.replace(/^@+/, '');
  const tgUrl = `https://t.me/${encodeURIComponent(tgHandle)}`;

  const activeProducts = store.products.filter((p) => p.is_active);

  const productsMarkup = activeProducts
    .map((product, index) => {
      const safeCover = sanitizeSafeUrl(product.cover_url) || '';
      const lazyAttr = index >= 2 ? ' loading="lazy"' : ' fetchpriority="high"';
      const formattedPrice = product.price_usdt.toFixed(2);
      return `
        <article class="card" id="${escapeHtml(product.id)}">
          <div class="card-media">
            ${
              safeCover
                ? `<img src="${escapeHtml(safeCover)}" alt="${escapeHtml(product.title)}" width="640" height="480" decoding="async"${lazyAttr} referrerpolicy="no-referrer" />`
                : `<div class="media-fallback" aria-hidden="true">${escapeHtml(product.title.slice(0, 2).toUpperCase())}</div>`
            }
          </div>
          <div class="card-body">
            <div class="card-meta">${escapeHtml(product.category)}</div>
            <h2 class="card-title">${escapeHtml(product.title)}</h2>
            <p class="card-desc">${escapeHtml(product.short_desc)}</p>
            <div class="card-footer">
              <div class="price-wrap">
                <span class="price-val">${escapeHtml(formattedPrice)}</span>
                <span class="price-unit">USDT</span>
              </div>
              <button
                type="button"
                class="buy-btn"
                data-buy-btn
                data-product-id="${escapeHtml(product.id)}"
                data-product-title="${escapeHtml(product.title)}"
                data-product-price="${escapeHtml(formattedPrice)}"
              >
                Купить
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  function resolveHeroCtaHref(rawTarget: string | undefined): string {
    const trimmed = String(rawTarget ?? '').trim();
    if (trimmed && activeProducts.some((p) => p.id === trimmed)) {
      return `#${trimmed}`;
    }
    const safeUrl = sanitizeSafeCtaUrl(trimmed);
    if (safeUrl.startsWith('#') && safeUrl !== '#catalog-heading') {
      const targetProdId = safeUrl.slice(1);
      if (!activeProducts.some((p) => p.id === targetProdId)) {
        return '#catalog-heading';
      }
    }
    return safeUrl;
  }

  function renderHeroBanner(sec: StoreSection): string {
    const hb = sec.hero_banner;
    const headline = String(hb?.headline ?? '').trim();
    if (!headline) return '';
    const subheadline = String(hb?.subheadline ?? '').trim();
    const ctaLabel = String(hb?.cta_label ?? '').trim() || 'Смотреть каталог';
    const href = resolveHeroCtaHref(hb?.cta_target);
    const externalAttrs = href.startsWith('https://')
      ? ' target="_blank" rel="noopener noreferrer"'
      : '';
    return `<section class="hero-banner" aria-label="${escapeHtml(headline)}">
      <div class="hero-content">
        <h2 class="hero-title">${escapeHtml(headline)}</h2>
        ${subheadline ? `<p class="hero-sub">${escapeHtml(subheadline)}</p>` : ''}
      </div>
      <a class="hero-cta" href="${escapeHtml(href)}"${externalAttrs}>${escapeHtml(ctaLabel)}</a>
    </section>`;
  }

  function renderTrustBadges(sec: StoreSection): string {
    const rawItems = Array.isArray(sec.trust_badges?.items) ? sec.trust_badges.items : [];
    const items = rawItems
      .filter((it) => String(it?.title ?? '').trim() || String(it?.description ?? '').trim())
      .slice(0, 3);
    if (items.length === 0) return '';

    const cards = items
      .map(
        (item) => `<div class="trust-card">
          <div class="trust-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <div>
            ${item.title.trim() ? `<h3 class="trust-title">${escapeHtml(item.title)}</h3>` : ''}
            ${item.description.trim() ? `<p class="trust-desc">${escapeHtml(item.description)}</p>` : ''}
          </div>
        </div>`
      )
      .join('');

    return `<section class="trust-section" aria-label="Преимущества и гарантии">
      <div class="trust-grid">${cards}</div>
    </section>`;
  }

  function renderFaqSection(sec: StoreSection): string {
    const rawItems = Array.isArray(sec.faq?.items) ? sec.faq.items : [];
    const items = rawItems
      .filter((it) => String(it?.question ?? '').trim() && String(it?.answer ?? '').trim())
      .slice(0, 6);
    if (items.length === 0) return '';

    const sectionTitle = String(sec.faq?.title ?? 'Частые вопросы').trim() || 'Частые вопросы';
    const itemsHtml = items
      .map(
        (item) => `<details class="faq-item">
          <summary class="faq-summary">
            <span class="faq-q">${escapeHtml(item.question)}</span>
            <svg class="faq-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </summary>
          <div class="faq-answer">${escapeHtml(item.answer)}</div>
        </details>`
      )
      .join('');

    return `<section class="faq-section" aria-label="${escapeHtml(sectionTitle)}">
      <h2 class="section-title" style="margin-bottom:16px;">${escapeHtml(sectionTitle)}</h2>
      <div class="faq-list">${itemsHtml}</div>
    </section>`;
  }

  const sections = normalizeStoreSections(store.sections);
  const headerHtml = `<header class="store-header">
      <div class="profile-wrap">
        <div class="profile-top">
          ${
            safeAvatar
              ? `<img class="avatar" src="${escapeHtml(safeAvatar)}" alt="${escapeHtml(store.profile.name)}" width="68" height="68" referrerpolicy="no-referrer" />`
              : `<div class="avatar" aria-hidden="true"></div>`
          }
          <div>
            <h1 class="store-title">${escapeHtml(store.meta.title)}</h1>
            <p class="seller-line">${escapeHtml(store.profile.name)} · ${escapeHtml(store.slug)}.nexusbyte.de5.net</p>
          </div>
        </div>
        <p class="seller-bio">${escapeHtml(store.profile.bio)}</p>
      </div>
      <a class="contact-btn" href="${escapeHtml(tgUrl)}" target="_blank" rel="noopener noreferrer">Связаться в Telegram</a>
    </header>`;

  const catalogHtml = `<section aria-labelledby="catalog-heading">
      <div class="section-head">
        <h2 id="catalog-heading" class="section-title">Цифровые товары</h2>
        <span class="section-count">${escapeHtml(formatProductCountLabel(activeProducts.length))}</span>
      </div>
      <div class="grid">
        ${productsMarkup}
      </div>
    </section>`;

  const footerHtml = `<footer class="site-footer">
      <span>${escapeHtml(store.meta.description)}</span>
      <a href="${escapeHtml(homeUrl)}">Открыть конструктор NexusByte</a>
    </footer>`;

  const bodySectionsHtml = sections
    .filter((sec) => sec.visible)
    .map((sec) => {
      if (sec.type === 'header') return headerHtml;
      if (sec.type === 'hero_banner') return renderHeroBanner(sec);
      if (sec.type === 'trust_badges') return renderTrustBadges(sec);
      if (sec.type === 'product_grid') return catalogHtml;
      if (sec.type === 'faq') return renderFaqSection(sec);
      if (sec.type === 'footer') return footerHtml;
      return '';
    })
    .filter(Boolean)
    .join('\n    ');

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(store.meta.title)}</title>
  <meta name="description" content="${escapeHtml(store.meta.description)}" />
  <style>
    :root {
      --bg: ${bgMain};
      --surface: ${bgSurface};
      --muted: ${bgMuted};
      --border: ${borderCol};
      --text: ${textPrimary};
      --text-2: ${textSecondary};
      --accent: ${accent.hex};
      --accent-hover: ${accent.hoverHex};
      --on-accent: ${accent.textOnAccent};
      --soft-bg: ${softBg};
      --soft-text: ${softText};
    }
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; -webkit-font-smoothing: antialiased; }
    img { display: block; max-width: 100%; }
    button, input { font: inherit; }
    .container { max-width: 1120px; margin: 0 auto; padding: 24px 16px 64px; }
    @media (min-width: 768px) { .container { padding: 40px 32px 80px; } }
    .store-header { display: flex; flex-direction: column; gap: 18px; padding: 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; margin-bottom: 28px; }
    @media (min-width: 768px) { .store-header { flex-direction: row; align-items: center; justify-content: space-between; padding: 28px 32px; margin-bottom: 32px; } }
    .profile-wrap { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
    .profile-top { display: flex; align-items: center; gap: 14px; min-width: 0; }
    @media (min-width: 520px) { .profile-top { gap: 18px; } }
    .avatar { width: 56px; height: 56px; border-radius: 12px; object-fit: cover; border: 1px solid var(--border); flex-shrink: 0; background: var(--muted); }
    @media (min-width: 520px) { .avatar { width: 68px; height: 68px; } }
    .store-title { margin: 0 0 4px; font-size: clamp(1.2rem, 2.5vw, 1.75rem); font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; text-wrap: balance; }
    .seller-line { font-size: 0.8125rem; color: var(--text-2); margin: 0; overflow-wrap: anywhere; }
    .seller-bio { font-size: 0.9375rem; color: var(--text-2); margin: 0; max-width: 64ch; line-height: 1.5; }
    .contact-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; padding: 10px 18px; border-radius: 10px; background: var(--muted); color: var(--text); border: 1px solid var(--border); text-decoration: none; font-size: 0.875rem; font-weight: 600; white-space: nowrap; flex-shrink: 0; transition: opacity 150ms ease; }
    .contact-btn:hover { opacity: 0.85; }
    .hero-banner { display: flex; flex-direction: column; gap: 18px; padding: 24px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); margin-bottom: 28px; }
    @media (min-width: 768px) { .hero-banner { flex-direction: row; align-items: center; justify-content: space-between; padding: 30px 32px; margin-bottom: 32px; } }
    .hero-content { max-width: 64ch; min-width: 0; }
    .hero-title { margin: 0 0 8px; font-size: clamp(1.25rem, 2.4vw, 1.625rem); font-weight: 700; letter-spacing: -0.02em; line-height: 1.25; text-wrap: balance; }
    .hero-sub { margin: 0; font-size: 0.9375rem; color: var(--text-2); line-height: 1.5; }
    .hero-cta { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 11px 22px; border-radius: 10px; background: var(--accent); color: var(--on-accent); text-decoration: none; font-size: 0.9375rem; font-weight: 600; white-space: nowrap; flex-shrink: 0; transition: background-color 150ms ease; }
    .hero-cta:hover { background: var(--accent-hover); }
    .trust-section { margin-bottom: 28px; }
    @media (min-width: 768px) { .trust-section { margin-bottom: 32px; } }
    .trust-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
    @media (min-width: 720px) { .trust-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; } }
    .trust-card { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border); }
    .trust-icon { width: 34px; height: 34px; border-radius: 8px; background: var(--soft-bg); color: var(--soft-text); display: grid; place-items: center; flex-shrink: 0; }
    .trust-title { margin: 0 0 4px; font-size: 0.9375rem; font-weight: 600; line-height: 1.3; }
    .trust-desc { margin: 0; font-size: 0.8125rem; color: var(--text-2); line-height: 1.45; }
    .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .section-title { margin: 0; font-size: 1.125rem; font-weight: 600; }
    .section-count { font-size: 0.875rem; color: var(--text-2); font-variant-numeric: tabular-nums; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 32px; }
    @media (min-width: 680px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (min-width: 1024px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; } }
    .card { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; transition: transform 160ms cubic-bezier(0.16,1,0.3,1); }
    .card:hover { transform: translateY(-2px); }
    .card-media { aspect-ratio: 4 / 3; background: var(--muted); overflow: hidden; border-bottom: 1px solid var(--border); }
    .card-media img { width: 100%; height: 100%; object-fit: cover; }
    .media-fallback { width: 100%; height: 100%; display: grid; place-items: center; font-weight: 700; font-size: 1.5rem; color: var(--text-2); }
    .card-body { display: flex; flex-direction: column; flex: 1; padding: 18px 20px 20px; }
    .card-meta { font-size: 0.75rem; font-weight: 600; color: var(--soft-text); margin-bottom: 6px; letter-spacing: 0.02em; }
    .card-title { margin: 0 0 8px; font-size: 1.0625rem; font-weight: 600; line-height: 1.3; }
    .card-desc { margin: 0 0 18px; font-size: 0.875rem; color: var(--text-2); line-height: 1.5; flex: 1; }
    .card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 14px; border-top: 1px solid var(--border); }
    .price-wrap { display: flex; align-items: baseline; gap: 5px; font-variant-numeric: tabular-nums; }
    .price-val { font-size: 1.125rem; font-weight: 700; }
    .price-unit { font-size: 0.75rem; font-weight: 600; color: var(--text-2); }
    .buy-btn { min-height: 44px; min-width: 104px; padding: 10px 18px; border: 0; border-radius: 10px; background: var(--accent); color: var(--on-accent); font-size: 0.9375rem; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background-color 150ms ease; }
    .buy-btn:hover { background: var(--accent-hover); }
    .buy-btn:focus-visible, .contact-btn:focus-visible, .hero-cta:focus-visible, .faq-summary:focus-visible, .modal-close:focus-visible, .submit-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .faq-section { margin-bottom: 32px; }
    .faq-list { display: flex; flex-direction: column; gap: 10px; }
    .faq-item { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
    .faq-summary { list-style: none; min-height: 44px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: 0.9375rem; font-weight: 600; cursor: pointer; }
    .faq-summary::-webkit-details-marker { display: none; }
    .faq-chevron { flex-shrink: 0; color: var(--text-2); transition: transform 180ms ease; }
    details[open] .faq-chevron { transform: rotate(180deg); }
    .faq-answer { padding: 0 18px 16px; font-size: 0.875rem; color: var(--text-2); line-height: 1.55; border-top: 1px solid var(--border); padding-top: 12px; }
    dialog.checkout-modal { width: min(440px, calc(100vw - 32px)); border: 1px solid var(--border); border-radius: 16px; background: var(--surface); color: var(--text); padding: 24px; box-shadow: 0 24px 64px rgba(0,0,0,0.36); }
    dialog.checkout-modal::backdrop { background: rgba(2, 6, 23, 0.72); backdrop-filter: blur(4px); }
    .modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
    .modal-title { margin: 0; font-size: 1.125rem; font-weight: 700; }
    .modal-close { min-width: 44px; min-height: 44px; border: 1px solid var(--border); border-radius: 10px; background: var(--muted); color: var(--text); cursor: pointer; font-weight: 600; }
    .summary-box { padding: 14px 16px; border-radius: 10px; background: var(--muted); border: 1px solid var(--border); margin-bottom: 18px; }
    .summary-name { font-weight: 600; font-size: 0.9375rem; margin-bottom: 4px; }
    .summary-price { font-size: 0.875rem; color: var(--text-2); font-variant-numeric: tabular-nums; }
    .field-label { display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 6px; }
    .field-input { width: 100%; min-height: 44px; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border); background: var(--bg); color: var(--text); margin-bottom: 8px; }
    .field-hint { font-size: 0.8125rem; color: var(--text-2); margin: 0 0 18px; }
    .error-msg { display: none; padding: 10px 12px; border-radius: 8px; background: rgba(220,38,38,0.12); color: #ef4444; font-size: 0.875rem; margin-bottom: 14px; }
    .error-msg.visible { display: block; }
    .submit-btn { width: 100%; min-height: 46px; border: 0; border-radius: 10px; background: var(--accent); color: var(--on-accent); font-size: 0.9375rem; font-weight: 600; cursor: pointer; }
    .submit-btn:disabled { opacity: 0.6; cursor: wait; }
    .site-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border); display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; font-size: 0.8125rem; color: var(--text-2); }
    .site-footer a { color: var(--text-2); text-decoration: none; }
    .site-footer a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <main class="container">
    ${bodySectionsHtml}
  </main>

  <dialog id="checkoutDialog" class="checkout-modal" aria-labelledby="checkoutTitle">
    <div class="modal-head">
      <h2 id="checkoutTitle" class="modal-title">Быстрый чекаут</h2>
      <button type="button" id="closeDialogBtn" class="modal-close" aria-label="Закрыть окно оплаты">Закрыть</button>
    </div>
    <div class="summary-box">
      <div id="modalProductName" class="summary-name"></div>
      <div id="modalProductPrice" class="summary-price"></div>
    </div>
    <form id="checkoutForm">
      <input type="hidden" id="modalProductId" name="product_id" value="" />
      <label for="buyerEmail" class="field-label">Email для получения товара</label>
      <input id="buyerEmail" name="email" type="email" required placeholder="buyer@example.com" class="field-input" autocomplete="email" />
      <p class="field-hint">После подтверждения оплаты USDT ссылка на скачивание архива придёт на этот адрес.</p>
      <div id="checkoutError" class="error-msg" role="alert"></div>
      <button type="submit" id="submitCheckoutBtn" class="submit-btn">Перейти к оплате</button>
    </form>
  </dialog>

  <script>
    (function () {
      var slug = ${JSON.stringify(store.slug)};
      var endpoint = ${JSON.stringify(checkoutEndpoint)};
      var dialog = document.getElementById('checkoutDialog');
      var form = document.getElementById('checkoutForm');
      var closeBtn = document.getElementById('closeDialogBtn');
      var pidInput = document.getElementById('modalProductId');
      var pNameEl = document.getElementById('modalProductName');
      var pPriceEl = document.getElementById('modalProductPrice');
      var emailInput = document.getElementById('buyerEmail');
      var errorEl = document.getElementById('checkoutError');
      var submitBtn = document.getElementById('submitCheckoutBtn');

      document.querySelectorAll('[data-buy-btn]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          pidInput.value = btn.getAttribute('data-product-id') || '';
          pNameEl.textContent = btn.getAttribute('data-product-title') || '';
          pPriceEl.textContent = (btn.getAttribute('data-product-price') || '0.00') + ' USDT (TRC-20)';
          errorEl.classList.remove('visible');
          errorEl.textContent = '';
          if (typeof dialog.showModal === 'function') {
            dialog.showModal();
          } else {
            dialog.setAttribute('open', 'open');
          }
          emailInput.focus();
        });
      });

      closeBtn.addEventListener('click', function () {
        if (typeof dialog.close === 'function') {
          dialog.close();
        } else {
          dialog.removeAttribute('open');
        }
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        errorEl.classList.remove('visible');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Создание инвойса...';

        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            slug: slug,
            product_id: pidInput.value,
            email: emailInput.value.trim()
          })
        })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (result) {
          if (!result.ok) {
            throw new Error(result.data && result.data.error ? result.data.error : 'Ошибка создания платежа.');
          }
          window.location.href = result.data.invoice_url;
        })
        .catch(function (err) {
          errorEl.textContent = err.message || 'Не удалось создать инвойс.';
          errorEl.classList.add('visible');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Перейти к оплате';
        });
      });
    })();
  </script>
</body>
</html>`;
}

export function renderStoreNotFoundHtml(slug: string, createUrl = '/'): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Магазин не найден — NexusByte</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b0f19; color: #f1f5f9; display: grid; place-items: center; min-height: 100vh; padding: 24px; }
    .box { max-width: 460px; width: 100%; background: #131a29; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; }
    h1 { margin: 0 0 10px; font-size: 1.375rem; }
    p { margin: 0 0 24px; color: #94a3b8; line-height: 1.5; }
    a { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 20px; background: #4f46e5; color: #fff; text-decoration: none; border-radius: 10px; font-weight: 600; }
  </style>
</head>
<body>
  <main class="box">
    <h1>Витрина «${escapeHtml(slug)}» не найдена</h1>
    <p>Поддомен ${escapeHtml(slug)}.nexusbyte.de5.net пока не занят или магазин ещё не опубликован.</p>
    <a href="${escapeHtml(createUrl)}">Создать свой магазин</a>
  </main>
</body>
</html>`;
}

export function renderInvoicePageHtml(invoice: CheckoutInvoice, store: StoreConfig): string {
  const isPaid = invoice.status === 'paid';
  const backUrl = `/s/${encodeURIComponent(store.slug)}`;
  const downloadHref = invoice.delivery_token
    ? `/download/${encodeURIComponent(invoice.delivery_token)}`
    : '#';

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Оплата заказа ${escapeHtml(invoice.invoice_id)} — ${escapeHtml(store.meta.title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b0f19; color: #f1f5f9; display: grid; place-items: center; min-height: 100vh; padding: 20px; }
    .card { max-width: 500px; width: 100%; background: #131a29; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 28px; }
    h1 { margin: 0 0 6px; font-size: 1.25rem; }
    .sub { color: #94a3b8; font-size: 0.875rem; margin: 0 0 20px; }
    .row { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.9375rem; }
    .mono { font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; word-break: break-all; }
    .addr-box { margin: 18px 0; padding: 14px; background: #0b0f19; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; min-height: 46px; border: 0; border-radius: 10px; background: #059669; color: #fff; font-weight: 600; font-size: 0.9375rem; cursor: pointer; text-decoration: none; margin-top: 12px; }
    .btn-sec { display: inline-flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; background: transparent; color: #cbd5e1; font-weight: 500; font-size: 0.875rem; text-decoration: none; margin-top: 10px; }
    .paid-banner { padding: 16px; border-radius: 10px; background: rgba(5,150,105,0.15); border: 1px solid rgba(5,150,105,0.4); margin-top: 18px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Крипто-инвойс ${escapeHtml(invoice.invoice_id)}</h1>
    <p class="sub">Серверная цена проверена из KV для ${escapeHtml(store.slug)}.nexusbyte.de5.net</p>
    <div class="row"><span>Товар</span><strong>${escapeHtml(invoice.product_title)}</strong></div>
    <div class="row"><span>Email доставки</span><span class="mono">${escapeHtml(invoice.buyer_email)}</span></div>
    <div class="row"><span>Сумма к оплате</span><strong class="mono">${escapeHtml(invoice.amount_usdt.toFixed(2))} USDT</strong></div>
    <div class="row"><span>Сеть</span><span class="mono">${escapeHtml(invoice.network)}</span></div>

    ${
      isPaid
        ? `<div class="paid-banner">
            <strong>Оплата подтверждена.</strong> Письмо со ссылкой на архив отправлено на ${escapeHtml(invoice.buyer_email)}.
            <a class="btn" href="${escapeHtml(downloadHref)}">Скачать цифровой товар (R2 Presigned URL)</a>
           </div>`
        : `<div class="addr-box">
            <div style="font-size:0.75rem;color:#94a3b8;margin-bottom:6px;">Адрес кошелька (PAYMENT_SERVICE):</div>
            <div class="mono" style="font-size:0.875rem;">${escapeHtml(invoice.payment_address)}</div>
           </div>
           <button type="button" id="confirmPayBtn" class="btn">Симулировать оплату USDT (Webhook)</button>`
    }
    <a class="btn-sec" href="${escapeHtml(backUrl)}">Вернуться в витрину</a>
  </main>
  ${
    isPaid
      ? ''
      : `<script>
          document.getElementById('confirmPayBtn').addEventListener('click', function () {
            var btn = this;
            btn.disabled = true;
            btn.textContent = 'Подтверждение вебхука...';
            fetch('/api/payment/webhook', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoice_id: ${JSON.stringify(invoice.invoice_id)} })
            })
            .then(function (r) { return r.json(); })
            .then(function () { window.location.reload(); })
            .catch(function () { btn.disabled = false; btn.textContent = 'Симулировать оплату USDT (Webhook)'; });
          });
        </script>`
  }
</body>
</html>`;
}
