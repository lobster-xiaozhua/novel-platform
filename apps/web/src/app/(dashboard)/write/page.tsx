'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api, apiPost, type Novel } from '@/lib/api';

const CATEGORIES = ['玄幻', '仙侠', '都市', '科幻', '历史', '游戏', '悬疑', '轻小说'];

export default function WritePage() {
  const { user, loading: authLoading } = useAuth();
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', category: '玄幻', description: '', tags: '' });

  const fetchNovels = useCallback(async () => {
    try {
      const res = await api<{ items: Novel[]; total: number }>('/api/novels/mine');
      if (res.code === 0 && res.data) {
        setNovels(res.data.items || []);
      }
    } catch (err) {
      console.error('[WritePage] 获取作品列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) fetchNovels();
    else if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, fetchNovels]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    try {
      const tags = form.tags.split(/[,，\s]+/).filter(Boolean);
      const res = await apiPost<Novel>('/api/novels', {
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        tags,
      });
      if (res.code === 0) {
        setShowModal(false);
        setForm({ title: '', category: '玄幻', description: '', tags: '' });
        fetchNovels();
      } else {
        console.error('[WritePage] 创建作品失败:', res.message);
      }
    } catch (err) {
      console.error('[WritePage] 创建作品请求失败:', err);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-500">请先登录后使用创作台</p>
        <Link href="/login" className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
          去登录
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-content mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">我的作品</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
        >
          + 创建新作品
        </button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">加载中...</div>
      ) : novels.length === 0 ? (
        /* Empty state */
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-gray-500 text-lg">还没有作品，开始你的创作之旅吧</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 px-6 py-2.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
          >
            创建第一部作品
          </button>
        </div>
      ) : (
        /* Novel list */
        <div className="grid gap-4">
          {novels.map((novel) => (
            <div key={novel.id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span>📖</span>
                    <span className="truncate">{novel.title}</span>
                  </h3>
                  <div className="mt-1.5 flex items-center gap-3 text-sm text-gray-500">
                    <span>{novel.category}</span>
                    <span>·</span>
                    <span className={novel.status === 'ongoing' ? 'text-green-600' : 'text-blue-600'}>
                      {novel.status === 'ongoing' ? '连载中' : '已完结'}
                    </span>
                    <span>·</span>
                    <span>{novel.wordCount.toLocaleString()} 字</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    上次编辑：{new Date(novel.updatedAt).toLocaleString('zh-CN')}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/write/${novel.id}`}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    管理章节
                  </Link>
                  <button className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    编辑信息
                  </button>
                  <Link
                    href={`/write/${novel.id}?action=new-chapter`}
                    className="px-3 py-1.5 text-sm bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    新增章节
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-5">创建新作品</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标题</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="输入作品标题"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 text-sm"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 text-sm bg-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">简介</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="简要描述你的作品"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">标签</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="用逗号或空格分隔多个标签"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-300 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!form.title.trim()}
                className="px-5 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
