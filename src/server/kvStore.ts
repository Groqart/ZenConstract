import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  CheckoutInvoice,
  DeliverySecret,
  DeliveryTokenRecord,
  StoreConfig,
} from '../worker/storeSchema';

interface PersistedData {
  stores: Record<string, StoreConfig>; // key: store:{slug}
  deliveries: Record<string, DeliverySecret>; // key: delivery:{store_id}:{product_id}
  invoices: Record<string, CheckoutInvoice>; // key: invoice:{invoice_id}
  tokens: Record<string, DeliveryTokenRecord>; // key: token:{token}
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'kv-store.json');

const SEED_DATA: PersistedData = {
  stores: {
    'store:alpha-scripts': {
      schema_version: 1,
      store_id: 'usr_98765',
      slug: 'alpha-scripts',
      created_at: '2026-11-20T10:00:00.000Z',
      meta: {
        title: 'Alpha Scripts — Боты и автоматизация',
        description: 'Готовые решения для парсинга, арбитража и серверной автоматизации на Python и Node.js',
        accent_preset: 'indigo',
        theme: 'dark',
      },
      profile: {
        name: 'Alpha Dev',
        bio: 'Разрабатываю софт на Python и Node.js с 2021 года. Поддержка в Telegram и обновления по подписке.',
        avatar_url: '/src/assets/images/avatar_alpha_dev_1795386901545.jpg',
        telegram: 'alphadev_support',
      },
      products: [
        {
          id: 'prod_01',
          is_active: true,
          title: 'Telegram Parser Pro v2.4',
          short_desc: 'Многопоточный сборщик активной аудитории чатов и каналов с авто-ротацией сессий.',
          price_usdt: 49.0,
          cover_url: '/src/assets/images/cover_telegram_parser_1795386901176.jpg',
          category: 'Bots & Automation',
        },
        {
          id: 'prod_02',
          is_active: true,
          title: 'DEX Liquidity Sniper CLI',
          short_desc: 'Высокоскоростной бот отслеживания пулов ликвидности с настраиваемым проскальзыванием.',
          price_usdt: 129.0,
          cover_url: '/src/assets/images/cover_crypto_sniper_1795386901268.jpg',
          category: 'Trading Engines',
        },
        {
          id: 'prod_03',
          is_active: true,
          title: 'Residential Proxy Rotator',
          short_desc: 'Локальный балансировщик SOCKS5/HTTP пулов с health-check мониторингом и метриками.',
          price_usdt: 35.0,
          cover_url: '/src/assets/images/cover_proxy_rotator_1795386901069.jpg',
          category: 'Network Infra',
        },
        {
          id: 'prod_04',
          is_active: true,
          title: 'Discord Guard & AutoMod',
          short_desc: 'Анти-спам система для крупных сообществ с верификацией ролей и аудитом логов.',
          price_usdt: 29.0,
          cover_url: '/src/assets/images/cover_discord_automod_1795386901250.jpg',
          category: 'Community Tools',
        },
        {
          id: 'prod_05',
          is_active: true,
          title: 'Stealth Playwright SDK',
          short_desc: 'Готовый шаблон браузерной автоматизации с эмуляцией отпечатков и очередью задач.',
          price_usdt: 64.0,
          cover_url: '/src/assets/images/cover_scraper_sdk_1795386901425.jpg',
          category: 'Developer Kits',
        },
        {
          id: 'prod_06',
          is_active: true,
          title: 'Crypto Webhook Relay',
          short_desc: 'Легковесный сервис верификации HMAC-подписей и маршрутизации платежных уведомлений.',
          price_usdt: 42.0,
          cover_url: '/src/assets/images/cover_webhook_relay_1795386900866.jpg',
          category: 'Edge Workers',
        },
      ],
    },
    'store:kinetix-ui': {
      schema_version: 1,
      store_id: 'usr_44120',
      slug: 'kinetix-ui',
      created_at: '2026-11-21T08:30:00.000Z',
      meta: {
        title: 'Kinetix Systems — Edge Шаблоны',
        description: 'Чистые шаблоны на Cloudflare Workers, D1 и Zero-JS интерфейсы с PageSpeed 99',
        accent_preset: 'emerald',
        theme: 'light',
      },
      profile: {
        name: 'Kinetix Lab',
        bio: 'Проектируем сверхбыстрые витрины и микро-сервисы без тяжелых клиентских бандлов.',
        avatar_url: '/src/assets/images/avatar_alpha_dev_1795386901545.jpg',
        telegram: 'kinetix_lab',
      },
      products: [
        {
          id: 'prod_01',
          is_active: true,
          title: 'Edge SSR Starter Pack',
          short_desc: 'Набор минималистичных HTML/CSS шаблонов для витрин цифровых товаров на Workers.',
          price_usdt: 24.0,
          cover_url: '/src/assets/images/cover_scraper_sdk_1795386901425.jpg',
          category: 'Templates',
        },
        {
          id: 'prod_02',
          is_active: true,
          title: 'R2 Signed Delivery Kit',
          short_desc: 'Модуль генерации одноразовых ссылок скачивания и отправки писем через Resend API.',
          price_usdt: 38.0,
          cover_url: '/src/assets/images/cover_webhook_relay_1795386900866.jpg',
          category: 'Backend Modules',
        },
        {
          id: 'prod_03',
          is_active: true,
          title: 'Multi-Pool Proxy Bridge',
          short_desc: 'Маршрутизатор запросов для распределённых Edge-узлов с автоматическим failover.',
          price_usdt: 55.0,
          cover_url: '/src/assets/images/cover_proxy_rotator_1795386901069.jpg',
          category: 'Network Infra',
        },
      ],
    },
  },
  deliveries: {
    'delivery:usr_98765:prod_01': {
      key: 'delivery:usr_98765:prod_01',
      store_id: 'usr_98765',
      product_id: 'prod_01',
      r2_object_key: 'r2://nexusbyte-private/usr_98765/telegram-parser-pro-v2.4.zip',
      delivery_note: 'Распакуйте архив, заполните .env (API_ID, API_HASH) и запустите python main.py.',
      file_name: 'telegram-parser-pro-v2.4.zip',
      file_size_mb: 6.4,
    },
    'delivery:usr_98765:prod_02': {
      key: 'delivery:usr_98765:prod_02',
      store_id: 'usr_98765',
      product_id: 'prod_02',
      r2_object_key: 'r2://nexusbyte-private/usr_98765/dex-liquidity-sniper-cli.zip',
      delivery_note: 'Укажите RPC-эндпоинт в config.toml и протестируйте в dry-run режиме.',
      file_name: 'dex-liquidity-sniper-cli.zip',
      file_size_mb: 11.2,
    },
    'delivery:usr_98765:prod_03': {
      key: 'delivery:usr_98765:prod_03',
      store_id: 'usr_98765',
      product_id: 'prod_03',
      r2_object_key: 'r2://nexusbyte-private/usr_98765/residential-proxy-rotator.zip',
      delivery_note: 'Docker Compose манифест и бинарник балансировщика внутри архива.',
      file_name: 'residential-proxy-rotator.zip',
      file_size_mb: 8.1,
    },
    'delivery:usr_98765:prod_04': {
      key: 'delivery:usr_98765:prod_04',
      store_id: 'usr_98765',
      product_id: 'prod_04',
      r2_object_key: 'r2://nexusbyte-private/usr_98765/discord-guard-automod.zip',
      delivery_note: 'Добавьте токен бота и импортируйте правила модерации из rules.json.',
      file_name: 'discord-guard-automod.zip',
      file_size_mb: 3.7,
    },
    'delivery:usr_98765:prod_05': {
      key: 'delivery:usr_98765:prod_05',
      store_id: 'usr_98765',
      product_id: 'prod_05',
      r2_object_key: 'r2://nexusbyte-private/usr_98765/stealth-playwright-sdk.zip',
      delivery_note: 'Выполните npm install && npm run demo для проверки профиля браузера.',
      file_name: 'stealth-playwright-sdk.zip',
      file_size_mb: 5.5,
    },
    'delivery:usr_98765:prod_06': {
      key: 'delivery:usr_98765:prod_06',
      store_id: 'usr_98765',
      product_id: 'prod_06',
      r2_object_key: 'r2://nexusbyte-private/usr_98765/crypto-webhook-relay.zip',
      delivery_note: 'Разверните через wrangler deploy и задайте секрет WEBHOOK_HMAC_SECRET.',
      file_name: 'crypto-webhook-relay.zip',
      file_size_mb: 2.9,
    },
    'delivery:usr_44120:prod_01': {
      key: 'delivery:usr_44120:prod_01',
      store_id: 'usr_44120',
      product_id: 'prod_01',
      r2_object_key: 'r2://nexusbyte-private/usr_44120/edge-ssr-starter-pack.zip',
      delivery_note: 'Содержит 6 готовых SSR-шаблонов под Cloudflare Workers.',
      file_name: 'edge-ssr-starter-pack.zip',
      file_size_mb: 4.1,
    },
    'delivery:usr_44120:prod_02': {
      key: 'delivery:usr_44120:prod_02',
      store_id: 'usr_44120',
      product_id: 'prod_02',
      r2_object_key: 'r2://nexusbyte-private/usr_44120/r2-signed-delivery-kit.zip',
      delivery_note: 'Готовый обработчик вебхуков + шаблон письма Resend.',
      file_name: 'r2-signed-delivery-kit.zip',
      file_size_mb: 3.3,
    },
    'delivery:usr_44120:prod_03': {
      key: 'delivery:usr_44120:prod_03',
      store_id: 'usr_44120',
      product_id: 'prod_03',
      r2_object_key: 'r2://nexusbyte-private/usr_44120/multi-pool-proxy-bridge.zip',
      delivery_note: 'Инструкция по настройке Durable Objects и маршрутизации.',
      file_name: 'multi-pool-proxy-bridge.zip',
      file_size_mb: 7.0,
    },
  },
  invoices: {},
  tokens: {},
};

class KvSimulatorStore {
  private data: PersistedData;

  constructor() {
    this.data = this.load();
  }

  private load(): PersistedData {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as PersistedData;
        if (parsed && parsed.stores && parsed.deliveries) {
          return {
            stores: { ...SEED_DATA.stores, ...parsed.stores },
            deliveries: { ...SEED_DATA.deliveries, ...parsed.deliveries },
            invoices: parsed.invoices || {},
            tokens: parsed.tokens || {},
          };
        }
      }
    } catch {
      // Fallback cleanly to seed data
    }
    this.persistSync(SEED_DATA);
    return structuredClone(SEED_DATA);
  }

  private persistSync(target: PersistedData = this.data): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(target, null, 2), 'utf-8');
    } catch {
      // Ignore write failures in read-only environments
    }
  }

  listPublicStores(): StoreConfig[] {
    return Object.values(this.data.stores).sort((a, b) =>
      a.created_at < b.created_at ? 1 : -1
    );
  }

  getPublicStore(slug: string): StoreConfig | null {
    return this.data.stores[`store:${slug}`] || null;
  }

  hasStoreSlug(slug: string): boolean {
    return Boolean(this.data.stores[`store:${slug}`]);
  }

  saveStore(publicConfig: StoreConfig, deliverySecrets: DeliverySecret[]): void {
    this.data.stores[`store:${publicConfig.slug}`] = publicConfig;
    for (const secret of deliverySecrets) {
      this.data.deliveries[secret.key] = secret;
    }
    this.persistSync();
  }

  getDeliveriesForStore(storeId: string): DeliverySecret[] {
    return Object.values(this.data.deliveries).filter((d) => d.store_id === storeId);
  }

  getDeliverySecret(storeId: string, productId: string): DeliverySecret | null {
    return this.data.deliveries[`delivery:${storeId}:${productId}`] || null;
  }

  createInvoice(params: {
    store: StoreConfig;
    productId: string;
    productTitle: string;
    amountUsdt: number;
    buyerEmail: string;
  }): CheckoutInvoice {
    const invoiceId = `inv_${crypto.randomBytes(5).toString('hex')}`;
    const addressSuffix = crypto.randomBytes(14).toString('hex').toUpperCase().slice(0, 26);
    const invoice: CheckoutInvoice = {
      invoice_id: invoiceId,
      store_id: params.store.store_id,
      slug: params.store.slug,
      product_id: params.productId,
      product_title: params.productTitle,
      buyer_email: params.buyerEmail,
      amount_usdt: params.amountUsdt,
      network: 'USDT-TRC20',
      payment_address: `T${addressSuffix}NB`,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    this.data.invoices[`invoice:${invoiceId}`] = invoice;
    this.persistSync();
    return invoice;
  }

  getInvoice(invoiceId: string): CheckoutInvoice | null {
    return this.data.invoices[`invoice:${invoiceId}`] || null;
  }

  markInvoicePaid(invoiceId: string): {
    invoice: CheckoutInvoice;
    tokenRecord: DeliveryTokenRecord;
  } | null {
    const invoice = this.getInvoice(invoiceId);
    if (!invoice) return null;

    if (invoice.status === 'paid' && invoice.delivery_token) {
      const existingToken = this.data.tokens[`token:${invoice.delivery_token}`];
      if (existingToken) {
        return { invoice, tokenRecord: existingToken };
      }
    }

    const secret = this.getDeliverySecret(invoice.store_id, invoice.product_id);
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const tokenRecord: DeliveryTokenRecord = {
      token,
      invoice_id: invoice.invoice_id,
      store_id: invoice.store_id,
      product_id: invoice.product_id,
      product_title: invoice.product_title,
      buyer_email: invoice.buyer_email,
      r2_object_key: secret?.r2_object_key || `r2://nexusbyte-private/${invoice.store_id}/${invoice.product_id}.zip`,
      file_name: secret?.file_name || `${invoice.product_id}-bundle.zip`,
      delivery_note: secret?.delivery_note || 'Лицензионный архив и документация.',
      expires_at: expiresAt,
    };

    invoice.status = 'paid';
    invoice.paid_at = new Date().toISOString();
    invoice.delivery_token = token;
    invoice.email_dispatched_to = invoice.buyer_email;

    this.data.invoices[`invoice:${invoiceId}`] = invoice;
    this.data.tokens[`token:${token}`] = tokenRecord;
    this.persistSync();

    return { invoice, tokenRecord };
  }

  getDeliveryToken(token: string): DeliveryTokenRecord | null {
    const rec = this.data.tokens[`token:${token}`] || null;
    if (!rec) return null;
    if (Date.parse(rec.expires_at) < Date.now()) {
      return null;
    }
    return rec;
  }
}

export const kvStore = new KvSimulatorStore();
