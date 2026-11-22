import React from 'react';

export type ActiveTab = 'storefront' | 'builder' | 'architecture';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export function TopBar({ activeTab, onSelectTab }: TopBarProps) {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'storefront', label: 'Витрина' },
    { id: 'builder', label: 'Конструктор' },
    { id: 'architecture', label: 'Схема KV' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-3 px-4 py-3 sm:gap-8 sm:px-6 lg:px-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('storefront');
          }}
          className="shrink-0 whitespace-nowrap text-base font-bold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:text-lg"
        >
          NexusByte
        </a>

        <nav aria-label="Основная навигация" className="flex items-center gap-3 sm:gap-7">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative shrink-0 whitespace-nowrap py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:text-sm ${
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[13px] h-0.5 bg-indigo-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => onSelectTab('builder')}
          className="hidden shrink-0 whitespace-nowrap rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:inline-flex sm:min-h-[44px] sm:items-center"
        >
          Создать магазин
        </button>
      </div>
    </header>
  );
}
