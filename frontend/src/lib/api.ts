export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export type Profile = {
  id: string;
  alias: string;
  receiveAddress: string;
  defaultChain: string;
  createdAt: string;
};

export type Invoice = {
  id: string;
  profileId: string;
  slug: string;
  amount: string;
  tokenSymbol: string;
  chain: string;
  receiveAddress: string;
  description?: string | null;
  status: string;
  createdAt: string;
};

export async function fetchProfiles() {
  return fetchJson<Profile[]>('/profiles');
}

export async function fetchInvoicesForProfile(profileId: string) {
  return fetchJson<Invoice[]>(`/profiles/${profileId}/invoices`);
}

export async function createInvoice(profileId: string, payload: Record<string, unknown>) {
  return fetchJson<Invoice>(`/profiles/${profileId}/invoices`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchInvoiceBySlug(slug: string) {
  return fetchJson<{
    id: string;
    slug: string;
    amount: string;
    tokenSymbol: string;
    chain: string;
    receiveAddress: string;
    description?: string | null;
    status: string;
    profileAlias: string;
    createdAt: string;
  }>(`/invoices/slug/${slug}`);
}

export async function fetchInvoiceStatusBySlug(slug: string) {
  return fetchJson<{ status: string }>(`/invoices/slug/${slug}/status`);
}
