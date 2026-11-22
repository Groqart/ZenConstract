import React, { useEffect, useState } from 'react';
import { Check, Copy, Lock, ShieldCheck } from 'lucide-react';
import type { DeliverySecret, StoreConfig } from '../worker/storeSchema';

interface InspectPayload {
  public_kv_key: string;
  public_kv_value: StoreConfig;
  private_deliveries: DeliverySecret[];
  ssr_metrics: {
    html_bytes: number;
    render_ms: number;
    client_js_framework: string;
  };
  ssr_html_preview: string;
}

interface WorkerBundle {
  wrangler_toml: string;
  index_ts: string;
}

interface ArchitectureInspectorProps {
  stores: StoreConfig[];
  selectedSlug: string;
  onSelectSlug: (slug: string) => void;
}

type InspectorView = 'kv-split' | 'ssr-html' | 'worker-code';

export function ArchitectureInspector({
  stores,
  selectedSlug,
  onSelectSlug,
}: ArchitectureInspectorProps) {
  const [inspectData, setInspectData] = useState<InspectPayload | null>(null);
  const [bundle, setBundle] = useState<WorkerBundle | null>(null);
  const [view, setView] = useState<InspectorView>('kv-split');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const activeSlug = selectedSlug || stores[0]?.slug || 'alpha-scripts';

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetch(`/api/stores/${encodeURIComponent(activeSlug)}/inspect`).then((r) => r.json()),
      fetch('/api/worker-bundle').then((r) => r.json()),
    ])
      .then(([ins, bnd]) => {
        if (!active) return;
        if (ins && ins.public_kv_value) {
          setInspectData(ins);
        }
        if (bnd && bnd.index_ts) {
          setBundle(bnd);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeSlug]);

  function handleCopy(id: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  return (
    <div className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Архитектура KV, безопасность и код Worker
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Инспектор реального разделения публичных данных витрины и секретных ключей выдачи цифровых товаров.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="inspect-store-select" className="text-xs font-semibold text-slate-500">
            Объект KV:
          </label>
          <select
            id="inspect-store-select"
            value={activeSlug}
            onChange={(e) => onSelectSlug(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
          >
            {stores.map((s) => (
              <option key={s.slug} value={s.slug}>
                store:{s.slug}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics Strip */}
      {inspectData && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Размер SSR HTML</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
              {(inspectData.ssr_metrics.html_bytes / 1024).toFixed(2)} KB
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Время генерации на Edge</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
              {inspectData.ssr_metrics.render_ms.toFixed(2)} ms
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Клиентский фреймворк</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {inspectData.ssr_metrics.client_js_framework}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Изолированные секреты R2</div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900">
              {inspectData.private_deliveries.length} ключей
            </div>
          </div>
        </div>
      )}

      {/* Sub-navigation tabs */}
      <div className="mb-6 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setView('kv-split')}
          className={`min-h-[38px] whitespace-nowrap rounded-md px-4 text-xs font-semibold transition-colors ${
            view === 'kv-split' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Разделение KV (Public vs Private)
        </button>
        <button
          type="button"
          onClick={() => setView('ssr-html')}
          className={`min-h-[38px] whitespace-nowrap rounded-md px-4 text-xs font-semibold transition-colors ${
            view === 'ssr-html' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Выходной SSR HTML
        </button>
        <button
          type="button"
          onClick={() => setView('worker-code')}
          className={`min-h-[38px] whitespace-nowrap rounded-md px-4 text-xs font-semibold transition-colors ${
            view === 'worker-code' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Cloudflare Worker (index.ts & wrangler.toml)
        </button>
      </div>

      {loading && !inspectData && (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Загрузка конфигурации KV...
        </div>
      )}

      {view === 'kv-split' && inspectData && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <h2 className="font-mono text-sm font-semibold text-slate-900">
                  {inspectData.public_kv_key}
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopy('pub-kv', JSON.stringify(inspectData.public_kv_value, null, 2))
                }
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {copiedId === 'pub-kv' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedId === 'pub-kv' ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Доступно для быстрого Edge-рендера витрины. Не содержит приватных путей R2 и ключей доставки.
            </p>
            <pre className="max-h-[520px] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
              {JSON.stringify(inspectData.public_kv_value, null, 2)}
            </pre>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-600" />
                <h2 className="font-mono text-sm font-semibold text-slate-900">
                  delivery:{inspectData.public_kv_value.store_id}:*
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopy('priv-kv', JSON.stringify(inspectData.private_deliveries, null, 2))
                }
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {copiedId === 'priv-kv' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedId === 'priv-kv' ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Доступно только серверу (PAYMENT_SERVICE / DELIVERY_KV) после подтверждения оплаты по вебхуку.
            </p>
            <pre className="max-h-[520px] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-amber-100">
              {JSON.stringify(inspectData.private_deliveries, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {view === 'ssr-html' && inspectData && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Сгенерированный HTML для /s/{activeSlug} (XSS-экранированный)
            </h2>
            <button
              type="button"
              onClick={() => handleCopy('ssr-html', inspectData.ssr_html_preview)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {copiedId === 'ssr-html' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedId === 'ssr-html' ? 'Скопировано' : 'Копировать HTML'}</span>
            </button>
          </div>
          <pre className="max-h-[560px] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-200">
            {inspectData.ssr_html_preview}
          </pre>
        </div>
      )}

      {view === 'worker-code' && bundle && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-mono text-sm font-semibold text-slate-900">wrangler.toml</h2>
              <button
                type="button"
                onClick={() => handleCopy('wrangler', bundle.wrangler_toml)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {copiedId === 'wrangler' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedId === 'wrangler' ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <pre className="max-h-[540px] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
              {bundle.wrangler_toml}
            </pre>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-7">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-mono text-sm font-semibold text-slate-900">
                storefront-worker/src/index.ts
              </h2>
              <button
                type="button"
                onClick={() => handleCopy('worker-ts', bundle.index_ts)}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {copiedId === 'worker-ts' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedId === 'worker-ts' ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>
            <pre className="max-h-[540px] overflow-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">
              {bundle.index_ts}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
