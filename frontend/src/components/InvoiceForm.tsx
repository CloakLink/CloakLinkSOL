'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createInvoice } from '@/lib/api';

type InvoiceFormProps = {
  profileId: string;
  defaultChain: string;
};

type FormState = {
  amount: string;
  tokenSymbol: string;
  tokenAddress: string;
  chain: string;
  description: string;
  slug: string;
};

const tokenOptions = ['USDC', 'USDT', 'WETH', 'DAI'];

export function InvoiceForm({ profileId, defaultChain }: InvoiceFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    amount: '',
    tokenSymbol: 'USDC',
    tokenAddress: '',
    chain: defaultChain,
    description: '',
    slug: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setFieldErrors({});

    const errors: Partial<Record<keyof FormState, string>> = {};
    const amountNumber = Number(form.amount);
    if (!form.amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      errors.amount = 'Enter a positive amount.';
    }
    if (form.slug && !/^[a-z0-9-]{3,}$/.test(form.slug)) {
      errors.slug = 'Slug must be lowercase letters, numbers, and dashes.';
    }
    if (!form.chain.trim()) {
      errors.chain = 'Chain is required.';
    }
    if (form.tokenAddress) {
      if (form.tokenAddress.startsWith('0x')) {
        errors.tokenAddress = 'Use a Solana Base58 address, not an 0x address.';
      } else if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(form.tokenAddress)) {
        errors.tokenAddress = 'Enter a valid Solana address (32-44 chars Base58).';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const payload = {
        amount: form.amount,
        tokenSymbol: form.tokenSymbol,
        tokenAddress: form.tokenAddress || undefined,
        chain: form.chain,
        description: form.description || undefined,
        slug: form.slug || undefined,
      };
      const invoice = await createInvoice(profileId, payload);
      setMessage(`Invoice created! Share /i/${invoice.slug}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Failed to create invoice. Check API connection and fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-slate-300">Amount</label>
        <input
          type="number"
          step="any"
          required
          value={form.amount}
          onChange={(e) => handleChange('amount', e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
        />
        {fieldErrors.amount && <p className="mt-1 text-sm text-red-400">{fieldErrors.amount}</p>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-300">SPL Token Symbol</label>
          <select
            value={form.tokenSymbol}
            onChange={(e) => handleChange('tokenSymbol', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
          >
            {tokenOptions.map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-slate-300">Token Mint (optional)</label>
          <input
            value={form.tokenAddress}
            onChange={(e) => handleChange('tokenAddress', e.target.value)}
            placeholder="Solana mint address"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
          />
          {fieldErrors.tokenAddress && (
            <p className="mt-1 text-sm text-red-400">{fieldErrors.tokenAddress}</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-slate-300">Chain</label>
          <input
            value={form.chain}
            onChange={(e) => handleChange('chain', e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
          />
          {fieldErrors.chain && <p className="mt-1 text-sm text-red-400">{fieldErrors.chain}</p>}
        </div>
      </div>
      <div>
        <label className="block text-sm text-slate-300">Slug (optional)</label>
        <input
          value={form.slug}
          onChange={(e) => handleChange('slug', e.target.value)}
          placeholder="e.g. landing-page-500-usdc"
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
        />
        {fieldErrors.slug && <p className="mt-1 text-sm text-red-400">{fieldErrors.slug}</p>}
        <p className="mt-1 text-xs text-slate-400">Preview: /i/{form.slug || `${form.tokenSymbol.toLowerCase()}-${form.amount || 'amount'}`}</p>
      </div>
      <div>
        <label className="block text-sm text-slate-300">Description (optional)</label>
        <textarea
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-emerald-500 focus:outline-none"
          rows={3}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-medium text-slate-900 hover:bg-emerald-400 transition disabled:opacity-60"
      >
        {loading ? 'Creating...' : 'Create invoice'}
      </button>
      {message && <p className="text-emerald-400">{message}</p>}
      {error && <p className="text-red-400">{error}</p>}
    </form>
  );
}
