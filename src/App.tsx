import React, { useCallback, useEffect, useState } from 'react';
import { TopBar, type ActiveTab } from './components/TopBar';
import { StorefrontPlayground } from './components/StorefrontPlayground';
import { StoreBuilder } from './components/StoreBuilder';
import { ArchitectureInspector } from './components/ArchitectureInspector';
import type { StoreConfig } from './worker/storeSchema';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('storefront');
  const [stores, setStores] = useState<StoreConfig[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>('alpha-scripts');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStores = useCallback(async (preferSlug?: string) => {
    setLoadError(null);
    try {
      const res = await fetch('/api/stores');
      if (!res.ok) throw new Error('Не удалось загрузить витрины из KV.');
      const data = await res.json();
      const list: StoreConfig[] = Array.isArray(data.stores) ? data.stores : [];
      setStores(list);
      if (preferSlug) {
        setSelectedSlug(preferSlug);
      } else if (list.length > 0 && !list.some((s) => s.slug === selectedSlug)) {
        setSelectedSlug(list[0].slug);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Ошибка загрузки.');
    } finally {
      setLoading(false);
    }
  }, [selectedSlug]);

  useEffect(() => {
    loadStores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleStorePublished(newStore: StoreConfig) {
    setStores((prev) => [newStore, ...prev.filter((s) => s.slug !== newStore.slug)]);
    setSelectedSlug(newStore.slug);
    setActiveTab('storefront');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar activeTab={activeTab} onSelectTab={setActiveTab} />

      <main>
        {loading ? (
          <div className="mx-auto max-w-[1360px] px-4 py-12 sm:px-6 lg:px-8">
            <div className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          </div>
        ) : loadError ? (
          <div className="mx-auto max-w-xl px-4 py-16 text-center">
            <p className="text-sm font-medium text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={() => loadStores()}
              className="mt-4 min-h-[44px] rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              Повторить
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'storefront' && (
              <StorefrontPlayground
                stores={stores}
                selectedSlug={selectedSlug}
                onSelectSlug={setSelectedSlug}
                onOpenBuilder={() => setActiveTab('builder')}
              />
            )}
            {activeTab === 'builder' && (
              <StoreBuilder onStorePublished={handleStorePublished} />
            )}
            {activeTab === 'architecture' && (
              <ArchitectureInspector
                stores={stores}
                selectedSlug={selectedSlug}
                onSelectSlug={setSelectedSlug}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
