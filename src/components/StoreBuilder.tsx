import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  Lock,
  Plus,
  ShieldAlert,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import {
  ACCENT_PRESETS,
  DEFAULT_STORE_SECTIONS,
  normalizeStoreSections,
  type AccentPresetId,
  type DeliverySecret,
  type StoreConfig,
  type StoreSection,
  type ThemeMode,
} from '../worker/storeSchema';
import type { SellerAccount } from './SellerAuthModal';

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

const SECTION_LABELS: Record<StoreSection['type'], string> = {
  header: 'Шапка магазина и профиль',
  product_grid: 'Сетка цифровых товаров',
  footer: 'Подвал витрины',
};

interface ProductDraft {
  id?: string;
  is_active: boolean;
  title: string;
  short_desc: string;
  price_usdt: string;
  category: string;
  cover_url: string;
  r2_object_key: string;
  file_name?: string;
  file_size_mb?: number;
  delivery_note: string;
}

interface StoreBuilderProps {
  authToken: string | null;
  currentUser: SellerAccount | null;
  ownedStores: StoreConfig[];
  editingSlug: string | null;
  onSelectEditingSlug: (slug: string | null) => void;
  onRequireAuth: () => void;
  onStorePublished: (store: StoreConfig) => void;
}

function createEmptyProduct(index: number): ProductDraft {
  const cover = COVER_GALLERY[index % COVER_GALLERY.length].url;
  return {
    is_active: true,
    title: '',
    short_desc: '',
    price_usdt: '29.00',
    category: 'Bots & Automation',
    cover_url: cover,
    r2_object_key: '',
    delivery_note: '',
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.readAsDataURL(file);
  });
}

export function StoreBuilder({
  authToken,
  currentUser,
  ownedStores,
  editingSlug,
  onSelectEditingSlug,
  onRequireAuth,
  onStorePublished,
}: StoreBuilderProps) {
  const isEditing = Boolean(editingSlug);

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
  const [sections, setSections] = useState<StoreSection[]>(DEFAULT_STORE_SECTIONS);
  const [products, setProducts] = useState<ProductDraft[]>([createEmptyProduct(0)]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [publishingPhase, setPublishingPhase] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Load store into form when switching to Edit Mode
  useEffect(() => {
    if (!editingSlug) {
      setSlug('');
      setTitle('');
      setDescription('');
      setTheme('dark');
      setAccentPreset('indigo');
      setSellerName(currentUser?.name || '');
      setSellerBio('');
      setAvatarUrl(DEFAULT_AVATAR);
      setTelegram('');
      setSections(DEFAULT_STORE_SECTIONS.map((s) => ({ ...s })));
      setProducts([createEmptyProduct(0)]);
      setFieldErrors({});
      setSubmitError(null);
      return;
    }

    let active = true;
    fetch(`/api/stores/${encodeURIComponent(editingSlug)}/inspect`)
      .then((r) => r.json())
      .then((data) => {
        if (!active || !data?.public_kv_value) return;
        const st: StoreConfig = data.public_kv_value;
        const deliveries: DeliverySecret[] = Array.isArray(data.private_deliveries)
          ? data.private_deliveries
          : [];
        const delMap = new Map(deliveries.map((d) => [d.product_id, d]));

        setSlug(st.slug);
        setTitle(st.meta.title);
        setDescription(st.meta.description);
        setTheme(st.meta.theme);
        setAccentPreset(st.meta.accent_preset);
        setSellerName(st.profile.name);
        setSellerBio(st.profile.bio);
        setAvatarUrl(st.profile.avatar_url);
        setTelegram(st.profile.telegram);
        setSections(normalizeStoreSections(st.sections));
        setProducts(
          st.products.map((p) => {
            const sec = delMap.get(p.id);
            return {
              id: p.id,
              is_active: p.is_active,
              title: p.title,
              short_desc: p.short_desc,
              price_usdt: p.price_usdt.toFixed(2),
              category: p.category,
              cover_url: p.cover_url,
              r2_object_key: sec?.r2_object_key || `${st.store_id}/${p.id}.zip`,
              file_name: sec?.file_name,
              file_size_mb: sec?.file_size_mb,
              delivery_note: sec?.delivery_note || '',
            };
          })
        );
        setFieldErrors({});
        setSubmitError(null);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [editingSlug, currentUser?.name]);

  // Check slug availability only when creating a new store
  useEffect(() => {
    if (isEditing) {
      setSlugStatus({ checking: false });
      return;
    }
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
  }, [slug, isEditing]);

  function handleFillDemo() {
    onSelectEditingSlug(null);
    const suffix = Math.floor(100 + Math.random() * 899);
    setSlug(`edge-tools-${suffix}`);
    setTitle('Edge Tools — Скрипты и SDK');
    setDescription('Готовые модули для автоматизации Cloudflare Workers и парсинга данных.');
    setTheme('light');
    setAccentPreset('emerald');
    setSellerName(currentUser?.name || 'Nordic Dev');
    setSellerBio('Создаём производительные инструменты без лишних зависимостей.');
    setAvatarUrl(DEFAULT_AVATAR);
    setTelegram('nordic_dev_support');
    setSections(DEFAULT_STORE_SECTIONS.map((s) => ({ ...s })));
    setProducts([
      {
        is_active: true,
        title: 'KV Cache Warmer CLI',
        short_desc: 'Утилита прогрева Edge KV узлов перед запуском рекламных кампаний.',
        price_usdt: '34.00',
        category: 'Edge Workers',
        cover_url: COVER_GALLERY[2].url,
        r2_object_key: `${currentUser?.user_id || 'usr_demo'}/kv-warmer-v1.zip`,
        delivery_note: 'Инструкция по запуску через Wrangler CLI в README.md.',
      },
      {
        is_active: true,
        title: 'R2 Signed Link Proxy',
        short_desc: 'Готовый воркер генерации временных ссылок выдачи цифровых архивов.',
        price_usdt: '59.00',
        category: 'Security & Delivery',
        cover_url: COVER_GALLERY[5].url,
        r2_object_key: `${currentUser?.user_id || 'usr_demo'}/r2-proxy-kit.zip`,
        delivery_note: 'Сконфигурируйте бакет PRIVATE_PRODUCTS_R2 и токен подписи.',
      },
    ]);
    setFieldErrors({});
    setSubmitError(null);
  }

  async function handlePublicImageUpload(
    file: File | undefined,
    target: 'avatar' | number
  ) {
    if (!file) return;
    if (!authToken) {
      onRequireAuth();
      return;
    }
    const keyLabel = target === 'avatar' ? 'avatar' : `cover-${target}`;
    setUploadingKey(keyLabel);
    setSubmitError(null);
    setUploadNotice(null);

    try {
      const dataBase64 = await readFileAsBase64(file);
      const res = await fetch('/api/r2/upload-public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          store_id: currentUser?.user_id || 'usr_public',
          file_name: file.name,
          data_base64: dataBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки изображения в PUBLIC_ASSETS_R2.');
      if (target === 'avatar') {
        setAvatarUrl(data.url);
      } else {
        updateProduct(target, { cover_url: data.url });
      }
      setUploadNotice(`Загружено в PUBLIC_ASSETS_R2: ${data.cdn_preview_url} (immutable cache)`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Ошибка загрузки.');
    } finally {
      setUploadingKey(null);
    }
  }

  async function handlePrivateArchiveUpload(file: File | undefined, index: number) {
    if (!file) return;
    if (!authToken) {
      onRequireAuth();
      return;
    }
    setUploadingKey(`private-${index}`);
    setSubmitError(null);
    setUploadNotice(null);

    try {
      const presignRes = await fetch('/api/r2/presign-private', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          store_id: currentUser?.user_id || 'usr_private',
          file_name: file.name,
          file_size_bytes: file.size,
        }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        throw new Error(presignData.error || 'Не удалось получить Presigned Upload URL.');
      }

      const uploadRes = await fetch(presignData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const uploadResult = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadResult.error || 'Ошибка прямой загрузки в PRIVATE_PRODUCTS_R2.');
      }

      updateProduct(index, {
        r2_object_key: uploadResult.r2_object_key,
        file_name: uploadResult.file_name,
        file_size_mb: uploadResult.size_mb,
      });
      setUploadNotice(
        `Архив «${uploadResult.file_name}» загружен в PRIVATE_PRODUCTS_R2 через Presigned URL.`
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Ошибка загрузки архива.');
    } finally {
      setUploadingKey(null);
    }
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

  function moveSection(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    setSections((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

  function toggleSectionVisibility(index: number) {
    setSections((prev) =>
      prev.map((sec, i) => (i === index ? { ...sec, visible: !sec.visible } : sec))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authToken) {
      onRequireAuth();
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setPublishingPhase(
      isEditing
        ? 'Обновление конфигурации магазина в KV...'
        : 'Сохранение в KV (привязка к owner_user_id)...'
    );

    const endpoint = isEditing
      ? `/api/stores/${encodeURIComponent(editingSlug!)}`
      : '/api/stores';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
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
          sections,
          products: products.map((p, idx) => ({
            id: p.id || `prod_${String(idx + 1).padStart(2, '0')}`,
            is_active: p.is_active,
            title: p.title,
            short_desc: p.short_desc,
            price_usdt: Number(p.price_usdt),
            cover_url: p.cover_url,
            category: p.category,
            r2_object_key: p.r2_object_key,
            file_name: p.file_name,
            file_size_mb: p.file_size_mb,
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

      setPublishingPhase('Проверка репликации KV на Edge-узлах...');
      await new Promise((resolve) => setTimeout(resolve, 400));
      await fetch(`/api/stores/${encodeURIComponent(data.store.slug)}/ready`);

      setPublishingPhase(null);
      onStorePublished(data.store);
    } catch {
      setSubmitError('Сетевая ошибка при сохранении магазина.');
      setPublishingPhase(null);
    }
  }

  const activePreset = ACCENT_PRESETS[accentPreset];
  const isDarkPreview = theme === 'dark';

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
      {/* Seller Account & Store Mode Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
            {isEditing ? `Редактирование: ${editingSlug}` : 'Конструктор витрины за 1 клик'}
          </h1>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">
            {currentUser ? (
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                <span>
                  Продавец: <strong className="text-slate-900">{currentUser.name}</strong> ({currentUser.user_id})
                </span>
              </span>
            ) : (
              'Войдите в аккаунт ZenxusBay, чтобы публиковать витрины, загружать файлы в R2 и редактировать товары.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {currentUser ? (
            <>
              <select
                aria-label="Мои магазины"
                value={editingSlug || '__new__'}
                onChange={(e) =>
                  onSelectEditingSlug(e.target.value === '__new__' ? null : e.target.value)
                }
                className="min-h-[42px] rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-900 focus:border-indigo-600 focus:outline-none"
              >
                <option value="__new__">+ Создать новый магазин</option>
                {ownedStores.map((st) => (
                  <option key={st.slug} value={st.slug}>
                    Редактировать: {st.slug}
                  </option>
                ))}
              </select>
              {!isEditing && (
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="min-h-[42px] shrink-0 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Заполнить пример
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={onRequireAuth}
              className="min-h-[44px] shrink-0 whitespace-nowrap rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Войти как продавец
            </button>
          )}
        </div>
      </div>

      {uploadNotice && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900">
          {uploadNotice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
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
                  disabled={isEditing}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="my-scripts"
                  className="min-h-[44px] flex-1 rounded-l-lg border border-r-0 border-slate-300 px-3.5 font-mono text-sm text-slate-900 focus:border-indigo-600 focus:outline-none disabled:bg-slate-100 disabled:text-slate-500"
                />
                <span className="inline-flex items-center rounded-r-lg border border-slate-300 bg-slate-50 px-3 font-mono text-xs text-slate-600">
                  .nexusbyte.de5.net
                </span>
              </div>

              <div className="mt-2 min-h-[20px] text-xs">
                {isEditing ? (
                  <span className="text-slate-500">
                    Привязан к владельцу {currentUser?.user_id}. Поддомен при редактировании не меняется.
                  </span>
                ) : (
                  <>
                    {slugStatus.checking && <span className="text-slate-500">Проверка доступности...</span>}
                    {!slugStatus.checking && slugStatus.message && (
                      <span className={slugStatus.available ? 'font-medium text-emerald-700' : 'font-medium text-red-600'}>
                        {slugStatus.message}
                      </span>
                    )}
                    {!slugStatus.message && fieldErrors.slug && (
                      <span className="font-medium text-red-600">{fieldErrors.slug}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Section 2: Brand & Theme */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">2. Оформление и аватар (PUBLIC_ASSETS_R2)</h2>
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
                  Акцентный пресет
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
                  Аватар (PUBLIC_ASSETS_R2 до 2 МБ или URL)
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="avatar-url"
                    type="text"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="min-h-[44px] flex-1 rounded-lg border border-slate-300 px-3.5 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                  />
                  <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-slate-50 px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                    <Upload className="h-3.5 w-3.5" />
                    <span>{uploadingKey === 'avatar' ? 'Загрузка...' : 'Загрузить фото'}</span>
                    <input
                      type="file"
                      accept=".webp,.png,.jpg,.jpeg"
                      className="sr-only"
                      onChange={(e) => handlePublicImageUpload(e.target.files?.[0], 'avatar')}
                    />
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Sections (Sprint 3 Drag-and-Drop Prep) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              3. Структура секций витрины (задел под Drag-and-Drop)
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Управляйте порядком и видимостью секций <code className="rounded bg-slate-100 px-1">sections[]</code> в StoreConfig.
            </p>
            <div className="mt-4 space-y-2">
              {sections.map((sec, idx) => (
                <div
                  key={sec.id}
                  className="flex flex-col justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">{SECTION_LABELS[sec.type]}</div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {sec.id} · {sec.type}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => moveSection(idx, -1)}
                      disabled={idx === 0}
                      aria-label={`Поднять секцию ${SECTION_LABELS[sec.type]}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(idx, 1)}
                      disabled={idx === sections.length - 1}
                      aria-label={`Опустить секцию ${SECTION_LABELS[sec.type]}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSectionVisibility(idx)}
                      aria-label={`Переключить видимость ${SECTION_LABELS[sec.type]}`}
                      className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${
                        sec.visible
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      {sec.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      <span>{sec.visible ? 'Показана' : 'Скрыта'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 4: Products (1 to 10) */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  4. Цифровые товары ({products.length} / 10)
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Архивы загружаются напрямую через Presigned URL в <code className="rounded bg-slate-100 px-1">PRIVATE_PRODUCTS_R2</code> (до 250 МБ).
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
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Товар #{idx + 1} ({prod.id || `prod_${String(idx + 1).padStart(2, '0')}`})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateProduct(idx, { is_active: !prod.is_active })}
                        className={`inline-flex min-h-[34px] items-center gap-1 rounded-md border px-2.5 text-xs font-medium ${
                          prod.is_active
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-slate-300 bg-white text-slate-500'
                        }`}
                      >
                        {prod.is_active ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        <span>{prod.is_active ? 'Активен' : 'Скрыт'}</span>
                      </button>

                      {products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProduct(idx)}
                          aria-label={`Удалить товар #${idx + 1}`}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-md px-2 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Удалить</span>
                        </button>
                      )}
                    </div>
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
                        Обложка (PUBLIC_ASSETS_R2 ≤ 2 МБ)
                      </label>
                      <div className="flex gap-1.5">
                        <select
                          id={`prod-cover-${idx}`}
                          value={
                            COVER_GALLERY.some((c) => c.url === prod.cover_url)
                              ? prod.cover_url
                              : '__custom__'
                          }
                          onChange={(e) => {
                            if (e.target.value !== '__custom__') {
                              updateProduct(idx, { cover_url: e.target.value });
                            }
                          }}
                          className="min-h-[42px] min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                        >
                          {COVER_GALLERY.map((c) => (
                            <option key={c.url} value={c.url}>
                              Студия: {c.label}
                            </option>
                          ))}
                          {!COVER_GALLERY.some((c) => c.url === prod.cover_url) && (
                            <option value="__custom__">R2 CDN: {prod.cover_url}</option>
                          )}
                        </select>
                        <label className="inline-flex min-h-[42px] shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{uploadingKey === `cover-${idx}` ? '...' : 'R2'}</span>
                          <input
                            type="file"
                            accept=".webp,.png,.jpg,.jpeg"
                            className="sr-only"
                            onChange={(e) => handlePublicImageUpload(e.target.files?.[0], idx)}
                          />
                        </label>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`prod-r2-${idx}`}
                        className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-700"
                      >
                        <Lock className="h-3 w-3 text-amber-600" />
                        <span>Архив (PRIVATE_PRODUCTS_R2 ≤ 250 МБ)</span>
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          id={`prod-r2-${idx}`}
                          type="text"
                          value={prod.r2_object_key}
                          onChange={(e) => updateProduct(idx, { r2_object_key: e.target.value })}
                          placeholder="usr_id/archive.zip"
                          className="min-h-[42px] min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                        />
                        <label className="inline-flex min-h-[42px] shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{uploadingKey === `private-${idx}` ? '...' : 'Файл'}</span>
                          <input
                            type="file"
                            accept=".zip,.tar.gz,.pdf"
                            className="sr-only"
                            onChange={(e) => handlePrivateArchiveUpload(e.target.files?.[0], idx)}
                          />
                        </label>
                      </div>
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
            {publishingPhase ||
              (isEditing ? 'Сохранить изменения витрины' : 'Опубликовать за 1 клик')}
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
                <span>Инфраструктура Спринта 2</span>
              </div>
              <ul className="space-y-2.5 text-xs leading-relaxed text-slate-600">
                <li>
                  <strong className="text-slate-900">Два R2-бакета:</strong> публичные картинки кэшируются на CDN, а архивы до 250 МБ грузятся по <code className="rounded bg-slate-100 px-1">Presigned URL</code> в обход лимита Worker 100 МБ.
                </li>
                <li>
                  <strong className="text-slate-900">Проверка прав (owner_user_id):</strong> попытка изменить чужой <code className="rounded bg-slate-100 px-1">slug</code> возвращает <code className="rounded bg-slate-100 px-1">403 Forbidden</code>.
                </li>
                <li>
                  <strong className="text-slate-900">Выдача и Resend:</strong> <code className="rounded bg-slate-100 px-1">/download/:token</code> поддерживает <code className="rounded bg-slate-100 px-1">Range</code> (206 Partial Content), лимит 5 скачиваний и идемпотентность по <code className="rounded bg-slate-100 px-1">invoice_id</code>.
                </li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
