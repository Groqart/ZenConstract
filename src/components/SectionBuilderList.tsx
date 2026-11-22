import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  MAX_FAQ_ITEMS,
  MAX_STORE_SECTIONS,
  MAX_TRUST_BADGES,
  createDefaultSectionData,
  type StoreSection,
  type StoreSectionType,
} from '../worker/storeSchema';

const SECTION_LABELS: Record<StoreSectionType, string> = {
  header: 'Шапка магазина и профиль',
  hero_banner: 'Главный баннер-оффер',
  trust_badges: 'Блок преимуществ и гарантий',
  product_grid: 'Сетка цифровых товаров',
  faq: 'Частые вопросы (FAQ)',
  footer: 'Подвал витрины',
};

const ADDABLE_BLOCKS: { type: StoreSectionType; label: string }[] = [
  { type: 'hero_banner', label: '+ Баннер-оффер' },
  { type: 'trust_badges', label: '+ Преимущества' },
  { type: 'faq', label: '+ FAQ (вопросы)' },
];

interface ProductTargetOption {
  id: string;
  title: string;
  is_active: boolean;
}

interface SectionBuilderListProps {
  sections: StoreSection[];
  products: ProductTargetOption[];
  onChange: (next: StoreSection[]) => void;
}

function makeUniqueSectionId(type: StoreSectionType): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 6)
      : Math.random().toString(36).slice(2, 8);
  return `sec_${type}_${rand}`;
}

export function SectionBuilderList({
  sections,
  products,
  onChange,
}: SectionBuilderListProps) {
  const [armedDragId, setArmedDragId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: 'before' | 'after';
  } | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const isPinned = (type: StoreSectionType) => type === 'header' || type === 'footer';
  const isOptional = (type: StoreSectionType) =>
    type === 'hero_banner' || type === 'trust_badges' || type === 'faq';

  function toggleExpand(id: string) {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function addSection(type: StoreSectionType) {
    if (sections.length >= MAX_STORE_SECTIONS) return;
    const newId = makeUniqueSectionId(type);
    const defaults = createDefaultSectionData(type);
    const newSec: StoreSection = {
      id: newId,
      type,
      visible: true,
      ...defaults,
    };

    const next = [...sections];
    if (type === 'hero_banner') {
      const headerIdx = next.findIndex((s) => s.type === 'header');
      next.splice(headerIdx >= 0 ? headerIdx + 1 : 0, 0, newSec);
    } else {
      const footerIdx = next.findIndex((s) => s.type === 'footer');
      next.splice(footerIdx >= 0 ? footerIdx : next.length, 0, newSec);
    }

    onChange(next);
    setExpandedIds((prev) => ({ ...prev, [newId]: true }));
  }

  function removeSection(id: string) {
    onChange(sections.filter((s) => s.id !== id));
  }

  function updateSection(id: string, updater: (sec: StoreSection) => StoreSection) {
    onChange(sections.map((s) => (s.id === id ? updater(s) : s)));
  }

  function moveSection(index: number, delta: -1 | 1) {
    const target = index + delta;
    const minIdx = sections[0]?.type === 'header' ? 1 : 0;
    const maxIdx =
      sections[sections.length - 1]?.type === 'footer'
        ? sections.length - 2
        : sections.length - 1;
    if (target < minIdx || target > maxIdx) return;

    const next = [...sections];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange(next);
  }

  function handleDragStart(e: React.DragEvent<HTMLDivElement>, sec: StoreSection) {
    if (isPinned(sec.type)) {
      e.preventDefault();
      return;
    }
    setDraggingId(sec.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sec.id);
  }

  function handleDragOver(
    e: React.DragEvent<HTMLDivElement>,
    index: number,
    sec: StoreSection
  ) {
    if (!draggingId || isPinned(sec.type) || draggingId === sec.id) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const position: 'before' | 'after' =
      e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

    if (
      dropTarget?.index !== index ||
      dropTarget?.position !== position
    ) {
      setDropTarget({ index, position });
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (!draggingId || !dropTarget) {
      setDraggingId(null);
      setDropTarget(null);
      setArmedDragId(null);
      return;
    }

    const fromIndex = sections.findIndex((s) => s.id === draggingId);
    if (fromIndex === -1) {
      setDraggingId(null);
      setDropTarget(null);
      setArmedDragId(null);
      return;
    }

    let insertIndex =
      dropTarget.position === 'before' ? dropTarget.index : dropTarget.index + 1;
    if (fromIndex < insertIndex) {
      insertIndex -= 1;
    }

    const minIdx = sections[0]?.type === 'header' ? 1 : 0;
    const maxIdx =
      sections[sections.length - 1]?.type === 'footer'
        ? sections.length - 2
        : sections.length - 1;
    const clampedIndex = Math.max(minIdx, Math.min(maxIdx, insertIndex));

    const next = [...sections];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(clampedIndex, 0, moved);
    onChange(next);

    setDraggingId(null);
    setDropTarget(null);
    setArmedDragId(null);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDropTarget(null);
    setArmedDragId(null);
  }

  const activeProducts = products.filter((p) => p.is_active);
  const minMovableIdx = sections[0]?.type === 'header' ? 1 : 0;
  const maxMovableIdx =
    sections[sections.length - 1]?.type === 'footer'
      ? sections.length - 2
      : sections.length - 1;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            3. Модульная структура и Drag-and-Drop ({sections.length} / {MAX_STORE_SECTIONS})
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Перетаскивайте блоки за иконку захвата или используйте кнопки «Вверх / Вниз». Шапка и подвал закреплены.
          </p>
        </div>
      </div>

      {/* Add Block Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
          <Plus className="h-3.5 w-3.5" />
          <span>Добавить блок:</span>
        </span>
        {ADDABLE_BLOCKS.map((blk) => (
          <button
            key={blk.type}
            type="button"
            disabled={sections.length >= MAX_STORE_SECTIONS}
            onClick={() => addSection(blk.type)}
            className="min-h-[38px] whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:border-indigo-400 hover:bg-indigo-50/40 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {blk.label}
          </button>
        ))}
      </div>

      <div
        className="mt-4 space-y-2.5"
        onDragOver={(e) => {
          if (draggingId) e.preventDefault();
        }}
        onDrop={handleDrop}
      >
        {sections.map((sec, idx) => {
          const pinned = isPinned(sec.type);
          const optional = isOptional(sec.type);
          const expanded = Boolean(expandedIds[sec.id]);
          const isBeingDragged = draggingId === sec.id;
          const showDropBefore =
            dropTarget?.index === idx && dropTarget.position === 'before' && !pinned;
          const showDropAfter =
            dropTarget?.index === idx && dropTarget.position === 'after' && !pinned;

          return (
            <div key={sec.id} className="relative">
              {showDropBefore && (
                <div
                  aria-hidden="true"
                  className="mb-1.5 h-0.5 w-full rounded-full bg-indigo-600"
                />
              )}

              <div
                draggable={!pinned && armedDragId === sec.id}
                onDragStart={(e) => handleDragStart(e, sec)}
                onDragOver={(e) => handleDragOver(e, idx, sec)}
                onDragEnd={handleDragEnd}
                className={`rounded-xl border transition-opacity duration-150 ${
                  isBeingDragged
                    ? 'border-indigo-400 bg-indigo-50/40 opacity-50'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div
                  className={`flex flex-col justify-between gap-2.5 px-3.5 py-3 sm:flex-row sm:items-center sm:gap-3 ${
                    draggingId && !isBeingDragged ? 'pointer-events-none' : ''
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {!pinned ? (
                      <button
                        type="button"
                        aria-label={`Перетащить секцию ${SECTION_LABELS[sec.type]}`}
                        onPointerDown={() => setArmedDragId(sec.id)}
                        onPointerUp={() => setArmedDragId(null)}
                        onMouseDown={() => setArmedDragId(sec.id)}
                        className="hidden min-h-[44px] min-w-[44px] shrink-0 cursor-grab items-center justify-center rounded-lg border border-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-700 active:cursor-grabbing sm:inline-flex"
                      >
                        <GripVertical className="h-4 w-4" />
                      </button>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="hidden min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-xs font-medium text-slate-400 sm:inline-flex"
                      >
                        ·
                      </span>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {SECTION_LABELS[sec.type]}
                        </span>
                        {pinned && (
                          <span className="text-[11px] font-medium text-slate-500">
                            · Закреплена
                          </span>
                        )}
                      </div>
                      <div className="truncate font-mono text-[11px] text-slate-500">
                        {sec.id} · {sec.type}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!pinned && (
                      <>
                        <button
                          type="button"
                          onClick={() => moveSection(idx, -1)}
                          disabled={idx <= minMovableIdx}
                          aria-label={`Поднять секцию ${SECTION_LABELS[sec.type]}`}
                          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(idx, 1)}
                          disabled={idx >= maxMovableIdx}
                          aria-label={`Опустить секцию ${SECTION_LABELS[sec.type]}`}
                          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        updateSection(sec.id, (cur) => ({ ...cur, visible: !cur.visible }))
                      }
                      aria-label={`Переключить видимость ${SECTION_LABELS[sec.type]}`}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${
                        sec.visible
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-white text-slate-500'
                      }`}
                    >
                      {sec.visible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                      <span>{sec.visible ? 'Показана' : 'Скрыта'}</span>
                    </button>

                    {optional && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleExpand(sec.id)}
                          aria-expanded={expanded}
                          aria-label={`Редактировать блок ${SECTION_LABELS[sec.type]}`}
                          className="inline-flex min-h-[40px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <span>Контент</span>
                          {expanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSection(sec.id)}
                          aria-label={`Удалить секцию ${SECTION_LABELS[sec.type]}`}
                          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline Content Editors for Optional Conversion Blocks */}
                {optional && expanded && (
                  <div className="border-t border-slate-200 bg-white p-4">
                    {sec.type === 'hero_banner' && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label
                            htmlFor={`${sec.id}-headline`}
                            className="mb-1 flex items-center justify-between text-xs font-medium text-slate-700"
                          >
                            <span>Заголовок оффера (до 80 символов)</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {(sec.hero_banner?.headline || '').length}/80
                            </span>
                          </label>
                          <input
                            id={`${sec.id}-headline`}
                            type="text"
                            maxLength={80}
                            value={sec.hero_banner?.headline || ''}
                            onChange={(e) =>
                              updateSection(sec.id, (cur) => ({
                                ...cur,
                                hero_banner: {
                                  headline: e.target.value,
                                  subheadline: cur.hero_banner?.subheadline || '',
                                  cta_label: cur.hero_banner?.cta_label || 'Смотреть каталог',
                                  cta_target: cur.hero_banner?.cta_target || '#catalog-heading',
                                },
                              }))
                            }
                            className="min-h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label
                            htmlFor={`${sec.id}-subheadline`}
                            className="mb-1 flex items-center justify-between text-xs font-medium text-slate-700"
                          >
                            <span>Подзаголовок (до 160 символов)</span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {(sec.hero_banner?.subheadline || '').length}/160
                            </span>
                          </label>
                          <input
                            id={`${sec.id}-subheadline`}
                            type="text"
                            maxLength={160}
                            value={sec.hero_banner?.subheadline || ''}
                            onChange={(e) =>
                              updateSection(sec.id, (cur) => ({
                                ...cur,
                                hero_banner: {
                                  headline: cur.hero_banner?.headline || '',
                                  subheadline: e.target.value,
                                  cta_label: cur.hero_banner?.cta_label || 'Смотреть каталог',
                                  cta_target: cur.hero_banner?.cta_target || '#catalog-heading',
                                },
                              }))
                            }
                            className="min-h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`${sec.id}-cta-label`}
                            className="mb-1 block text-xs font-medium text-slate-700"
                          >
                            Текст кнопки CTA
                          </label>
                          <input
                            id={`${sec.id}-cta-label`}
                            type="text"
                            maxLength={40}
                            value={sec.hero_banner?.cta_label || ''}
                            onChange={(e) =>
                              updateSection(sec.id, (cur) => ({
                                ...cur,
                                hero_banner: {
                                  headline: cur.hero_banner?.headline || '',
                                  subheadline: cur.hero_banner?.subheadline || '',
                                  cta_label: e.target.value,
                                  cta_target: cur.hero_banner?.cta_target || '#catalog-heading',
                                },
                              }))
                            }
                            className="min-h-[42px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`${sec.id}-cta-target`}
                            className="mb-1 block text-xs font-medium text-slate-700"
                          >
                            Целевой блок или товар
                          </label>
                          <select
                            id={`${sec.id}-cta-target`}
                            value={sec.hero_banner?.cta_target || '#catalog-heading'}
                            onChange={(e) =>
                              updateSection(sec.id, (cur) => ({
                                ...cur,
                                hero_banner: {
                                  headline: cur.hero_banner?.headline || '',
                                  subheadline: cur.hero_banner?.subheadline || '',
                                  cta_label: cur.hero_banner?.cta_label || 'Смотреть каталог',
                                  cta_target: e.target.value,
                                },
                              }))
                            }
                            className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                          >
                            <option value="#catalog-heading">Якорь: #catalog-heading (Каталог)</option>
                            {activeProducts.map((p) => (
                              <option key={p.id} value={`#${p.id}`}>
                                Товар: {p.title} (#{p.id})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {sec.type === 'trust_badges' && (
                      <div className="space-y-3">
                        {(sec.trust_badges?.items || []).map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-700">
                                Преимущество #{itemIdx + 1}
                              </span>
                              {(sec.trust_badges?.items.length || 0) > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSection(sec.id, (cur) => ({
                                      ...cur,
                                      trust_badges: {
                                        items: (cur.trust_badges?.items || []).filter(
                                          (_, i) => i !== itemIdx
                                        ),
                                      },
                                    }))
                                  }
                                  className="text-xs font-medium text-red-600 hover:underline"
                                >
                                  Убрать
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <input
                                type="text"
                                maxLength={60}
                                value={item.title}
                                placeholder="Заголовок преимущества"
                                aria-label={`Заголовок преимущества ${itemIdx + 1}`}
                                onChange={(e) =>
                                  updateSection(sec.id, (cur) => ({
                                    ...cur,
                                    trust_badges: {
                                      items: (cur.trust_badges?.items || []).map((it, i) =>
                                        i === itemIdx ? { ...it, title: e.target.value } : it
                                      ),
                                    },
                                  }))
                                }
                                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                              />
                              <input
                                type="text"
                                maxLength={140}
                                value={item.description}
                                placeholder="Короткий факт или гарантия"
                                aria-label={`Описание преимущества ${itemIdx + 1}`}
                                onChange={(e) =>
                                  updateSection(sec.id, (cur) => ({
                                    ...cur,
                                    trust_badges: {
                                      items: (cur.trust_badges?.items || []).map((it, i) =>
                                        i === itemIdx ? { ...it, description: e.target.value } : it
                                      ),
                                    },
                                  }))
                                }
                                className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                              />
                            </div>
                          </div>
                        ))}

                        {(sec.trust_badges?.items.length || 0) < MAX_TRUST_BADGES && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSection(sec.id, (cur) => ({
                                ...cur,
                                trust_badges: {
                                  items: [
                                    ...(cur.trust_badges?.items || []),
                                    { title: '', description: '' },
                                  ],
                                },
                              }))
                            }
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>
                              Добавить карточку ({sec.trust_badges?.items.length || 0}/{MAX_TRUST_BADGES})
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {sec.type === 'faq' && (
                      <div className="space-y-3">
                        <div>
                          <label
                            htmlFor={`${sec.id}-faq-title`}
                            className="mb-1 block text-xs font-medium text-slate-700"
                          >
                            Заголовок секции FAQ
                          </label>
                          <input
                            id={`${sec.id}-faq-title`}
                            type="text"
                            maxLength={80}
                            value={sec.faq?.title || 'Частые вопросы'}
                            onChange={(e) =>
                              updateSection(sec.id, (cur) => ({
                                ...cur,
                                faq: {
                                  title: e.target.value,
                                  items: cur.faq?.items || [],
                                },
                              }))
                            }
                            className="min-h-[40px] w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900 focus:border-indigo-600 focus:outline-none"
                          />
                        </div>

                        {(sec.faq?.items || []).map((item, itemIdx) => (
                          <div
                            key={itemIdx}
                            className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-700">
                                Вопрос #{itemIdx + 1}
                              </span>
                              {(sec.faq?.items.length || 0) > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSection(sec.id, (cur) => ({
                                      ...cur,
                                      faq: {
                                        title: cur.faq?.title || 'Частые вопросы',
                                        items: (cur.faq?.items || []).filter(
                                          (_, i) => i !== itemIdx
                                        ),
                                      },
                                    }))
                                  }
                                  className="text-xs font-medium text-red-600 hover:underline"
                                >
                                  Удалить
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              maxLength={120}
                              value={item.question}
                              placeholder="Вопрос покупателя"
                              aria-label={`Вопрос FAQ ${itemIdx + 1}`}
                              onChange={(e) =>
                                updateSection(sec.id, (cur) => ({
                                  ...cur,
                                  faq: {
                                    title: cur.faq?.title || 'Частые вопросы',
                                    items: (cur.faq?.items || []).map((it, i) =>
                                      i === itemIdx ? { ...it, question: e.target.value } : it
                                    ),
                                  },
                                }))
                              }
                              className="min-h-[40px] w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                            />
                            <textarea
                              rows={2}
                              maxLength={400}
                              value={item.answer}
                              placeholder="Ответ на вопрос (рендерится на нативном <details>/<summary> без JS)"
                              aria-label={`Ответ FAQ ${itemIdx + 1}`}
                              onChange={(e) =>
                                updateSection(sec.id, (cur) => ({
                                  ...cur,
                                  faq: {
                                    title: cur.faq?.title || 'Частые вопросы',
                                    items: (cur.faq?.items || []).map((it, i) =>
                                      i === itemIdx ? { ...it, answer: e.target.value } : it
                                    ),
                                  },
                                }))
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-600 focus:outline-none"
                            />
                          </div>
                        ))}

                        {(sec.faq?.items.length || 0) < MAX_FAQ_ITEMS && (
                          <button
                            type="button"
                            onClick={() =>
                              updateSection(sec.id, (cur) => ({
                                ...cur,
                                faq: {
                                  title: cur.faq?.title || 'Частые вопросы',
                                  items: [
                                    ...(cur.faq?.items || []),
                                    { question: '', answer: '' },
                                  ],
                                },
                              }))
                            }
                            className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>
                              Добавить вопрос ({sec.faq?.items.length || 0}/{MAX_FAQ_ITEMS})
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showDropAfter && (
                <div
                  aria-hidden="true"
                  className="mt-1.5 h-0.5 w-full rounded-full bg-indigo-600"
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
