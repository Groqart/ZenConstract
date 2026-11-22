import React, { useCallback, useEffect, useState } from 'react';
import { TopBar, type ActiveTab } from './components/TopBar';
import { StorefrontPlayground } from './components/StorefrontPlayground';
import { StoreBuilder } from './components/StoreBuilder';
import { ArchitectureInspector } from './components/ArchitectureInspector';
import { SellerAuthModal, type SellerAccount } from './components/SellerAuthModal';
import type { StoreConfig } from './worker/storeSchema';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('storefront');
  const [stores, setStores] = useState<StoreConfig[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>('alpha-scripts');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Seller Bearer token kept strictly in React JS memory (never localStorage)
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<SellerAccount | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

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

  const ownedStores = currentUser
    ? stores.filter((s) => s.owner_user_id === currentUser.user_id)
    : [];

  function handleAuthenticated(token: string, user: SellerAccount, userStores: StoreConfig[]) {
    setAuthToken(token);
    setCurrentUser(user);
    if (userStores.length > 0) {
      setEditingSlug(userStores[0].slug);
    } else {
      setEditingSlug(null);
    }
  }

  function handleLogout() {
    setAuthToken(null);
    setCurrentUser(null);
    setEditingSlug(null);
  }

  function handleStorePublished(savedStore: StoreConfig) {
    setStores((prev) => [savedStore, ...prev.filter((s) => s.slug !== savedStore.slug)]);
    setSelectedSlug(savedStore.slug);
    setEditingSlug(savedStore.slug);
    setActiveTab('storefront');
  }

  function handleEditStore(slug: string) {
    setEditingSlug(slug);
    setActiveTab('builder');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        currentUser={currentUser}
        onOpenAuthModal={() => setAuthModalOpen(true)}
      />

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
              <StoreBuilder
                authToken={authToken}
                currentUser={currentUser}
                ownedStores={ownedStores}
                editingSlug={editingSlug}
                onSelectEditingSlug={setEditingSlug}
                onRequireAuth={() => setAuthModalOpen(true)}
                onStorePublished={handleStorePublished}
              />
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

      <SellerAuthModal
        open={authModalOpen}
        currentUser={currentUser}
        ownedStores={ownedStores}
        onClose={() => setAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
        onLogout={handleLogout}
        onEditStore={handleEditStore}
      />
    </div>
  );
}
