const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface ApiResponse<T = unknown> {
  code: number;
  data: T | null;
  message: string;
}

export async function api<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  const data = await res.json();
  return data;
}

export async function apiPost<T>(path: string, body: unknown) {
  return api<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function apiPut<T>(path: string, body: unknown) {
  return api<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T>(path: string) {
  return api<T>(path, { method: 'DELETE' });
}

/* ── Domain types ── */

export interface Novel {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  category: string;
  status: 'ongoing' | 'completed';
  wordCount: number;
  readCount: number;
  description: string;
  tags: string[];
  updatedAt: string;
}

export interface Chapter {
  id: string;
  novelId: string;
  title: string;
  sortOrder: number;
  wordCount: number;
  isFree: boolean;
  publishedAt?: string;
}

export interface SearchResult {
  type: 'novel' | 'chapter';
  novel: Novel;
  chapter?: Chapter;
  highlight?: string;
}

/* ── Domain helpers ── */

export async function getNovels(params?: Record<string, string>) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return api<{ items: Novel[]; total: number }>(`/novels${qs}`);
}

export async function getNovel(id: string) {
  return api<Novel>(`/novels/${id}`);
}

export async function getChapters(novelId: string) {
  return api<Chapter[]>(`/novels/${novelId}/chapters`);
}

export async function search(q: string, type?: 'novel' | 'chapter', page?: number) {
  const params = new URLSearchParams({ q });
  if (type) params.set('type', type);
  if (page) params.set('page', String(page));
  return api<{ items: SearchResult[]; total: number }>(`/search?${params}`);
}
