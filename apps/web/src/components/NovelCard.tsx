import Link from 'next/link';
import type { Novel } from '@/lib/api';

interface NovelCardProps {
  novel: Novel;
  compact?: boolean;
}

export function NovelCard({ novel, compact }: NovelCardProps) {
  const wordLabel = novel.wordCount >= 10000
    ? `${(novel.wordCount / 10000).toFixed(1)}万字`
    : `${novel.wordCount}字`;

  return (
    <Link
      href={`/novel/${novel.id}`}
      className="group block bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-primary-200 transition-all duration-200"
    >
      {/* 封面 */}
      <div className="relative aspect-[3/4] bg-gradient-to-br from-primary-50 to-primary-100 overflow-hidden">
        {novel.coverUrl ? (
          <img
            src={novel.coverUrl}
            alt={novel.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-4xl opacity-30">📖</span>
          </div>
        )}
        {novel.status === 'ongoing' && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 text-[10px] font-medium bg-green-500 text-white rounded">
            连载中
          </span>
        )}
      </div>

      {/* 信息 */}
      <div className="p-3">
        <h3 className="font-medium text-sm text-gray-900 truncate group-hover:text-primary-600 transition-colors">
          {novel.title}
        </h3>
        <p className="text-xs text-gray-400 mt-1 truncate">{novel.author}</p>
        {!compact && (
          <>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] px-1.5 py-0.5 bg-primary-50 text-primary-600 rounded">
                {novel.category}
              </span>
              <span className="text-[10px] text-gray-400">{wordLabel}</span>
            </div>
            {novel.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {novel.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="text-[10px] text-gray-400">#{tag}</span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Link>
  );
}
