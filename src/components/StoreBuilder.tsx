import React, { useEffect, useState } from 'react';
import { Check, Lock, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import {
  ACCENT_PRESETS,
  type AccentPresetId,
  type StoreConfig,
  type ThemeMode,
} from '../worker/storeSchema';

const COVER_GALLERY = [
  {
    label: 'Data Router',
    url: '/src/assets/images/cover_telegram_parser_1795386901176.jpg',
  },
  {
    label: 'Trading Dial',
    url: '/src/assets/images/cover_crypto_sniper_1795386901268.jpg',
  },
  {
    label: 'Network Switch',
    url: '/src/assets/images/cover_proxy_rotator_1795386901069.jpg',
  },
  {
    label: 'Glass Monolith',
    url: '/src/assets/images/cover_discord_automod_1795386901250.jpg',
  },
  {
    label: 'Dev Hardware',
    url: '/src/assets/images/cover_scraper_sdk_1795386901425.jpg',
  },
  {
    label: 'Server Blade',
    url: '/src/assets/images/cover_webhook_relay_1795386900866.jpg',
  },
];

const DEFAULT_AVATAR = '/src/assets/images/avatar_alpha_dev_1795386901545.jpg';

interface ProductDraft {
  title: string;
  short_desc: string;
  price_usdt: string;
  category: string;
  cover_url: string;
  r2_object_key: string;
  delivery_note: string;
}

interface StoreBuilderProps {
  onStorePublished: (store: StoreConfig) => void;
}

function createEmptyProduct(index: number): ProductDraft {
  const cover = COVER_GALLERY[index % COVER_GALLERY.length].url;
  return {
    title: '',
    short_desc: '',
    price_usdt: '29.00',
    category: 'Bots & Automation',
    cover_url: cover,
    r2_object_key: '',
    delivery_note: '',
  };
}

export function StoreBuilder({ onStorePublished }: StoreBuilderProps) {
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<{
    checking: boolean;
    available?: boolean;
    message?: string;
  }>({ checking: false });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [accentPreset, setAccentPreset] = useState<AccentPresetId>('indigo');

  const [sellerName, setSellerName] = useState('');
  const [sellerBio, setSellerBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR);
  const [telegram, setTelegram] = useState('');

  const [products, setProducts] = useState<ProductDraft[]>([createEmptyProduct(0)]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishingPhase, setPublishingPhase] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed) {
      setSlugStatus({ checking: false });
      return;
    }

    const timer = setTimeout(async () => {
      setSlugStatus({ checking: true });
      try {
        const res = await fetch(`/api/stores/check-slug?slug=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        setSlugStatus({
          checking: false,
          available: Boolean(data.available),
          message: data.message,
        });
      } catch {
        setSlugStatus({ checking: false });
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [slug]);

  function handleFillDemo() {
    const suffix = Math.floor(100 + Math.random() * 899);
    setSlug(`edge-tools-${suffix}`);
    setTitle('Edge Tools — Скрипты и SDK');
    setDescription('Готовые модули для автоматизации Cloudflare Workers и парсинга данных.');
    setTheme('light');
    setAccentPreset('emerald');
    setSellerName('Nordic Dev');
    setSellerBio('Создаём производительные инструменты без лишних зависимостей.');
    setAvatarUrl(DEFAULT_AVATAR);
    setTelegram('nordic_dev_support');
    setProducts([
      {
        title: 'KV Cache Warmer CLI',
        short_desc: 'Утилита прогрева Edge KV узлов перед запуском рекламных кампаний.',
        price_usdt: '34.00',
        category: 'Edge Workers',
        cover_url: COVER_GALLERY[2].url,
        r2_object_key: `r2://nexusbyte-private/edge-tools-${suffix}/kv-warmer-v1.zip`,
        delivery_note: 'Инструкция по запуску через Wrangler CLI в README.md.',
      },
      {
        title: 'R2 Signed Link Proxy',
        short_desc: 'Готовый воркер генерации временных ссылок выдачи цифровых архивов.',
        price_usdt: '59.00',
        category: 'Security & Delivery',
        cover_url: COVER_GALLERY[5].url,
        r2_object_key: `r2://nexusbyte-private/edge-tools-${suffix}/r2-proxy-kit.zip`,
        delivery_note: 'Сконфигурируйте бакет PRODUCTS_R2 и токен подписи.',
      },
    ]);
    setFieldErrors({});
    setSubmitError(null);
  }

  function updateProduct(index: number, patch: Partial<ProductDraft>) {
    setProducts((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addProduct() {
    if (products.length >= 10) return;
    setProducts((prev) => [...prev, createEmptyProduct(prev.length)]);
  }

  function removeProduct(index: number) {
    if (products.length <= 1) return;
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError(null);
    setPublishingPhase('Сохранение в KV (разделение публичной и приватной схем)...');

    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim().toLowerCase(),
          meta: {
            title,
            description,
            accent_preset: accentPreset,
            theme,
          },
          profile: {
            name: sellerName,
            bio: sellerBio,
            avatar_url: avatarUrl,
            telegram,
          },
          products: products.map((p, idx) => ({
            id: `prod_${String(idx + 1).padStart(2, '0')}`,
            title: p.title,
            short_desc: p.short_desc,
            price_usdt: Number(p.price_usdt),
            cover_url: p.cover_url,
            category: p.category,
            r2_object_key: p.r2_object_key,
            delivery_note: p.delivery_note,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFieldErrors(data.errors || {});
        setSubmitError(data.error || 'Исправьте ошибки в форме.');
        setPublishingPhase(null);
        return;
      }

      // Poll KV propagation readiness as specified in Gap #3
      setPublishingPhase('Проверка репликации KV на Edge-узлах...');
      await new Promise((resolve) => setTimeout(resolve, 600));
      const readyRes = await fetch(`/api/stores/${encodeURIComponent(data.store.slug)}/ready`);
      if (!readyRes.ok) {
        await new Promise((resolve) => setTimeout(resolve, 900));
      }

      setPublishingPhase(null);
      onStorePublished(data.store);
    } catch {
      setSubmitError('Сетевая ошибка при публикации магазина.');
      setPublishingPhase(null);
    }
  }

  const activePreset = ACCENT_PRESETS[accentPreset];
  const isDarkPreview = theme === 'dark';

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Конструктор витрины за 1 клик
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Публичный конфиг записывается в <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">store:slug</code>,
            а приватные ссылки на R2-архивы изолируются в <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">delivery:store_id:product_id</code>.
          </p>
        </div>

        <button
          type="button"
          onClick={handleFillDemo}
          className="min-h-[44px] shrink-0 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Заполнить пример магазина
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Form Column */}
        <form onSubmit={handleSubmit} className="space-y-8 lg:col-span-7" noValidate>
          {submitError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="font-semibold">{submitError}</div>
              {Object.keys(fieldErrors).length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                  {Object.values(fieldErrors).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Section 1: Subdomain */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">1. Поддомен и адрес витрины</h2>
            <div className="mt-4">
              <label htmlFor="store-slug" className="mb-1.5 block text-sm font-medium text-slate-800">
                Поддомен (slug)
              </label>
              <div className="flex items-stretch">
                <input
                  id="store-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-scripts"
                  className="min-h-[44px] flex-1 rounded-l-lg border border-r-0 border-slate-300 px-3.5 font-mono text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
                <span className="inline-flex items-center rounded-r-lg border border-slate-300 bg-slate-50 px-3 font-mono text-xs text-slate-600">
                  .nexusbyte.de5.net
                </span>
              </div>

              <div className="mt-2 min-h-[20px] text-xs">
                {slugStatus.checking && <span className="text-slate-500">Проверка доступности...</span>}
                {!slugStatus.checking && slugStatus.message && (
                  <span className={slugStatus.available ? 'font-medium text-emerald-700' : 'font-medium text-red-600'}>
                    {slugStatus.message}
                  </span>
                )}
                {!slugStatus.message && fieldErrors.slug && (
                  <span className="font-medium text-red-600">{fieldErrors.slug}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Зарезервированные имена (www, admin, api, cdn, app, pay) автоматически блокируются.
              </p>
            </div>
          </section>

          {/* Section 2: Brand & Theme */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">2. Оформление и профиль продавца</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="store-title" className="mb-1.5 block text-sm font-medium text-slate-800">
                  Название магазина
                </label>
                <input
                  id="store-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Alpha Scripts — Боты и автоматизация"
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
                {fieldErrors['meta.title'] && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors['meta.title']}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="store-desc" className="mb-1.5 block text-sm font-medium text-slate-800">
                  Краткое описание (meta description)
                </label>
                <input
                  id="store-desc"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Готовые решения для парсинга и торговли"
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
                {fieldErrors['meta.description'] && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors['meta.description']}</p>
                )}
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-800">Цветовая тема</span>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`min-h-[40px] rounded-md text-xs font-semibold transition-colors ${
                      theme === 'dark' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Тёмная
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`min-h-[40px] rounded-md text-xs font-semibold transition-colors ${
                      theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Светлая
                  </button>
                </div>
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-800">
                  Акцентный пресет (WCAG-контраст)
                </span>
                <div className="flex flex-wrap gap-2">
                  {Object.values(ACCENT_PRESETS).map((preset) => {
                    const selected = accentPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setAccentPreset(preset.id)}
                        aria-label={`Выбрать акцент ${preset.label}`}
                        aria-pressed={selected}
                        style={{ backgroundColor: preset.hex }}
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-white transition-transform ${
                          selected ? 'ring-2 ring-slate-900 ring-offset-2' : 'opacity-85 hover:opacity-100'
                        }`}
                      >
                        {selected && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="seller-name" className="mb-1.5 block text-sm font-medium text-slate-800">
                  Имя продавца / студии
                </label>
                <input
                  id="seller-name"
                  type="text"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  placeholder="Alpha Dev"
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
                {fieldErrors['profile.name'] && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors['profile.name']}</p>
                )}
              </div>

              <div>
                <label htmlFor="seller-tg" className="mb-1.5 block text-sm font-medium text-slate-800">
                  Telegram для поддержки
                </label>
                <input
                  id="seller-tg"
                  type="text"
                  value={telegram}
                  onChange={(e) => setTelegram(e.target.value)}
                  placeholder="alphadev_support"
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 font-mono text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
                {fieldErrors['profile.telegram'] && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors['profile.telegram']}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="seller-bio" className="mb-1.5 block text-sm font-medium text-slate-800">
                  Био продавца
                </label>
                <textarea
                  id="seller-bio"
                  rows={2}
                  value={sellerBio}
                  onChange={(e) => setSellerBio(e.target.value)}
                  placeholder="Разрабатываю софт на Python и Node.js с 2021 года."
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
                {fieldErrors['profile.bio'] && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors['profile.bio']}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="avatar-url" className="mb-1.5 block text-sm font-medium text-slate-800">
                  URL аватара (R2 CDN или локальный ассет)
                </label>
                <input
                  id="avatar-url"
                  type="text"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-300 px-3.5 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Products (1 to 10) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  3. Цифровые товары ({products.length} / 10)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Поле «Ключ R2 / архив выдачи» сохраняется изолированно и никогда не попадает в HTML витрины.
                </p>
              </div>
              <button
                type="button"
                onClick={addProduct}
                disabled={products.length >= 10}
                className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Добавить товар</span>
              </button>
            </div>

            <div className="mt-5 space-y-6">
              {products.map((prod, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Товар #{idx + 1} (prod_{String(idx + 1).padStart(2, '0')})
                    </span>
                    {products.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProduct(idx)}
                        aria-label={`Удалить товар #${idx + 1}`}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-md px-2 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Удалить</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`prod-title-${idx}`}
                        className="mb-1 block text-xs font-medium text-slate-700"
                      >
                        Название товара
                      </label>
                      <input
                        id={`prod-title-${idx}`}
                        type="text"
                        value={prod.title}
                        onChange={(e) => updateProduct(idx, { title: e.target.value })}
                        placeholder="Telegram Parser Pro"
                        className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor={`prod-price-${idx}`}
                          className="mb-1 block text-xs font-medium text-slate-700"
                        >
                          Цена (USDT)
                        </label>
                        <input
                          id={`prod-price-${idx}`}
                          type="number"
                          min="1"
                          step="0.01"
                          value={prod.price_usdt}
                          onChange={(e) => updateProduct(idx, { price_usdt: e.target.value })}
                          className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm tabular-nums text-slate-900 focus:border-indigo-600 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`prod-cat-${idx}`}
                          className="mb-1 block text-xs font-medium text-slate-700"
                        >
                          Категория
                        </label>
                        <input
                          id={`prod-cat-${idx}`}
                          type="text"
                          value={prod.category}
                          onChange={(e) => updateProduct(idx, { category: e.target.value })}
                          className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`prod-desc-${idx}`}
                        className="mb-1 block text-xs font-medium text-slate-700"
                      >
                        Краткое описание
                      </label>
                      <input
                        id={`prod-desc-${idx}`}
                        type="text"
                        value={prod.short_desc}
                        onChange={(e) => updateProduct(idx, { short_desc: e.target.value })}
                        placeholder="Многопоточный сборщик аудитории без банов."
                        className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`prod-cover-${idx}`}
                        className="mb-1 block text-xs font-medium text-slate-700"
                      >
                        Обложка (WebP/JPEG)
                      </label>
                      <select
                        id={`prod-cover-${idx}`}
                        value={prod.cover_url}
                        onChange={(e) => updateProduct(idx, { cover_url: e.target.value })}
                        className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                      >
                        {COVER_GALLERY.map((c) => (
                          <option key={c.url} value={c.url}>
                            Студийная обложка: {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor={`prod-r2-${idx}`}
                        className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-700"
                      >
                        <Lock className="h-3 w-3 text-amber-600" />
                        <span>Приватный R2-ключ выдачи</span>
                      </label>
                      <input
                        id={`prod-r2-${idx}`}
                        type="text"
                        value={prod.r2_object_key}
                        onChange={(e) => updateProduct(idx, { r2_object_key: e.target.value })}
                        placeholder="r2://nexusbyte-private/usr_id/archive.zip"
                        className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <button
            type="submit"
            disabled={Boolean(publishingPhase)}
            className="min-h-[48px] w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {publishingPhase || 'Опубликовать за 1 клик'}
          </button>
        </form>

        {/* Live Preview & Guardrails Column */}
        <aside className="space-y-6 lg:col-span-5">
          <div className="sticky top-20 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Предпросмотр стиля и контраста</h2>
                <span className="font-mono text-xs text-slate-500">
                  {slug.trim() ? `${slug.trim().toLowerCase()}.nexusbyte.de5.net` : 'slug.nexusbyte.de5.net'}
                </span>
              </div>

              <div
                className={`rounded-xl border p-5 transition-colors ${
                  isDarkPreview
                    ? 'border-slate-800 bg-[#0b0f19] text-slate-100'
                    : 'border-slate-200 bg-[#f8fafc] text-slate-900'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={avatarUrl || DEFAULT_AVATAR}
                    alt="Превью аватара"
                    width={48}
                    height={48}
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-base font-bold">
                      {title || 'Название вашей витрины'}
                    </div>
                    <div className={`truncate text-xs ${isDarkPreview ? 'text-slate-400' : 'text-slate-500'}`}>
                      {sellerName || 'Имя продавца'} · @{telegram.replace(/^@+/, '') || 'support'}
                    </div>
                  </div>
                </div>

                <div
                  className={`mt-4 rounded-xl border p-4 ${
                    isDarkPreview ? 'border-white/10 bg-[#131a29]' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div
                    style={{ color: isDarkPreview ? activePreset.softTextDark : activePreset.softTextLight }}
                    className="text-xs font-semibold"
                  >
                    {products[0]?.category || 'Category'}
                  </div>
                  <div className="mt-1 text-sm font-semibold">
                    {products[0]?.title || 'Пример карточки товара'}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-sm font-bold tabular-nums">
                      {Number(products[0]?.price_usdt || 0).toFixed(2)} USDT
                    </span>
                    <span
                      style={{ backgroundColor: activePreset.hex, color: activePreset.textOnAccent }}
                      className="inline-flex min-h-[36px] items-center rounded-lg px-3.5 text-xs font-semibold"
                    >
                      Купить
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldAlert className="h-4 w-4 text-indigo-600" />
                <span>Заложенные гарантии ТЗ №1</span>
              </div>
              <ul className="space-y-2.5 text-xs leading-relaxed text-slate-600">
                <li>
                  <strong className="text-slate-900">Разделение KV:</strong> публичный ключ{' '}
                  <code className="rounded bg-slate-100 px-1">store:slug</code> не содержит ссылок на скачивание.
                </li>
                <li>
                  <strong className="text-slate-900">Защита от подмены цены:</strong>{' '}
                  <code className="rounded bg-slate-100 px-1">POST /api/checkout</code> берёт{' '}
                  <code className="rounded bg-slate-100 px-1">price_usdt</code> только на сервере.
                </li>
                <li>
                  <strong className="text-slate-900">Безопасный CSS:</strong> используются только проверенные
                  пресеты <code className="rounded bg-slate-100 px-1">accent_preset</code> и полное HTML-экранирование.
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
