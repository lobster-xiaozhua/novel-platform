'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';

/* ── Mock data ── */
interface BookshelfItem {
  id: string;
  title: string;
  coverUrl: string | null;
  currentChapter: number;
  totalChapters: number;
  addedAt: string;
  updatedAt: string;
  lastReadAt: string;
}

const mockBooks: BookshelfItem[] = [
  { id: '1', title: '星海漫游', coverUrl: null, currentChapter: 128, totalChapters: 300, addedAt: '2024-12-01', updatedAt: '2025-01-15', lastReadAt: '2025-01-15' },
  { id: '2', title: '剑来', coverUrl: null, currentChapter: 56, totalChapters: 420, addedAt: '2024-11-20', updatedAt: '2025-01-14', lastReadAt: '2025-01-14' },
  { id: '3', title: '诡秘之主', coverUrl: null, currentChapter: 203, totalChapters: 350, addedAt: '2024-10-05', updatedAt: '2025-01-10', lastReadAt: '2025-01-10' },
  { id: '4', title: '凡人修仙传', coverUrl: null, currentChapter: 89, totalChapters: 560, addedAt: '2024-09-18', updatedAt: '2025-01-08', lastReadAt: '2025-01-08' },
  { id: '5', title: '斗破苍穹', coverUrl: null, currentChapter: 310, totalChapters: 400, addedAt: '2024-08-22', updatedAt: '2024-12-30', lastReadAt: '2024-12-30' },
];

type SortKey = 'lastRead' | 'addedAt' | 'updatedAt';
const sortLabels: Record<SortKey, string> = { lastRead: '最近阅读', addedAt: '加入时间', updatedAt: '更新时间' };

export default function BookshelfPage() {
  const [books, setBooks] = useState<BookshelfItem[]>(mockBooks);
  const [sortBy, setSortBy] = useState<SortKey>('lastRead');
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  const sorted = [...books].sort((a, b) => {
    const key: keyof BookshelfItem = sortBy === 'lastRead' ? 'lastReadAt' : sortBy;
    return b[key].localeCompare(a[key]);
  });

  const removeBook = useCallback((id: string) => {
    setBooks((prev) => prev.filter((b) => b.id !== id));
    setContextMenu(null);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  return (
    <div className="space-y-6" onClick={closeMenu}>
      {/* ── 标题 + 排序 ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">我的书架</h1>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          {(Object.keys(sortLabels) as SortKey[]).map((k) => (
            <option key={k} value={k}>{sortLabels[k]}</option>
          ))}
        </select>
      </div>

      {/* ── 空状态 ── */}
      {sorted.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-gray-400">书架空空如也，去发现好故事吧</p>
          <Link href="/" className="inline-block mt-4 px-5 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">
            去发现
          </Link>
        </div>
      ) : (
        /* ── 书架网格 ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sorted.map((book) => {
            const progress = Math.round((book.currentChapter / book.totalChapters) * 100);
            return (
              <div
                key={book.id}
                className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-primary-200 transition-all duration-200"
                onContextMenu={(e) => handleContextMenu(e, book.id)}
              >
                <div className="flex gap-4 p-4">
                  {/* 封面 */}
                  <div className="shrink-0 w-20 h-28 rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center overflow-hidden">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt={book.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl opacity-30">📖</span>
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h3 className="font-medium text-sm text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                        {book.title}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">读到第{book.currentChapter}章</p>
                    </div>

                    {/* 进度条 */}
                    <div className="mt-2">
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-300 mt-1">{progress}%</p>
                    </div>

                    <Link
                      href={`/novel/${book.id}`}
                      className="mt-2 inline-flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                      继续阅读
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 右键菜单 ── */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-100 py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => removeBook(contextMenu.id)}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            移出书架
          </button>
        </div>
      )}
    </div>
  );
}
