import React, { useState } from 'react';
import { CheckCircle2, Download, Mail, ShieldCheck, X } from 'lucide-react';
import type { CheckoutInvoice, StoreProduct } from '../worker/storeSchema';

interface DeliveryOutcome {
  token: string;
  download_url: string;
  expires_at: string;
  downloads_used: number;
  max_downloads: number;
  file_name: string;
  r2_object_key: string;
  email_provider?: string;
  email_preview: {
    to: string;
    subject: string;
    body: string;
  };
}

interface CheckoutModalProps {
  slug: string;
  product: StoreProduct | null;
  accentHex: string;
  onClose: () => void;
}

export function CheckoutModal({ slug, product, accentHex, onClose }: CheckoutModalProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<CheckoutInvoice | null>(null);
  const [delivery, setDelivery] = useState<DeliveryOutcome | null>(null);

  if (!product) return null;

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Security: client sends ONLY slug, product_id, and email; price is read from KV on server
        body: JSON.stringify({
          slug,
          product_id: product.id,
          email: email.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Не удалось создать инвойс.');
      }
      setInvoice(data.invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка соединения с сервером.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSimulatePayment() {
    if (!invoice) return;
    setError(null);
    setConfirming(true);
    try {
      const res = await fetch('/api/payment/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoice.invoice_id }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ошибка подтверждения вебхука.');
      }
      setInvoice(data.invoice);
      setDelivery(data.delivery);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обработать платеж.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="checkout-modal-title" className="text-lg font-bold text-slate-900">
              {delivery
                ? 'Оплата подтверждена'
                : invoice
                  ? `Крипто-инвойс ${invoice.invoice_id}`
                  : 'Быстрый чекаут'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {slug}.nexusbyte.de5.net · Service Binding PAYMENT_SERVICE
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно чекаута"
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">{product.title}</div>
          <div className="mt-1 flex items-center justify-between text-sm text-slate-600">
            <span>Серверная цена (KV)</span>
            <span className="font-mono font-semibold tabular-nums text-slate-900">
              {(invoice ? invoice.amount_usdt : product.price_usdt).toFixed(2)} USDT
            </span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {!invoice && (
          <form onSubmit={handleCreateInvoice} className="space-y-4">
            <div>
              <label htmlFor="checkout-email-input" className="mb-1.5 block text-sm font-medium text-slate-800">
                Email покупателя
              </label>
              <input
                id="checkout-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="buyer@example.com"
                autoFocus
                className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                На этот адрес уйдёт одноразовая ссылка на скачивание архива из R2 после оплаты.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Цена берётся строго на сервере из KV — подмена невозможна.</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{ backgroundColor: accentHex }}
              className="min-h-[46px] w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              {submitting ? 'Создание инвойса...' : 'Перейти к оплате'}
            </button>
          </form>
        )}

        {invoice && !delivery && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-slate-100">
              <div className="mb-1 text-xs text-slate-400">Адрес для перевода ({invoice.network})</div>
              <div className="break-all font-mono text-xs leading-relaxed text-white">
                {invoice.payment_address}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2.5 text-xs">
                <span className="text-slate-400">Email доставки:</span>
                <span className="font-mono text-slate-200">{invoice.buyer_email}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={confirming}
                onClick={handleSimulatePayment}
                className="min-h-[46px] w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {confirming ? 'Обработка вебхука...' : 'Подтвердить оплату USDT (Webhook)'}
              </button>
              <a
                href={`/pay/${invoice.invoice_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Открыть отдельную страницу инвойса (/pay/{invoice.invoice_id})
              </a>
            </div>
          </div>
        )}

        {invoice && delivery && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Товар выдан и письмо отправлено</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-emerald-800">
                {delivery.email_preview.body}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
              <div className="mb-1 flex items-center justify-between gap-1.5 font-medium text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span>Resend → {delivery.email_preview.to}</span>
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  Лимит: {delivery.max_downloads} ск.
                </span>
              </div>
              <div className="truncate font-mono text-[11px] text-slate-500">
                PRIVATE_PRODUCTS_R2: {delivery.r2_object_key}
              </div>
            </div>

            <a
              href={delivery.download_url}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              <span>Скачать {delivery.file_name}</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
