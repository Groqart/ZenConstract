import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STORE_SECTIONS,
  extractSlugFromHost,
  formatProductCountLabel,
  normalizeStoreSections,
  sanitizeSafeUrl,
  sanitizeTelegramHandle,
  validateCheckoutRequest,
  validateSlug,
  validateStoreInput,
} from './storeSchema';

test('validateSlug accepts valid lowercase alphanumeric hyphenated slugs', () => {
  assert.equal(validateSlug('alpha-scripts').valid, true);
  assert.equal(validateSlug('shop-01').valid, true);
});

test('validateSlug rejects reserved subdomains and invalid formats', () => {
  const adminRes = validateSlug('admin');
  assert.equal(adminRes.valid, false);
  assert.equal(adminRes.reason, 'reserved');

  const wwwRes = validateSlug('www');
  assert.equal(wwwRes.valid, false);
  assert.equal(wwwRes.reason, 'reserved');

  const downloadRes = validateSlug('download');
  assert.equal(downloadRes.valid, false);
  assert.equal(downloadRes.reason, 'reserved');

  assert.equal(validateSlug('ab').valid, false);
  assert.equal(validateSlug('-bad-slug').valid, false);
  assert.equal(validateSlug('bad.slug').valid, false);
  assert.equal(validateSlug('<script>').valid, false);
});

test('extractSlugFromHost parses subdomains, www redirects, and root host', () => {
  assert.deepEqual(extractSlugFromHost('alpha-scripts.nexusbyte.de5.net'), {
    type: 'store',
    slug: 'alpha-scripts',
  });
  assert.deepEqual(extractSlugFromHost('www.nexusbyte.de5.net:443'), {
    type: 'www_redirect',
  });
  assert.deepEqual(extractSlugFromHost('nexusbyte.de5.net'), {
    type: 'root',
  });
});

test('sanitizeSafeUrl blocks javascript and data schemes and allows /cdn/ paths', () => {
  assert.equal(sanitizeSafeUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeSafeUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(sanitizeSafeUrl('https://cdn.nexusbyte.de5.net/a.webp'), 'https://cdn.nexusbyte.de5.net/a.webp');
  assert.equal(sanitizeSafeUrl('/src/assets/images/test.jpg'), '/src/assets/images/test.jpg');
  assert.equal(sanitizeSafeUrl('/cdn/usr_98765/1234.webp'), '/cdn/usr_98765/1234.webp');
});

test('sanitizeTelegramHandle strips leading @ and rejects invalid handles', () => {
  assert.equal(sanitizeTelegramHandle('@alphadev_support'), 'alphadev_support');
  assert.equal(sanitizeTelegramHandle('alphadev_support'), 'alphadev_support');
  assert.equal(sanitizeTelegramHandle('bad handle!'), null);
});

test('normalizeStoreSections migrates missing sections and preserves custom order and visibility', () => {
  assert.deepEqual(normalizeStoreSections(undefined), DEFAULT_STORE_SECTIONS);
  const custom = normalizeStoreSections([
    { id: 'sec_catalog', type: 'product_grid', visible: true },
    { id: 'sec_header', type: 'header', visible: false },
  ]);
  assert.equal(custom.length, 3);
  assert.equal(custom[0].type, 'product_grid');
  assert.equal(custom[1].type, 'header');
  assert.equal(custom[1].visible, false);
  assert.equal(custom[2].type, 'footer');
  assert.equal(custom[2].visible, true);
});

test('validateStoreInput binds owner_user_id, preserves is_active, and separates private delivery keys', () => {
  const result = validateStoreInput(
    {
      slug: 'test-shop',
      meta: {
        title: 'Test Shop',
        description: 'Digital developer tools and scripts',
        accent_preset: 'emerald',
        theme: 'light',
      },
      profile: {
        name: 'Dev Seller',
        bio: 'Building automation tools since 2022.',
        avatar_url: '/cdn/usr_98765/avatar.webp',
        telegram: '@devseller',
      },
      products: [
        {
          title: 'Parser Bot',
          short_desc: 'Fast multi-threaded parser.',
          price_usdt: 39.5,
          cover_url: '/src/assets/images/cover.jpg',
          category: 'Automation',
          r2_object_key: 'usr_98765/parser-bot-v2.zip',
          is_active: false,
        },
      ],
    },
    { storeId: 'usr_98765', ownerUserId: 'usr_98765' }
  );

  assert.equal(result.ok, true);
  assert.ok(result.publicConfig);
  assert.ok(result.deliverySecrets);
  assert.equal(result.publicConfig.owner_user_id, 'usr_98765');
  assert.equal(result.publicConfig.products[0].is_active, false);
  assert.equal(result.publicConfig.profile.telegram, 'devseller');
  assert.equal(result.deliverySecrets.length, 1);
  assert.equal(result.deliverySecrets[0].r2_object_key, 'usr_98765/parser-bot-v2.zip');

  const publicJson = JSON.stringify(result.publicConfig);
  assert.equal(publicJson.includes('r2_object_key'), false);
});

test('validateCheckoutRequest requires valid product_id and email', () => {
  assert.equal(validateCheckoutRequest({ product_id: 'prod_01', email: 'buyer@example.com' }).ok, true);
  assert.equal(validateCheckoutRequest({ product_id: 'prod_01', email: 'not-an-email' }).ok, false);
  assert.equal(validateCheckoutRequest({ product_id: '../bad', email: 'buyer@example.com' }).ok, false);
});

test('formatProductCountLabel handles Russian plural forms correctly', () => {
  assert.equal(formatProductCountLabel(1), '1 позиция');
  assert.equal(formatProductCountLabel(2), '2 позиции');
  assert.equal(formatProductCountLabel(4), '4 позиции');
  assert.equal(formatProductCountLabel(5), '5 позиций');
  assert.equal(formatProductCountLabel(11), '11 позиций');
  assert.equal(formatProductCountLabel(21), '21 позиция');
});
