import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderStorefrontHtml, renderStoreNotFoundHtml } from './ssrRenderer';
import type { StoreConfig } from './storeSchema';

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

test('renderStoreNotFoundHtml escapes slug and includes create link', () => {
  const html = renderStoreNotFoundHtml('<bad>', '/create');
  assert.equal(html.includes('<bad>'), false);
  assert.equal(html.includes('&lt;bad&gt;'), true);
  assert.equal(html.includes('href="/create"'), true);
});
