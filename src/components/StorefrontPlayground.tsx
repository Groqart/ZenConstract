import React, { useState } from 'react';
import { ChevronDown, ExternalLink, Monitor, ShieldCheck, Smartphone } from 'lucide-react';
import {
  ACCENT_PRESETS,
  formatProductCountLabel,
  normalizeStoreSections,
  sanitizeSafeCtaUrl,
  type StoreConfig,
  type StoreProduct,
} from '../worker/storeSchema';
import { CheckoutModal } from './CheckoutModal';

interface StorefrontPlaygroundProps {
  stores: StoreConfig[];
  selectedSlug: string;
  onSelectSlug: (slug: string) => void;
  onOpenBuilder: () => void;
}

export function StorefrontPlayground({
  stores,
  selectedSlug,
  onSelectSlug,
  onOpenBuilder,
}: StorefrontPlaygroundProps) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [renderMode, setRenderMode] = useState<'interactive' | 'raw-ssr'>('interactive');
  const [checkoutProduct, setCheckoutProduct] = useState<StoreProduct | null>(null);

  const store = stores.find((s) => s.slug === selectedSlug) || stores[0];

  if (!store) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900">Нет опубликованных витрин</h1>
        <p className="mt-2 text-sm text-slate-600">
          Создайте первый магазин в конструкторе, чтобы увидеть рендер витрины и проверить оплату.
        </p>
        <button
          type="button"
          onClick={onOpenBuilder}
          className="mt-6 min-h-[44px] rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Создать магазин
        </button>
      </div>
    );
  }

  const isDark = store.meta.theme !== 'light';
  const accent = ACCENT_PRESETS[store.meta.accent_preset] || ACCENT_PRESETS.indigo;
  const activeProducts = store.products.filter((p) => p.is_active);
  const tgUrl = `https://t.me/${encodeURIComponent(store.profile.telegram.replace(/^@+/, ''))}`;

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8">
      {/* Workspace Control Strip */}
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <label htmlFor="store-switcher" className="text-xs font-semibold text-slate-500">
            Витрина:
          </label>
          <select
            id="store-switcher"
            value={store.slug}
            onChange={(e) => onSelectSlug(e.target.value)}
            className="min-h-[40px] w-full max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-indigo-600 focus:outline-none sm:w-auto"
          >
            {stores.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.slug}.nexusbyte.de5.net ({s.products.length} тов.)
              </option>
            ))}
          </select>

          <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
            |
          </span>

          <div className="text-xs text-slate-600">
            Тема: <span className="font-semibold text-slate-900">{isDark ? 'Тёмная' : 'Светлая'}</span>
            <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
            Акцент: <span className="font-semibold text-slate-900">{accent.label}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Viewport Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1" role="group" aria-label="Ширина экрана">
            <button
              type="button"
              onClick={() => setViewport('desktop')}
              className={`inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors ${
                viewport === 'desktop'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>1440px</span>
            </button>
            <button
              type="button"
              onClick={() => setViewport('mobile')}
              className={`inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors ${
                viewport === 'mobile'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>375px</span>
            </button>
          </div>

          {/* Render Mode Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1" role="group" aria-label="Режим рендеринга">
            <button
              type="button"
              onClick={() => setRenderMode('interactive')}
              className={`min-h-[36px] whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors ${
                renderMode === 'interactive'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Витрина
            </button>
            <button
              type="button"
              onClick={() => setRenderMode('raw-ssr')}
              className={`min-h-[36px] whitespace-nowrap rounded-md px-3 text-xs font-medium transition-colors ${
                renderMode === 'raw-ssr'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Чистый SSR iframe
            </button>
          </div>

          <a
            href={`/s/${store.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
          >
            <span>Открыть /s/{store.slug}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Storefront Preview Surface */}
      <div
        className={`mx-auto transition-all duration-200 ${
          viewport === 'mobile'
            ? 'max-w-[375px] overflow-hidden rounded-2xl border-4 border-slate-800 shadow-xl'
            : 'w-full'
        }`}
      >
        {renderMode === 'raw-ssr' ? (
          <iframe
            key={`${store.slug}-${viewport}`}
            src={`/s/${store.slug}`}
            title={`Edge SSR Витрина ${store.slug}`}
            className="h-[780px] w-full rounded-xl border border-slate-200 bg-white"
          />
        ) : (
          <div
            data-testid="storefront-canvas"
            className={`rounded-2xl border transition-colors ${
              isDark
                ? 'border-slate-800 bg-[#0b0f19] text-slate-100'
                : 'border-slate-200 bg-[#f8fafc] text-slate-900'
            }`}
          >
            <div className={viewport === 'mobile' ? 'px-4 py-6' : 'mx-auto max-w-[1120px] px-6 py-10 sm:px-8'}>
              {normalizeStoreSections(store.sections)
                .filter((sec) => sec.visible)
                .map((sec) => {
                  if (sec.type === 'header') {
                    return (
                      <header
                        key={sec.id}
                        className={`mb-8 flex flex-col gap-5 rounded-2xl border p-6 ${
                          viewport === 'desktop' ? 'md:flex-row md:items-center md:justify-between md:p-7' : ''
                        } ${
                          isDark
                            ? 'border-white/10 bg-[#131a29]'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex min-w-0 flex-col gap-3">
                          <div className="flex items-center gap-3.5 sm:gap-4">
                            <div
                              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border sm:h-[68px] sm:w-[68px] ${
                                isDark ? 'border-white/10 bg-[#1a2336]' : 'border-slate-200 bg-slate-100'
                              }`}
                            >
                              {store.profile.avatar_url ? (
                                <img
                                  src={store.profile.avatar_url}
                                  alt={store.profile.name}
                                  width={68}
                                  height={68}
                                  referrerPolicy="no-referrer"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-sm font-bold text-slate-400">
                                  {store.profile.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h1 className="text-balance text-xl font-bold tracking-tight sm:text-2xl">
                                {store.meta.title}
                              </h1>
                              <p className={`mt-1 break-words text-xs sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {store.profile.name} · {store.slug}.nexusbyte.de5.net
                              </p>
                            </div>
                          </div>
                          <p className={`max-w-2xl text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            {store.profile.bio}
                          </p>
                        </div>

                        <a
                          href={tgUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl border px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-85 ${
                            isDark
                              ? 'border-white/10 bg-[#1a2336] text-slate-100'
                              : 'border-slate-200 bg-slate-100 text-slate-900'
                          }`}
                        >
                          Связаться в Telegram
                        </a>
                      </header>
                    );
                  }

                  if (sec.type === 'hero_banner') {
                    const hb = sec.hero_banner;
                    const headline = String(hb?.headline || '').trim();
                    if (!headline) return null;
                    const subheadline = String(hb?.subheadline || '').trim();
                    const ctaLabel = String(hb?.cta_label || '').trim() || 'Смотреть каталог';
                    const rawTarget = String(hb?.cta_target || '').trim();
                    let href = activeProducts.some((p) => p.id === rawTarget)
                      ? `#${rawTarget}`
                      : sanitizeSafeCtaUrl(rawTarget);
                    if (href.startsWith('#') && href !== '#catalog-heading') {
                      const prodId = href.slice(1);
                      if (!activeProducts.some((p) => p.id === prodId)) {
                        href = '#catalog-heading';
                      }
                    }
                    const isExternal = href.startsWith('https://');
                    return (
                      <section
                        key={sec.id}
                        aria-label={headline}
                        className={`mb-8 flex flex-col gap-4 rounded-2xl border p-6 ${
                          viewport === 'desktop' ? 'md:flex-row md:items-center md:justify-between md:p-7' : ''
                        } ${
                          isDark ? 'border-white/10 bg-[#131a29]' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="min-w-0 max-w-2xl">
                          <h2 className="text-balance text-xl font-bold tracking-tight sm:text-2xl">
                            {headline}
                          </h2>
                          {subheadline && (
                            <p className={`mt-2 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              {subheadline}
                            </p>
                          )}
                        </div>
                        <a
                          href={href}
                          target={isExternal ? '_blank' : undefined}
                          rel={isExternal ? 'noopener noreferrer' : undefined}
                          style={{ backgroundColor: accent.hex, color: accent.textOnAccent }}
                          className="inline-flex min-h-[44px] shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                        >
                          {ctaLabel}
                        </a>
                      </section>
                    );
                  }

                  if (sec.type === 'trust_badges') {
                    const items = (sec.trust_badges?.items || [])
                      .filter((it) => it.title.trim() || it.description.trim())
                      .slice(0, 3);
                    if (items.length === 0) return null;
                    return (
                      <section key={sec.id} aria-label="Преимущества и гарантии" className="mb-8">
                        <div
                          className={`grid gap-4 ${
                            viewport === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'
                          }`}
                        >
                          {items.map((item, itemIdx) => (
                            <div
                              key={itemIdx}
                              className={`flex items-start gap-3 rounded-xl border p-4 ${
                                isDark ? 'border-white/10 bg-[#131a29]' : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div
                                style={{
                                  backgroundColor: isDark ? accent.softBgDark : accent.softBgLight,
                                  color: isDark ? accent.softTextDark : accent.softTextLight,
                                }}
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
                                aria-hidden="true"
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                {item.title.trim() && (
                                  <h3 className="text-sm font-semibold leading-snug">{item.title}</h3>
                                )}
                                {item.description.trim() && (
                                  <p className={`mt-1 text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  if (sec.type === 'product_grid') {
                    return (
                      <section key={sec.id} aria-labelledby="catalog-heading" className="mb-8">
                        <div className="mb-5 flex items-baseline justify-between gap-4">
                          <h2 id="catalog-heading" className="text-lg font-semibold">
                            Цифровые товары
                          </h2>
                          <span className={`text-sm tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {formatProductCountLabel(activeProducts.length)}
                          </span>
                        </div>

                        <div
                          className={`grid gap-6 ${
                            viewport === 'mobile'
                              ? 'grid-cols-1'
                              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                          }`}
                        >
                          {activeProducts.map((product, index) => (
                            <article
                              key={product.id}
                              id={product.id}
                              className={`flex flex-col overflow-hidden rounded-2xl border transition-transform duration-150 hover:-translate-y-0.5 ${
                                isDark
                                  ? 'border-white/10 bg-[#131a29]'
                                  : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div
                                className={`aspect-[4/3] w-full overflow-hidden border-b ${
                                  isDark ? 'border-white/10 bg-[#1a2336]' : 'border-slate-200 bg-slate-100'
                                }`}
                              >
                                {product.cover_url ? (
                                  <img
                                    src={product.cover_url}
                                    alt={product.title}
                                    width={640}
                                    height={480}
                                    loading={index >= 2 ? 'lazy' : 'eager'}
                                    referrerPolicy="no-referrer"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-lg font-bold text-slate-400">
                                    {product.title.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-1 flex-col p-5">
                                <div
                                  style={{ color: isDark ? accent.softTextDark : accent.softTextLight }}
                                  className="mb-1.5 text-xs font-semibold tracking-wide"
                                >
                                  {product.category}
                                </div>
                                <h3 className="text-base font-semibold leading-snug">{product.title}</h3>
                                <p
                                  className={`mt-2 flex-1 text-sm leading-relaxed ${
                                    isDark ? 'text-slate-400' : 'text-slate-600'
                                  }`}
                                >
                                  {product.short_desc}
                                </p>

                                <div
                                  className={`mt-5 flex items-center justify-between gap-3 border-t pt-4 ${
                                    isDark ? 'border-white/10' : 'border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-baseline gap-1.5 tabular-nums">
                                    <span className="text-lg font-bold">{product.price_usdt.toFixed(2)}</span>
                                    <span className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                      USDT
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => setCheckoutProduct(product)}
                                    style={{ backgroundColor: accent.hex, color: accent.textOnAccent }}
                                    className="min-h-[44px] min-w-[104px] shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2"
                                  >
                                    Купить
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  if (sec.type === 'faq') {
                    const items = (sec.faq?.items || [])
                      .filter((it) => it.question.trim() && it.answer.trim())
                      .slice(0, 6);
                    if (items.length === 0) return null;
                    const faqTitle = sec.faq?.title?.trim() || 'Частые вопросы';
                    return (
                      <section key={sec.id} aria-label={faqTitle} className="mb-8">
                        <h2 className="mb-4 text-lg font-semibold">{faqTitle}</h2>
                        <div className="space-y-2.5">
                          {items.map((item, itemIdx) => (
                            <details
                              key={itemIdx}
                              className={`group rounded-xl border ${
                                isDark ? 'border-white/10 bg-[#131a29]' : 'border-slate-200 bg-white'
                              }`}
                            >
                              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                                <span>{item.question}</span>
                                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                              </summary>
                              <div
                                className={`border-t px-4 py-3 text-sm leading-relaxed ${
                                  isDark ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'
                                }`}
                              >
                                {item.answer}
                              </div>
                            </details>
                          ))}
                        </div>
                      </section>
                    );
                  }

                  return (
                    <footer
                      key={sec.id}
                      className={`mt-10 flex flex-wrap items-center justify-between gap-4 border-t pt-5 text-xs ${
                        isDark ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      <span>{store.meta.description}</span>
                      <span>Zero-React Edge SSR · TTFB &lt; 50ms</span>
                    </footer>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      <CheckoutModal
        slug={store.slug}
        product={checkoutProduct}
        accentHex={accent.hex}
        onClose={() => setCheckoutProduct(null)}
      />
    </div>
  );
}
