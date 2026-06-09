'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { NovelCard } from '@/components/NovelCard';
import type { Novel } from '@/lib/api';

const CATEGORIES = [
  { label: '全部', value: '' },
  { label: '玄幻', value: 'xuanhuan' },
  { label: '都市', value: 'dushi' },
  { label: '科幻', value: 'kehuan' },
  { label: '仙侠', value: 'xianxia' },
  { label: '历史', value: 'lishi' },
  { label: '游戏', value: 'youxi' },
  { label: '体育', value: 'tiyu' },
  { label: '灵异', value: 'lingyi' },
  { label: '军事', value: 'junshi' },
  { label: '现实', value: 'xianshi' },
];

const SORT_OPTIONS = [
  { label: '最近更新', value: 'updated' },
  { label: '字数最多', value: 'words' },
];

// Mock 数据
const MOCK_NOVELS: Novel[] = Array.from({ length: 18 }, (_, i) => ({
  id: String(i + 1),
  title: ['星辰变', '斗破苍穹', '凡人修仙传', '遮天', '诡秘之主', '大奉打更人', '全球高武', '深海余烬', '赤心巡天', '星门', '明克街13号', '灵境行者', '夜的命名术', '我的模拟长生路', '修真聊天群', '一念永恒', '大道朝天', '牧神记'][i % 18],
  author: ['我吃西红柿', '天蚕土豆', '忘语', '辰东', '爱潜水的乌贼', '卖报小郎君', '老鹰吃小鸡', '远瞳', '情何以甚', '晨星LL', '纯洁滴小龙', '卷土', '会说话的肘子', '愤怒的乌贼', '圣骑士的传说', '耳根', '猫腻', '宅猪'][i % 18],
  coverUrl: '',
  category: CATEGORIES[(i % (CATEGORIES.length - 1)) + 1].label,
  status: i % 3 === 0 ? 'ongoing' as const : 'completed' as const,
  wordCount: (i + 1) * 350000,
  readCount: (i + 1) * 1200000,
  description: '这是一部精彩的小说，讲述了主角在修炼之路上的传奇故事……',
  tags: [['热血', '升级'], ['修仙', '凡人流'], ['悬疑', '克苏鲁']][i % 3],
  updatedAt: new Date(Date.now() - i * 86400000).toISOString().split('T')[0],
}));

function ExploreContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || '';

  const [category, setCategory] = useState(initialCategory);
  const [status, setStatus] = useState<'' | 'ongoing' | 'completed'>('');
  const [sort, setSort] = useState('updated');
  const [novels, setNovels] = useState<Novel[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);

  const fetchNovels = useCallback(async (reset?: boolean) => {
    if (loading) return;
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 400));

      const filtered = MOCK_NOVELS.filter((n) => {
        if (category && n.category !== CATEGORIES.find((c) => c.value === category)?.label) return false;
        if (status && n.status !== status) return false;
        return true;
      });

      const sorted = [...filtered].sort((a, b) =>
        sort === 'words' ? b.wordCount - a.wordCount : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      const p = reset ? 1 : page;
      const items = sorted.slice(0, p * 6);
      setNovels(items);
      setHasMore(items.length < sorted.length);
    } catch (err) {
      console.error('[Explore] 加载失败:', err);
    } finally {
      setLoading(false);
    }
  }, [category, status, sort, page, loading]);

  useEffect(() => {
    setPage(1);
    fetchNovels(true);
  }, [category, status, sort]);

  const lastRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((p) => p + 1);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  useEffect(() => {
    if (page > 1) fetchNovels();
  }, [page]);

  return (
    <div className="max-w-content mx-auto px-4 py-6">
      <h1 className="text-2xl font-serif font-bold text-gray-900 mb-5">发现</h1>

      {/* 分类 Tab */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`shrink-0 px-3.5 py-1.5 text-sm rounded-full border transition-all duration-200 ${
              category === cat.value
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 筛选 + 排序 */}
      <div className="flex items-center justify-between mt-4 mb-5">
        <div className="flex gap-2">
          <button
            onClick={() => setStatus('')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              status === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            全部状态
          </button>
          <button
            onClick={() => setStatus('ongoing')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              status === 'ongoing' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            连载中
          </button>
          <button
            onClick={() => setStatus('completed')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              status === 'completed' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            已完结
          </button>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-full p-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                sort === opt.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 小说网格 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {novels.map((novel) => (
          <NovelCard key={novel.id} novel={novel} />
        ))}
      </div>

      {hasMore && (
        <div ref={lastRef} className="py-8 text-center">
          {loading ? (
            <div className="inline-flex items-center gap-2 text-sm text-gray-400">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              加载中…
            </div>
          ) : (
            <span className="text-sm text-gray-400">下滑加载更多</span>
          )}
        </div>
      )}

      {!hasMore && novels.length > 0 && (
        <div className="py-8 text-center text-sm text-gray-400">— 已加载全部 —</div>
      )}

      {novels.length === 0 && !loading && (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-400">暂无符合条件的小说</p>
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={
      <div className="max-w-content mx-auto px-4 py-16 text-center text-sm text-gray-400">
        <svg className="animate-spin h-5 w-5 mx-auto mb-2" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        加载中…
      </div>
    }>
      <ExploreContent />
    </Suspense>
  );
}
