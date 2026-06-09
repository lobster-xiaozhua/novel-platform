import { Metadata } from 'next';
import Link from 'next/link';
import { ChapterList } from '@/components/ChapterList';
import type { Novel, Chapter } from '@/lib/api';

export const revalidate = 60;

// Mock 数据
function getMockNovel(id: string): Novel {
  return {
    id,
    title: '星辰变',
    author: '我吃西红柿',
    coverUrl: '',
    category: '玄幻',
    status: 'completed',
    wordCount: 3450000,
    readCount: 12800000,
    description: '修仙之路，逆天而行。一个资质平庸的少年，凭借一颗流星坠落的奇异晶石，踏上了一条前所未有的修炼之路。从凡人到仙人，从仙人到神人，每一步都是逆天而行。秦羽，一个不甘平凡的少年，用自己的双手开创了一条前所未有的修炼之路，最终成为了宇宙间最强大的存在。这是一个关于坚持、勇气和突破的故事。',
    tags: ['修仙', '热血', '升级', '玄幻'],
    updatedAt: '2024-12-01',
  };
}

function getMockChapters(novelId: string): Chapter[] {
  return Array.from({ length: 20 }, (_, i) => ({
    id: `ch-${novelId}-${i + 1}`,
    novelId,
    title: ['流星泪', '潜龙出渊', '初入江湖', '暗流涌动', '破茧成蝶', '风云际会', '剑指苍穹', '逆天改命', '九死一生', '浴火重生', '天劫降临', '化龙飞升', '仙界风云', '神魔之战', '宇宙洪荒', '大道至简', '万法归一', '终极之战', '尘埃落定', '新的开始'][i],
    sortOrder: i + 1,
    wordCount: 2500 + Math.floor(Math.random() * 1500),
    isFree: i < 10,
    publishedAt: i < 18 ? new Date(Date.now() - (20 - i) * 86400000).toISOString().split('T')[0] : undefined,
  }));
}

function formatWordCount(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万字` : `${n}字`;
}

function formatReadCount(n: number) {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(0)}万`;
  return `${n}`;
}

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const novel = getMockNovel(params.id);
  return {
    title: `${novel.title} - 墨卷`,
    description: novel.description.slice(0, 120),
  };
}

export async function generateStaticParams() {
  // TODO: 从 API 获取热门小说 ID 列表
  return [{ id: '1' }, { id: '2' }, { id: '3' }];
}

export default async function NovelDetailPage({ params }: Props) {
  const novel = getMockNovel(params.id);
  const chapters = getMockChapters(params.id);

  return (
    <div className="max-w-content mx-auto px-4 py-6">
      {/* 头部信息 */}
      <div className="flex gap-5 md:gap-8">
        {/* 封面 */}
        <div className="w-28 md:w-36 shrink-0 aspect-[3/4] bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl overflow-hidden shadow-sm">
          {novel.coverUrl ? (
            <img src={novel.coverUrl} alt={novel.title} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-5xl opacity-30">📖</span>
            </div>
          )}
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0 py-1">
          <h1 className="text-xl md:text-2xl font-serif font-bold text-gray-900">{novel.title}</h1>
          <p className="text-sm text-gray-500 mt-1.5">{novel.author}</p>

          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="px-2 py-0.5 text-xs bg-primary-50 text-primary-600 rounded">{novel.category}</span>
            <span className={`px-2 py-0.5 text-xs rounded ${
              novel.status === 'ongoing' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {novel.status === 'ongoing' ? '连载中' : '已完结'}
            </span>
            <span className="text-xs text-gray-400">{formatWordCount(novel.wordCount)}</span>
            <span className="text-xs text-gray-400">{formatReadCount(novel.readCount)}阅读</span>
          </div>

          {/* 标签 */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {novel.tags.map((tag) => (
              <span key={tag} className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded">#{tag}</span>
            ))}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-3 mt-4">
            <Link
              href={`/novel/${novel.id}/chapter/${chapters[0]?.id}`}
              className="px-5 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-full transition-colors"
            >
              开始阅读
            </Link>
            <button className="px-5 py-2 text-sm font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-full transition-colors">
              加入书架
            </button>
          </div>
        </div>
      </div>

      {/* 简介 */}
      <section className="mt-6">
        <h2 className="text-sm font-medium text-gray-700 mb-2">简介</h2>
        <Description text={novel.description} />
      </section>

      {/* 章节目录 */}
      <section className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-gray-700">章节目录</h2>
          <span className="text-xs text-gray-400">共 {chapters.length} 章</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <ChapterList chapters={chapters} novelId={novel.id} />
        </div>
      </section>
    </div>
  );
}

/** 可展开/收起的简介组件 */
function Description({ text }: { text: string }) {
  return (
    <details className="group">
      <summary className="list-none cursor-pointer">
        <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 group-open:line-clamp-none">
          {text}
        </p>
        <span className="inline-block mt-1 text-xs text-primary-600 group-open:hidden">
          展开全部 ▾
        </span>
      </summary>
      <span className="inline-block mt-1 text-xs text-primary-600">
        收起 ▴
      </span>
    </details>
  );
}
