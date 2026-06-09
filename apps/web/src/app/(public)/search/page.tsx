'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Novel, Chapter, SearchResult } from '@/lib/api';

// Mock 数据
const MOCK_NOVELS: Novel[] = [
  { id: '1', title: '星辰变', author: '我吃西红柿', coverUrl: '', category: '玄幻', status: 'completed', wordCount: 3450000, readCount: 12800000, description: '修仙之路，逆天而行。一个资质平庸的少年，凭借一颗流星坠落的奇异晶石，踏上了一条前所未有的修炼之路……', tags: ['修仙', '热血'], updatedAt: '2024-12-01' },
  { id: '2', title: '斗破苍穹', author: '天蚕土豆', coverUrl: '', category: '玄幻', status: 'completed', wordCount: 5300000, readCount: 25000000, description: '三十年河东，三十年河西，莫欺少年穷！', tags: ['热血', '逆袭'], updatedAt: '2024-11-20' },
  { id: '3', title: '凡人修仙传', author: '忘语', coverUrl: '', category: '仙侠', status: 'completed', wordCount: 7400000, readCount: 18000000, description: '一个普通山村少年，偶然下进入了当地江湖小门派，成为了一名记名弟子。', tags: ['修仙', '凡人流'], updatedAt: '2024-10-15' },
  { id: '4', title: '遮天', author: '辰东', coverUrl: '', category: '玄幻', status: 'completed', wordCount: 5600000, readCount: 22000000, description: '冰冷与黑暗并存的宇宙深处，九具庞大的龙尸拉着一口青铜古棺，亘古长存。', tags: ['热血', '仙侠'], updatedAt: '2024-09-10' },
  { id: '5', title: '诡秘之主', author: '爱潜水的乌贼', coverUrl: '', category: '玄幻', status: 'completed', wordCount: 3800000, readCount: 15000000, description: '蒸汽与机械的浪潮中，谁能触及非凡？', tags: ['克苏鲁', '悬疑'], updatedAt: '2024-08-05' },
];

const MOCK_CHAPTERS: { chapter: Chapter; novel: Novel; highlight: string }[] = [
  { novel: MOCK_NOVELS[0], chapter: { id: 'c1', novelId: '1', title: '流星泪', sortOrder: 1, wordCount: 3200, isFree: true, publishedAt: '2024-01-01' }, highlight: '一颗流星划过夜空，少年秦羽仰望苍穹，心中涌起无限感慨……' },
  { novel: MOCK_NOVELS[0], chapter: { id: 'c2', novelId: '1', title: '潜龙出渊', sortOrder: 2, wordCount: 2800, isFree: true, publishedAt: '2024-01-02' }, highlight: '秦羽在深潭中发现了一处隐秘的洞府，洞中灵气充沛……' },
  { novel: MOCK_NOVELS[1], chapter: { id: 'c3', novelId: '2', title: '陨落的天才', sortOrder: 1, wordCount: 3500, isFree: true, publishedAt: '2024-02-01' }, highlight: '萧炎望着斗之气碑上不断下降的数字，心中苦涩……' },
];

function formatWordCount(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万字` : `${n}字`;
}

function HighlightText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>;
  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === keyword.toLowerCase() ? (
          <mark key={i} className="bg-primary-200/60 text-primary-800 rounded px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tab, setTab] = useState<'novel' | 'chapter'>('novel');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // 防抖
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // 搜索
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      setShowSuggestions(false);
      return;
    }

    const doSearch = async () => {
      setLoading(true);
      try {
        // TODO: 替换为真实 API
        // const data = await api.search(debouncedQuery, tab);
        await new Promise((r) => setTimeout(r, 200));

        const q = debouncedQuery.toLowerCase();
        if (tab === 'novel') {
          const matched = MOCK_NOVELS.filter(
            (n) =>
              n.title.toLowerCase().includes(q) ||
              n.author.toLowerCase().includes(q) ||
              n.description.toLowerCase().includes(q)
          );
          setResults(matched.map((n) => ({ type: 'novel' as const, novel: n, highlight: n.description.slice(0, 80) })));
        } else {
          const matched = MOCK_CHAPTERS.filter(
            (c) => c.chapter.title.toLowerCase().includes(q) || c.highlight.toLowerCase().includes(q)
          );
          setResults(matched.map((c) => ({ type: 'chapter' as const, novel: c.novel, chapter: c.chapter, highlight: c.highlight })));
        }
      } catch (err) {
        console.error('[Search] 搜索失败:', err);
      } finally {
        setLoading(false);
      }
    };

    doSearch();
  }, [debouncedQuery, tab]);

  // 建议下拉
  const suggestions = debouncedQuery
    ? MOCK_NOVELS.filter((n) => n.title.toLowerCase().includes(debouncedQuery.toLowerCase())).slice(0, 5)
    : [];

  const handleSelectSuggestion = useCallback((title: string) => {
    setQuery(title);
    setShowSuggestions(false);
  }, []);

  return (
    <div className="max-w-content mx-auto px-4 py-8">
      {/* 搜索框 */}
      <div className="max-w-xl mx-auto mb-8">
        <h1 className="text-2xl font-serif font-bold text-gray-900 text-center mb-6">搜索</h1>
        <div className="relative">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="搜索小说、章节…"
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
            />
          </div>

          {/* 建议下拉 */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden z-10">
              {suggestions.map((n) => (
                <button
                  key={n.id}
                  onMouseDown={() => handleSelectSuggestion(n.title)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 transition-colors text-left"
                >
                  <span className="text-sm text-gray-700">
                    <HighlightText text={n.title} keyword={debouncedQuery} />
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">{n.author}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 结果 Tab */}
      {debouncedQuery && (
        <div className="max-w-xl mx-auto">
          <div className="flex gap-1 bg-gray-100 rounded-full p-0.5 mb-6">
            <button
              onClick={() => setTab('novel')}
              className={`flex-1 py-1.5 text-sm rounded-full transition-colors ${
                tab === 'novel' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500'
              }`}
            >
              小说
            </button>
            <button
              onClick={() => setTab('chapter')}
              className={`flex-1 py-1.5 text-sm rounded-full transition-colors ${
                tab === 'chapter' ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500'
              }`}
            >
              章节
            </button>
          </div>

          {/* 加载 */}
          {loading && (
            <div className="py-8 text-center text-sm text-gray-400">
              <svg className="animate-spin h-5 w-5 mx-auto mb-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              搜索中…
            </div>
          )}

          {/* 小说结果 */}
          {!loading && tab === 'novel' && (
            <div className="space-y-3">
              {results.map((r) => (
                <Link
                  key={r.novel.id}
                  href={`/novel/${r.novel.id}`}
                  className="flex gap-4 p-4 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all"
                >
                  <div className="w-20 shrink-0 aspect-[3/4] bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg overflow-hidden">
                    {r.novel.coverUrl ? (
                      <img src={r.novel.coverUrl} alt={r.novel.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-2xl opacity-30">📖</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm text-gray-900">
                      <HighlightText text={r.novel.title} keyword={debouncedQuery} />
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.novel.author} · {r.novel.category} · {formatWordCount(r.novel.wordCount)}
                    </p>
                    {r.highlight && (
                      <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                        <HighlightText text={r.highlight} keyword={debouncedQuery} />
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* 章节结果 */}
          {!loading && tab === 'chapter' && (
            <div className="space-y-2">
              {results.map((r, i) => (
                <Link
                  key={`${r.chapter?.id || i}`}
                  href={`/novel/${r.novel.id}/chapter/${r.chapter?.id}`}
                  className="block p-4 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all"
                >
                  <div className="text-xs text-gray-400 mb-1">
                    《{r.novel.title}》→ 第{r.chapter?.sortOrder}章
                  </div>
                  <h3 className="font-medium text-sm text-gray-900">
                    <HighlightText text={r.chapter?.title || ''} keyword={debouncedQuery} />
                  </h3>
                  {r.highlight && (
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">
                      <HighlightText text={r.highlight} keyword={debouncedQuery} />
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}

          {/* 空状态 */}
          {!loading && results.length === 0 && debouncedQuery && (
            <div className="py-16 text-center">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-gray-400">未找到「{debouncedQuery}」相关结果</p>
              <p className="text-xs text-gray-300 mt-1">试试换个关键词？</p>
            </div>
          )}
        </div>
      )}

      {/* 无搜索词提示 */}
      {!debouncedQuery && (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-gray-400">输入关键词开始搜索</p>
        </div>
      )}
    </div>
  );
}
