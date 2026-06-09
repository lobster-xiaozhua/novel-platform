'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { apiPut } from '@/lib/api';

/* ── Mock data ── */
const mockStats = { bookshelf: 12, chaptersRead: 86, creations: 3 };
const mockRecentReads = [
  { id: '1', title: '星海漫游', chapter: '第128章 暗流涌动', time: '2小时前' },
  { id: '2', title: '剑来', chapter: '第56章 山上人', time: '昨天' },
  { id: '3', title: '诡秘之主', chapter: '第203章 命运之轮', time: '3天前' },
];

export default function ProfilePage() {
  const { user, loading, refresh } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', bio: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 text-gray-500">请先登录后查看个人中心</div>
    );
  }

  const openEdit = () => {
    setEditForm({ username: user.username, bio: user.bio || '' });
    setError('');
    setEditOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiPut<{ username: string; bio: string }>('/api/users/me', editForm);
      if (res.code !== 0) {
        setError(res.message || '保存失败');
        return;
      }
      await refresh();
      setEditOpen(false);
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const roleLabel: Record<string, string> = { reader: '读者', author: '作者', admin: '管理员' };

  return (
    <div className="space-y-8">
      {/* ── 用户信息卡片 ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* 头像 */}
          <button
            className="shrink-0 w-20 h-20 rounded-full bg-primary-100 text-primary-600 text-2xl font-bold flex items-center justify-center hover:ring-2 hover:ring-primary-300 transition-all"
            title="更换头像（暂未开放）"
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.username} className="w-full h-full rounded-full object-cover" />
            ) : (
              user.username[0]?.toUpperCase()
            )}
          </button>

          {/* 信息 */}
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-xl font-bold text-gray-900">{user.username}</h1>
            <p className="text-sm text-gray-500 mt-1">{user.email}</p>
            <span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-medium bg-primary-50 text-primary-600 rounded-full">
              {roleLabel[user.role] || user.role}
            </span>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 shrink-0">
            <button
              onClick={openEdit}
              className="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              编辑资料
            </button>
            {user.role === 'reader' && (
              <button className="px-4 py-2 text-sm font-medium border border-primary-300 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors">
                申请成为作者
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 统计卡片 ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '书架数', value: mockStats.bookshelf, icon: '📚' },
          { label: '阅读章节', value: mockStats.chaptersRead, icon: '📖' },
          { label: '创作数', value: mockStats.creations, icon: '✍️' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 text-center hover:shadow-sm transition-shadow">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── 最近阅读 ── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">最近阅读</h2>
        {mockRecentReads.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">还没有阅读记录</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {mockRecentReads.map((r) => (
              <a
                key={r.id}
                href={`/novel/${r.id}`}
                className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{r.chapter}</p>
                </div>
                <span className="text-xs text-gray-300 shrink-0">{r.time}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── 编辑资料模态框 ── */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">编辑资料</h3>

            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              value={editForm.username}
              onChange={(e) => setEditForm((f) => ({ ...f, username: e.target.value }))}
            />

            <label className="block text-sm font-medium text-gray-700 mt-4 mb-1">简介</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300"
              value={editForm.bio}
              onChange={(e) => setEditForm((f) => ({ ...f, bio: e.target.value }))}
              placeholder="介绍一下自己吧…"
            />

            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">取消</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
