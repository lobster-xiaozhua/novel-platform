'use client';

import { useState } from 'react';

/* ── Mock 数据 ── */
interface MockUser {
  id: string;
  username: string;
  email: string;
  role: 'reader' | 'author' | 'admin';
  registeredAt: string;
  disabled: boolean;
}

const ALL_USERS: MockUser[] = Array.from({ length: 53 }, (_, i) => ({
  id: String(i + 1),
  username: `user_${i + 1}`,
  email: `user${i + 1}@example.com`,
  role: i === 0 ? 'admin' : i % 5 === 0 ? 'author' : 'reader',
  registeredAt: new Date(Date.now() - i * 86400000 * Math.random()).toISOString().slice(0, 10),
  disabled: i === 7,
}));

const PAGE_SIZE = 10;
const ROLES = ['all', 'reader', 'author', 'admin'] as const;
const ROLE_LABELS: Record<string, string> = { all: '全部角色', reader: '读者', author: '作者', admin: '管理员' };

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState(ALL_USERS);

  const filtered = users.filter((u) => {
    if (role !== 'all' && u.role !== role) return false;
    if (search && !u.username.includes(search) && !u.email.includes(search)) return false;
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleDisable = (id: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, disabled: !u.disabled } : u)));
  };

  const roleBadge = (r: string) => {
    const cls =
      r === 'admin'
        ? 'bg-red-100 text-red-700'
        : r === 'author'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-gray-100 text-gray-600';
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{ROLE_LABELS[r]}</span>;
  };

  return (
    <div className="space-y-4">
      {/* 筛选栏 */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="搜索用户名或邮箱..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
        />
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400">共 {total} 条</span>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">用户名</th>
              <th className="px-4 py-3 font-medium">邮箱</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">注册时间</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((u) => (
              <tr key={u.id} className={`hover:bg-gray-50 ${u.disabled ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-gray-900">{u.username}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">{roleBadge(u.role)}</td>
                <td className="px-4 py-3 text-gray-500">{u.registeredAt}</td>
                <td className="px-4 py-3">
                  {u.role !== 'admin' && (
                    <button
                      onClick={() => toggleDisable(u.id)}
                      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                        u.disabled
                          ? 'bg-green-50 text-green-600 hover:bg-green-100'
                          : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                    >
                      {u.disabled ? '启用' : '禁用'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            上一页
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .reduce<(number | string)[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              typeof p === 'string' ? (
                <span key={`e${i}`} className="px-2 text-gray-400">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 text-sm rounded-lg border ${
                    safePage === p
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
