export type ThemeMode = 'dark' | 'light';

export type AccentPresetId = 'indigo' | 'emerald' | 'sky' | 'amber' | 'rose' | 'slate';

export interface AccentPreset {
  id: AccentPresetId;
  label: string;
  hex: string;
  hoverHex: string;
  textOnAccent: string;
  softBgDark: string;
  softBgLight: string;
  softTextDark: string;
  softTextLight: string;
}

export const ACCENT_PRESETS: Record<AccentPresetId, AccentPreset> = {
  indigo: {
    id: 'indigo',
    label: 'Indigo',
    hex: '#4f46e5',
    hoverHex: '#4338ca',
    textOnAccent: '#ffffff',
    softBgDark: 'rgba(79, 70, 229, 0.16)',
    softBgLight: 'rgba(79, 70, 229, 0.09)',
    softTextDark: '#a5b4fc',
    softTextLight: '#4338ca',
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald',
    hex: '#059669',
    hoverHex: '#047857',
    textOnAccent: '#ffffff',
    softBgDark: 'rgba(5, 150, 105, 0.16)',
    softBgLight: 'rgba(5, 150, 105, 0.09)',
    softTextDark: '#6ee7b7',
    softTextLight: '#047857',
  },
  sky: {
    id: 'sky',
    label: 'Cobalt Sky',
    hex: '#0284c7',
    hoverHex: '#0369a1',
    textOnAccent: '#ffffff',
    softBgDark: 'rgba(2, 132, 199, 0.16)',
    softBgLight: 'rgba(2, 132, 199, 0.09)',
    softTextDark: '#7dd3fc',
    softTextLight: '#0369a1',
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    hex: '#d97706',
    hoverHex: '#b45309',
    textOnAccent: '#ffffff',
    softBgDark: 'rgba(217, 119, 6, 0.18)',
    softBgLight: 'rgba(217, 119, 6, 0.1)',
    softTextDark: '#fcd34d',
    softTextLight: '#b45309',
  },
  rose: {
    id: 'rose',
    label: 'Crimson Rose',
    hex: '#e11d48',
    hoverHex: '#be123c',
    textOnAccent: '#ffffff',
    softBgDark: 'rgba(225, 29, 72, 0.16)',
    softBgLight: 'rgba(225, 29, 72, 0.09)',
    softTextDark: '#fda4af',
    softTextLight: '#be123c',
  },
  slate: {
    id: 'slate',
    label: 'Graphite',
    hex: '#334155',
    hoverHex: '#1e293b',
    textOnAccent: '#ffffff',
    softBgDark: 'rgba(148, 163, 184, 0.16)',
    softBgLight: 'rgba(51, 65, 85, 0.08)',
    softTextDark: '#cbd5e1',
    softTextLight: '#334155',
  },
};

export const RESERVED_SLUGS = new Set([
  'www',
  'app',
  'api',
  'admin',
  'cdn',
  'auth',
  'mail',
  'status',
  'pay',
  'checkout',
  'static',
  'assets',
  'docs',
  'blog',
  'support',
  'billing',
  'dashboard',
  'panel',
  'root',
  'ns1',
  'ns2',
]);

export const SLUG_REGEX = /^[a-z0-9-]{3,32}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const TELEGRAM_REGEX = /^[a-zA-Z0-9_]{3,32}$/;

export interface StoreProduct {
  id: string;
  is_active: boolean;
  title: string;
  short_desc: string;
  price_usdt: number;
  cover_url: string;
  category: string;
}

export interface StoreConfig {
  schema_version: 1;
  store_id: string;
  slug: string;
  created_at: string;
  meta: {
    title: string;
    description: string;
    accent_preset: AccentPresetId;
    theme: ThemeMode;
  };
  profile: {
    name: string;
    bio: string;
    avatar_url: string;
    telegram: string;
  };
  products: StoreProduct[];
}

export interface DeliverySecret {
  key: string; // delivery:{store_id}:{product_id}
  store_id: string;
  product_id: string;
  r2_object_key: string;
  delivery_note: string;
  file_name: string;
  file_size_mb: number;
}

export interface CheckoutInvoice {
  invoice_id: string;
  store_id: string;
  slug: string;
  product_id: string;
  product_title: string;
  buyer_email: string;
  amount_usdt: number;
  network: 'USDT-TRC20';
  payment_address: string;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at?: string;
  delivery_token?: string;
  email_dispatched_to?: string;
}

export interface DeliveryTokenRecord {
  token: string;
  invoice_id: string;
  store_id: string;
  product_id: string;
  product_title: string;
  buyer_email: string;
  r2_object_key: string;
  file_name: string;
  delivery_note: string;
  expires_at: string;
}

export interface CreateProductInput {
  id?: string;
  title: string;
  short_desc: string;
  price_usdt: number;
  cover_url: string;
  category: string;
  r2_object_key: string;
  delivery_note?: string;
}

export interface CreateStoreInput {
  slug: string;
  meta: {
    title: string;
    description: string;
    accent_preset: AccentPresetId;
    theme: ThemeMode;
  };
  profile: {
    name: string;
    bio: string;
    avatar_url: string;
    telegram: string;
  };
  products: CreateProductInput[];
}

export interface SlugValidationResult {
  valid: boolean;
  normalized: string;
  reason?: 'empty' | 'format' | 'reserved';
  message?: string;
}

export function validateSlug(rawSlug: string): SlugValidationResult {
  const normalized = (rawSlug || '').trim().toLowerCase();
  if (!normalized) {
    return {
      valid: false,
      normalized,
      reason: 'empty',
      message: 'Укажите поддомен (slug).',
    };
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return {
      valid: false,
      normalized,
      reason: 'reserved',
      message: `Поддомен «${normalized}» зарезервирован системой.`,
    };
  }
  if (!SLUG_REGEX.test(normalized) || normalized.startsWith('-') || normalized.endsWith('-')) {
    return {
      valid: false,
      normalized,
      reason: 'format',
      message: 'Допустимы только строчные латинские буквы, цифры и дефис (3–32 символа, без дефиса по краям).',
    };
  }
  return { valid: true, normalized };
}

export function sanitizeTelegramHandle(raw: string): string | null {
  const cleaned = (raw || '').trim().replace(/^@+/, '');
  if (!cleaned) return '';
  if (!TELEGRAM_REGEX.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function sanitizeSafeUrl(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/src/assets/')) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export interface HostParseResult {
  type: 'store' | 'www_redirect' | 'root';
  slug?: string;
}

export function extractSlugFromHost(hostHeader: string, baseDomain = 'nexusbyte.de5.net'): HostParseResult {
  const host = (hostHeader || '').split(':')[0].trim().toLowerCase();
  if (!host || host === baseDomain) {
    return { type: 'root' };
  }
  const suffix = `.${baseDomain}`;
  if (!host.endsWith(suffix)) {
    return { type: 'root' };
  }
  const sub = host.slice(0, -suffix.length);
  if (!sub || sub.includes('.')) {
    return { type: 'root' };
  }
  if (sub === 'www') {
    return { type: 'www_redirect' };
  }
  return { type: 'store', slug: sub };
}

export interface ValidationOutcome {
  ok: boolean;
  errors: Record<string, string>;
  publicConfig?: StoreConfig;
  deliverySecrets?: DeliverySecret[];
}

export function validateStoreInput(
  input: CreateStoreInput,
  options: { storeId?: string; createdAt?: string } = {}
): ValidationOutcome {
  const errors: Record<string, string> = {};

  const slugCheck = validateSlug(input.slug);
  if (!slugCheck.valid) {
    errors.slug = slugCheck.message || 'Некорректный поддомен.';
  }

  const title = (input.meta?.title || '').trim();
  const description = (input.meta?.description || '').trim();
  if (title.length < 3 || title.length > 90) {
    errors['meta.title'] = 'Название магазина должно быть от 3 до 90 символов.';
  }
  if (description.length < 5 || description.length > 220) {
    errors['meta.description'] = 'Описание магазина должно быть от 5 до 220 символов.';
  }

  const theme: ThemeMode = input.meta?.theme === 'light' ? 'light' : 'dark';
  const accentPreset: AccentPresetId =
    input.meta?.accent_preset && input.meta.accent_preset in ACCENT_PRESETS
      ? input.meta.accent_preset
      : 'indigo';

  const profileName = (input.profile?.name || '').trim();
  const profileBio = (input.profile?.bio || '').trim();
  if (profileName.length < 2 || profileName.length > 60) {
    errors['profile.name'] = 'Имя продавца должно быть от 2 до 60 символов.';
  }
  if (profileBio.length < 5 || profileBio.length > 260) {
    errors['profile.bio'] = 'Краткое био продавца должно быть от 5 до 260 символов.';
  }

  const safeAvatar = sanitizeSafeUrl(input.profile?.avatar_url || '');
  if (!safeAvatar) {
    errors['profile.avatar_url'] = 'Укажите корректную https:// или локальную ссылку на аватар.';
  }

  const tg = sanitizeTelegramHandle(input.profile?.telegram || '');
  if (tg === null || tg === '') {
    errors['profile.telegram'] = 'Укажите корректный Telegram-username (3–32 символа, латиница/цифры/_).';
  }

  const rawProducts = Array.isArray(input.products) ? input.products : [];
  if (rawProducts.length < 1 || rawProducts.length > 10) {
    errors.products = 'Добавьте от 1 до 10 товаров.';
  }

  const storeId = options.storeId || `usr_${Math.random().toString(36).slice(2, 8)}`;
  const publicProducts: StoreProduct[] = [];
  const deliverySecrets: DeliverySecret[] = [];

  rawProducts.slice(0, 10).forEach((prod, index) => {
    const idx = index + 1;
    const pTitle = (prod.title || '').trim();
    const pDesc = (prod.short_desc || '').trim();
    const pCategory = (prod.category || '').trim() || 'Digital Product';
    const pPrice = Number(prod.price_usdt);
    const safeCover = sanitizeSafeUrl(prod.cover_url || '');
    const r2Key = (prod.r2_object_key || '').trim();

    if (pTitle.length < 2 || pTitle.length > 80) {
      errors[`products.${index}.title`] = `Товар #${idx}: название от 2 до 80 символов.`;
    }
    if (pDesc.length < 5 || pDesc.length > 180) {
      errors[`products.${index}.short_desc`] = `Товар #${idx}: описание от 5 до 180 символов.`;
    }
    if (!Number.isFinite(pPrice) || pPrice < 1 || pPrice > 100000) {
      errors[`products.${index}.price_usdt`] = `Товар #${idx}: цена должна быть от 1 до 100 000 USDT.`;
    }
    if (!safeCover) {
      errors[`products.${index}.cover_url`] = `Товар #${idx}: некорректный URL обложки.`;
    }
    if (r2Key.length < 3 || r2Key.length > 200) {
      errors[`products.${index}.r2_object_key`] = `Товар #${idx}: укажите путь архива в R2 или приватный ключ выдачи.`;
    }

    const productId = (prod.id || '').trim() || `prod_${String(idx).padStart(2, '0')}`;

    publicProducts.push({
      id: productId,
      is_active: true,
      title: pTitle,
      short_desc: pDesc,
      price_usdt: Math.round(pPrice * 100) / 100,
      cover_url: safeCover || '',
      category: pCategory,
    });

    deliverySecrets.push({
      key: `delivery:${storeId}:${productId}`,
      store_id: storeId,
      product_id: productId,
      r2_object_key: r2Key,
      delivery_note: (prod.delivery_note || '').trim() || 'Инструкция по развёртыванию и лицензионный ключ внутри архива.',
      file_name: `${productId}-${slugCheck.normalized || 'bundle'}.zip`,
      file_size_mb: 4.2,
    });
  });

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    errors: {},
    publicConfig: {
      schema_version: 1,
      store_id: storeId,
      slug: slugCheck.normalized,
      created_at: options.createdAt || new Date().toISOString(),
      meta: {
        title,
        description,
        accent_preset: accentPreset,
        theme,
      },
      profile: {
        name: profileName,
        bio: profileBio,
        avatar_url: safeAvatar || '',
        telegram: tg || '',
      },
      products: publicProducts,
    },
    deliverySecrets,
  };
}

export function validateCheckoutRequest(body: unknown): {
  ok: boolean;
  error?: string;
  product_id?: string;
  email?: string;
  slug?: string;
} {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Некорректное тело запроса.' };
  }
  const record = body as Record<string, unknown>;
  const productId = typeof record.product_id === 'string' ? record.product_id.trim() : '';
  const email = typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';
  const slug = typeof record.slug === 'string' ? record.slug.trim().toLowerCase() : undefined;

  if (!productId || !/^[a-zA-Z0-9_-]{2,40}$/.test(productId)) {
    return { ok: false, error: 'Некорректный идентификатор товара.' };
  }
  if (!email || !EMAIL_REGEX.test(email) || email.length > 160) {
    return { ok: false, error: 'Введите корректный Email для получения цифрового товара.' };
  }

  return { ok: true, product_id: productId, email, slug };
}

export function formatProductCountLabel(count: number): string {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) {
    return `${count} позиций`;
  }
  if (mod10 === 1) {
    return `${count} позиция`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} позиции`;
  }
  return `${count} позиций`;
}

