import Link from 'next/link';
import type { Chapter } from '@/lib/api';

interface ChapterListProps {
  chapters: Chapter[];
  novelId: string;
}

export function ChapterList({ chapters, novelId }: ChapterListProps) {
  const sorted = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="divide-y divide-gray-50">
      {sorted.map((ch) => (
        <Link
          key={ch.id}
          href={`/novel/${novelId}/chapter/${ch.id}`}
          className="flex items-center justify-between px-3 py-2.5 hover:bg-primary-50/50 transition-colors group"
        >
          <span className="text-sm text-gray-700 group-hover:text-primary-600 truncate">
            第{ch.sortOrder}章 {ch.title}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {!ch.isFree && (
              <span className="text-[10px] px-1.5 py-0.5 bg-primary-100 text-primary-600 rounded">VIP</span>
            )}
            {!ch.publishedAt && (
              <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">未发布</span>
            )}
          </div>
        </Link>
      ))}
      {sorted.length === 0 && (
        <div className="py-8 text-center text-sm text-gray-400">暂无章节</div>
      )}
    </div>
  );
}
