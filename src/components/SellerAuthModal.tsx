import React, { useEffect, useState } from 'react';
import { LogOut, ShieldCheck, Store, UserCheck, X } from 'lucide-react';
import type { StoreConfig } from '../worker/storeSchema';

export interface SellerAccount {
  user_id: string;
  email: string;
  name: string;
  role: 'seller';
}

interface SellerAuthModalProps {
  open: boolean;
  currentUser: SellerAccount | null;
  ownedStores: StoreConfig[];
  onClose: () => void;
  onAuthenticated: (token: string, user: SellerAccount, stores: StoreConfig[]) => void;
  onLogout: () => void;
  onEditStore: (slug: string) => void;
}

export function SellerAuthModal({
  open,
  currentUser,
  ownedStores,
  onClose,
  onAuthenticated,
  onLogout,
  onEditStore,
}: SellerAuthModalProps) {
  const [demoAccounts, setDemoAccounts] = useState<SellerAccount[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch('/api/auth/demo-accounts')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.accounts)) {
          setDemoAccounts(d.accounts);
        }
      })
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  async function loginWithDemo(userId: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка входа.');
      onAuthenticated(data.token, data.user, data.stores || []);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа.');
    } finally {
      setLoading(false);
    }
  }

  async function loginWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка авторизации.');
      onAuthenticated(data.token, data.user, data.stores || []);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-modal-title" className="text-lg font-bold text-slate-900">
              {currentUser ? 'Аккаунт продавца ZenxusBay' : 'Вход в кабинет продавца'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Токен сессии хранится в памяти (Bearer JWT) и защищает R2 и поддомены.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно аккаунта"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {currentUser ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                <span>{currentUser.name}</span>
              </div>
              <div className="mt-1 font-mono text-xs text-slate-600">
                {currentUser.email} · {currentUser.user_id}
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold text-slate-500">
                Мои магазины ({ownedStores.length})
              </h3>
              {ownedStores.length === 0 ? (
                <p className="rounded-lg border border-slate-200 p-3 text-xs text-slate-500">
                  У этого аккаунта пока нет витрин. Создайте первую в конструкторе.
                </p>
              ) : (
                <div className="space-y-2">
                  {ownedStores.map((st) => (
                    <div
                      key={st.slug}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3.5 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{st.meta.title}</div>
                        <div className="font-mono text-xs text-slate-500">{st.slug}.nexusbyte.de5.net</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onEditStore(st.slug);
                          onClose();
                        }}
                        className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        <Store className="h-3.5 w-3.5" />
                        <span>Редактировать</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="mb-2 text-xs font-medium text-slate-500">Переключить аккаунт:</div>
              <div className="flex flex-wrap gap-2">
                {demoAccounts
                  .filter((a) => a.user_id !== currentUser.user_id)
                  .map((acc) => (
                    <button
                      key={acc.user_id}
                      type="button"
                      disabled={loading}
                      onClick={() => loginWithDemo(acc.user_id)}
                      className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Войти как {acc.name}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onClose();
                  }}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Выйти</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-600">
                Быстрый вход (аккаунты ZenxusBay):
              </div>
              <div className="grid grid-cols-1 gap-2">
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.user_id}
                    type="button"
                    disabled={loading}
                    onClick={() => loginWithDemo(acc.user_id)}
                    className="flex min-h-[44px] items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-left transition-colors hover:border-indigo-400 hover:bg-indigo-50/40"
                  >
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{acc.name}</div>
                      <div className="font-mono text-xs text-slate-500">
                        {acc.email} · {acc.user_id}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-indigo-600">Войти</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={loginWithEmail} className="space-y-3 border-t border-slate-200 pt-4">
              <div className="text-xs font-semibold text-slate-600">Или по новому Email:</div>
              <div>
                <label htmlFor="auth-email" className="mb-1 block text-xs font-medium text-slate-700">
                  Email продавца
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seller@studio.dev"
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="auth-name" className="mb-1 block text-xs font-medium text-slate-700">
                  Имя / Студия
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Edge Studio"
                  className="min-h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Чужие магазины защищены проверкой owner_user_id (403 Forbidden).</span>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="min-h-[44px] w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? 'Авторизация...' : 'Продолжить с Email'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
