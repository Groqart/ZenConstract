import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  renderInvoicePageHtml,
  renderStorefrontHtml,
  renderStoreNotFoundHtml,
} from './ssrRenderer';
import type { CheckoutInvoice, StoreConfig, StoreSection } from './storeSchema';

test('escapeHtml neutralizes XSS payloads', () => {
  const payload = `<script>alert("xss")</script>'/`;
  const escaped = escapeHtml(payload);
  assert.equal(escaped.includes('<script>'), false);
  assert.equal(escaped.includes('"'), false);
  assert.equal(escaped.includes("'"), false);
});

test('renderStorefrontHtml escapes untrusted text and maintains 44px touch targets & lazy images', () => {
  const maliciousStore: StoreConfig = {
    schema_version: 1,
    store_id: 'usr_999',
    owner_user_id: 'usr_999',
    slug: 'xss-check',
    created_at: '2026-11-22T00:00:00.000Z',
    meta: {
      title: 'Store <img src=x onerror=alert(1)>',
      description: 'Safe "description" & <script>',
      accent_preset: 'indigo',
      theme: 'dark',
    },
    profile: {
      name: 'Seller <b>Bold</b>',
      bio: 'Bio with <svg onload=alert(1)>',
      avatar_url: '/src/assets/images/avatar.jpg',
      telegram: 'seller_tg',
    },
    products: [
      {
        id: 'prod_01',
        is_active: true,
        title: 'Tool 1 <script>evil()</script>',
        short_desc: 'Desc 1',
        price_usdt: 25,
        cover_url: '/src/assets/images/c1.jpg',
        category: 'Bots',
      },
      {
        id: 'prod_02',
        is_active: true,
        title: 'Tool 2',
        short_desc: 'Desc 2',
        price_usdt: 35,
        cover_url: '/src/assets/images/c2.jpg',
        category: 'Bots',
      },
      {
        id: 'prod_03',
        is_active: true,
        title: 'Tool 3',
        short_desc: 'Desc 3',
        price_usdt: 45,
        cover_url: '/src/assets/images/c3.jpg',
        category: 'Bots',
      },
    ],
  };

  const html = renderStorefrontHtml(maliciousStore);

  assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
  assert.equal(html.includes('<script>evil()</script>'), false);
  assert.equal(html.includes('<svg onload=alert(1)>'), false);
  assert.equal(html.includes('min-height: 44px'), true);
  assert.equal(html.includes('loading="lazy"'), true);
  assert.equal(html.includes('https://t.me/seller_tg'), true);
});

test('renderStorefrontHtml hides inactive products, respects section order/visibility, and skips unknown block types', () => {
  const store: StoreConfig = {
    schema_version: 1,
    store_id: 'usr_111',
    owner_user_id: 'usr_111',
    slug: 'sections-check',
    created_at: '2026-11-22T00:00:00.000Z',
    meta: {
      title: 'Sections Test Store',
      description: 'Testing sections',
      accent_preset: 'emerald',
      theme: 'light',
    },
    profile: {
      name: 'Tester',
      bio: 'Testing section visibility.',
      avatar_url: '/cdn/usr_111/avatar.webp',
      telegram: 'tester_tg',
    },
    sections: [
      { id: 'sec_header', type: 'header', visible: true },
      { id: 'sec_unknown', type: 'future_block' as unknown as StoreSection['type'], visible: true },
      { id: 'sec_catalog', type: 'product_grid', visible: true },
      {
        id: 'sec_hero_1',
        type: 'hero_banner',
        visible: true,
        hero_banner: {
          headline: 'Special Offer After Catalog',
          subheadline: 'Instant delivery',
          cta_label: 'Jump to tool',
          cta_target: '#prod_01',
        },
      },
      { id: 'sec_footer', type: 'footer', visible: false },
    ],
    products: [
      {
        id: 'prod_01',
        is_active: true,
        title: 'Visible Tool',
        short_desc: 'Shown on storefront.',
        price_usdt: 15,
        cover_url: '/cdn/usr_111/c1.webp',
        category: 'Tools',
      },
      {
        id: 'prod_02',
        is_active: false,
        title: 'Hidden Archive Tool',
        short_desc: 'Must not appear in SSR HTML.',
        price_usdt: 99,
        cover_url: '/cdn/usr_111/c2.webp',
        category: 'Tools',
      },
    ],
  };

  const html = renderStorefrontHtml(store);
  assert.equal(html.includes('Visible Tool'), true);
  assert.equal(html.includes('Hidden Archive Tool'), false);
  assert.equal(html.includes('1 позиция'), true);
  assert.equal(html.includes('<footer class="site-footer">'), false);
  assert.equal(html.includes('id="prod_01"'), true);
  assert.equal(html.includes('href="#prod_01"'), true);
  assert.ok(html.indexOf('<header class="store-header">') < html.indexOf('id="catalog-heading"'));
  assert.ok(html.indexOf('id="catalog-heading"') < html.indexOf('Special Offer After Catalog'));
});

test('renderStorefrontHtml escapes XSS in hero_banner, trust_badges, and native <details> FAQ and sanitizes malicious/inactive cta_target', () => {
  const store: StoreConfig = {
    schema_version: 1,
    store_id: 'usr_222',
    owner_user_id: 'usr_222',
    slug: 'xss-blocks',
    created_at: '2026-11-22T00:00:00.000Z',
    meta: {
      title: 'XSS Guard Store',
      description: 'Security check',
      accent_preset: 'indigo',
      theme: 'dark',
    },
    profile: {
      name: 'Sec Dev',
      bio: 'Checking XSS resistance.',
      avatar_url: '/src/assets/images/avatar.jpg',
      telegram: 'sec_dev',
    },
    sections: [
      { id: 'sec_header', type: 'header', visible: true },
      {
        id: 'sec_hero_xss',
        type: 'hero_banner',
        visible: true,
        hero_banner: {
          headline: 'Offer <img src=x onerror=alert(1)>',
          subheadline: 'Sub </section><script>alert(2)</script>',
          cta_label: 'Click <b onclick=alert(3)>Now</b>',
          cta_target: '  JaVaScRiPt:alert(1)',
        },
      },
      {
        id: 'sec_hero_inactive',
        type: 'hero_banner',
        visible: true,
        hero_banner: {
          headline: 'Inactive Target Banner',
          subheadline: 'Should fallback to catalog heading',
          cta_label: 'Fallback CTA',
          cta_target: '#prod_02',
        },
      },
      {
        id: 'sec_trust_xss',
        type: 'trust_badges',
        visible: true,
        trust_badges: {
          items: [
            { title: 'Badge <script>alert(4)</script>', description: 'Desc <img src=x onerror=alert(5)>' },
            { title: '   ', description: '   ' },
          ],
        },
      },
      { id: 'sec_catalog', type: 'product_grid', visible: true },
      {
        id: 'sec_faq_xss',
        type: 'faq',
        visible: true,
        faq: {
          title: 'FAQ <script>evil()</script>',
          items: [
            {
              question: 'How? <img src=x onerror=alert(6)>',
              answer: 'Safe answer </details><script>alert(7)</script>',
            },
            {
              question: '  ',
              answer: 'Should be skipped because empty question',
            },
          ],
        },
      },
      { id: 'sec_footer', type: 'footer', visible: true },
    ],
    products: [
      {
        id: 'prod_01',
        is_active: true,
        title: 'Active Product',
        short_desc: 'Safe desc',
        price_usdt: 20,
        cover_url: '/src/assets/images/c1.jpg',
        category: 'Tools',
      },
      {
        id: 'prod_02',
        is_active: false,
        title: 'Inactive Product',
        short_desc: 'Hidden desc',
        price_usdt: 30,
        cover_url: '/src/assets/images/c2.jpg',
        category: 'Tools',
      },
    ],
  };

  const html = renderStorefrontHtml(store);

  assert.equal(html.includes('<img src=x onerror='), false);
  assert.equal(html.includes('<script>alert('), false);
  assert.equal(html.includes('<script>evil()</script>'), false);
  assert.equal(html.includes('</details><script>'), false);
  assert.equal(html.toLowerCase().includes('javascript:alert'), false);

  assert.equal(html.includes('href="#catalog-heading"'), true);
  assert.equal(html.includes('href="#prod_02"'), false);
  assert.equal(html.includes('<details class="faq-item">'), true);
  assert.equal(html.includes('<summary class="faq-summary">'), true);
  assert.equal(html.includes('Should be skipped because empty question'), false);
});

test('renderInvoicePageHtml renders /download/ link when paid', () => {
  const store: StoreConfig = {
    schema_version: 1,
    store_id: 'usr_111',
    owner_user_id: 'usr_111',
    slug: 'inv-check',
    created_at: '2026-11-22T00:00:00.000Z',
    meta: {
      title: 'Invoice Store',
      description: 'Desc',
      accent_preset: 'indigo',
      theme: 'dark',
    },
    profile: {
      name: 'Seller',
      bio: 'Bio text here.',
      avatar_url: '/src/assets/images/avatar.jpg',
      telegram: 'seller_tg',
    },
    products: [],
  };
  const invoice: CheckoutInvoice = {
    invoice_id: 'inv_abc123',
    store_id: 'usr_111',
    slug: 'inv-check',
    product_id: 'prod_01',
    product_title: 'Tool 1',
    buyer_email: 'buyer@example.com',
    amount_usdt: 25,
    network: 'USDT-TRC20',
    payment_address: 'T123456789NB',
    status: 'paid',
    created_at: '2026-11-22T00:00:00.000Z',
    delivery_token: 'tok_secret_99',
  };
  const html = renderInvoicePageHtml(invoice, store);
  assert.equal(html.includes('href="/download/tok_secret_99"'), true);
});

test('renderStoreNotFoundHtml escapes slug and includes create link', () => {
  const html = renderStoreNotFoundHtml('<bad>', '/create');
  assert.equal(html.includes('<bad>'), false);
  assert.equal(html.includes('&lt;bad&gt;'), true);
  assert.equal(html.includes('href="/create"'), true);
});
