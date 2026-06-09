'use client';

import { useState } from 'react';

/* ── Mock 数据 ── */
type AppStatus = 'pending' | 'approved' | 'rejected';

interface Application {
  id: string;
  username: string;
  appliedAt: string;
  status: AppStatus;
}

const INIT_APPS: Application[] = Array.from({ length: 20 }, (_, i) => ({
  id: String(i + 1),
  username: `applicant_${i + 1}`,
  appliedAt: new Date(Date.now() - i * 3600000 * Math.random() * 24).toISOString().slice(0, 10),
  status: i < 5 ? 'pending' : i < 12 ? 'approved' : 'rejected',
}));

const TABS: { key: AppStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已驳回' },
];

const STATUS_BADGE: Record<AppStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};
const STATUS_LABEL: Record<AppStatus, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
};

export default function AdminApplicationsPage() {
  const [tab, setTab] = useState<AppStatus | 'all'>('all');
  const [apps, setApps] = useState(INIT_APPS);

  const filtered = tab === 'all' ? apps : apps.filter((a) => a.status === tab);

  const handleAction = (id: string, status: AppStatus) => {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  return (
    <div className="space-y-4">
      {/* Tab 筛选 */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-gray-400">
              ({t.key === 'all' ? apps.length : apps.filter((a) => a.status === t.key).length})
            </span>
          </button>
        ))}
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">用户名</th>
              <th className="px-4 py-3 font-medium">申请时间</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{a.username}</td>
                <td className="px-4 py-3 text-gray-500">{a.appliedAt}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {a.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(a.id, 'approved')}
                        className="px-3 py-1 rounded text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleAction(a.id, 'rejected')}
                        className="px-3 py-1 rounded text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        驳回
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
