import React, { useEffect, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { renderStorefrontHtml } from '../worker/ssrRenderer';
import type { StoreConfig } from '../worker/storeSchema';

interface StorefrontLivePreviewProps {
  previewStore: StoreConfig;
}

export function StorefrontLivePreview({ previewStore }: StorefrontLivePreviewProps) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [debouncedHtml, setDebouncedHtml] = useState<string>(() =>
    renderStorefrontHtml(previewStore, { homeUrl: '#top' })
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedHtml(renderStorefrontHtml(previewStore, { homeUrl: '#top' }));
    }, 120);
    return () => clearTimeout(timer);
  }, [previewStore]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Живой предпросмотр Edge SSR
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500">
            {previewStore.slug || 'slug'}.nexusbyte.de5.net
          </p>
        </div>

        <div
          className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1"
          role="group"
          aria-label="Ширина предпросмотра"
        >
          <button
            type="button"
            onClick={() => setViewport('desktop')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors ${
              viewport === 'desktop'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor className="h-3.5 w-3.5" />
            <span>Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setViewport('mobile')}
            className={`inline-flex min-h-[34px] items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors ${
              viewport === 'mobile'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>375px</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-slate-100 p-2">
        <div
          className={`mx-auto transition-all duration-200 ${
            viewport === 'mobile'
              ? 'w-[375px] max-w-full overflow-hidden rounded-2xl border-4 border-slate-800 bg-white shadow-lg'
              : 'w-full overflow-hidden rounded-lg border border-slate-200 bg-white'
          }`}
        >
          <iframe
            title="Предпросмотр витрины в реальном времени"
            srcDoc={debouncedHtml}
            sandbox="allow-scripts"
            className="block h-[560px] w-full bg-transparent"
          />
        </div>
      </div>
    </div>
  );
}
