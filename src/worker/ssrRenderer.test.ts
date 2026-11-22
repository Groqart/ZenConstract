import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  renderInvoicePageHtml,
  renderStorefrontHtml,
  renderStoreNotFoundHtml,
} from './ssrRenderer';
import type { CheckoutInvoice, StoreConfig } from './storeSchema';

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

test('renderStorefrontHtml hides inactive products and respects section order and visibility', () => {
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
      { id: 'sec_catalog', type: 'product_grid', visible: true },
      { id: 'sec_header', type: 'header', visible: true },
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
  assert.ok(html.indexOf('id="catalog-heading"') < html.indexOf('<header class="store-header">'));
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
