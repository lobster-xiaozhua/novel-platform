import Link from 'next/link';
import { NovelCard } from '@/components/NovelCard';
import { CategoryGrid } from '@/components/CategoryGrid';
import type { Novel } from '@/lib/api';

export const revalidate = 300;

// Mock 数据 — 后续接入 API 替换
const FEATURED: Novel = {
  id: '1',
  title: '星辰变',
  author: '我吃西红柿',
  coverUrl: '',
  category: '玄幻',
  status: 'completed',
  wordCount: 3450000,
  readCount: 12800000,
  description: '修仙之路，逆天而行。一个资质平庸的少年，凭借一颗流星坠落的奇异晶石，踏上了一条前所未有的修炼之路……',
  tags: ['修仙', '热血', '升级'],
  updatedAt: '2024-12-01',
};

const TRENDING: Novel[] = [
  { id: '2', title: '斗破苍穹', author: '天蚕土豆', coverUrl: '', category: '玄幻', status: 'completed', wordCount: 5300000, readCount: 25000000, description: '三十年河东，三十年河西，莫欺少年穷！', tags: ['热血', '逆袭'], updatedAt: '2024-11-20' },
  { id: '3', title: '凡人修仙传', author: '忘语', coverUrl: '', category: '仙侠', status: 'completed', wordCount: 7400000, readCount: 18000000, description: '一个普通山村少年，偶然下进入了当地江湖小门派，成为了一名记名弟子。', tags: ['修仙', '凡人流'], updatedAt: '2024-10-15' },
  { id: '4', title: '遮天', author: '辰东', coverUrl: '', category: '玄幻', status: 'completed', wordCount: 5600000, readCount: 22000000, description: '冰冷与黑暗并存的宇宙深处，九具庞大的龙尸拉着一口青铜古棺，亘古长存。', tags: ['热血', '仙侠'], updatedAt: '2024-09-10' },
  { id: '5', title: '诡秘之主', author: '爱潜水的乌贼', coverUrl: '', category: '玄幻', status: 'completed', wordCount: 3800000, readCount: 15000000, description: '蒸汽与机械的浪潮中，谁能触及非凡？', tags: ['克苏鲁', '悬疑'], updatedAt: '2024-08-05' },
  { id: '6', title: '大奉打更人', author: '卖报小郎君', coverUrl: '', category: '仙侠', status: 'ongoing', wordCount: 4200000, readCount: 9800000, description: '这个世界有儒释道三教九流，有妖魔鬼怪魑魅魍魉。', tags: ['仙侠', '探案'], updatedAt: '2025-01-10' },
  { id: '7', title: '全球高武', author: '老鹰吃小鸡', coverUrl: '', category: '都市', status: 'completed', wordCount: 6100000, readCount: 13000000, description: '高考路上，武道崛起。', tags: ['都市', '热血'], updatedAt: '2024-07-20' },
];

const RECENT_UPDATES = [
  { novelId: '6', novelTitle: '大奉打更人', chapter: '第一千二百三十五章', title: '天命', time: '2小时前' },
  { novelId: '8', novelTitle: '深海余烬', chapter: '第四百二十章', title: '潮汐', time: '3小时前' },
  { novelId: '9', novelTitle: '我的模拟长生路', chapter: '第八百九十章', title: '破局', time: '5小时前' },
  { novelId: '10', novelTitle: '赤心巡天', chapter: '第六百五十章', title: '剑意', time: '6小时前' },
  { novelId: '11', novelTitle: '星门', chapter: '第三百二十章', title: '信号', time: '8小时前' },
  { novelId: '12', novelTitle: '明克街13号', chapter: '第九百一十章', title: '审判', time: '10小时前' },
  { novelId: '13', novelTitle: '灵境行者', chapter: '第七百六十章', title: '规则', time: '12小时前' },
  { novelId: '14', novelTitle: '夜的命名术', chapter: '第五百四十章', title: '暗流', time: '1天前' },
];

function formatWordCount(n: number) {
  return n >= 10000 ? `${(n / 10000).toFixed(0)}万` : `${n}`;
}

export default function HomePage() {
  return (
    <div>
      {/* Hero — 精选推荐 */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-primary-900">
        <div className="absolute inset-0 bg-[url('/placeholder-hero.jpg')] bg-cover bg-center opacity-20" />
        <div className="relative max-w-content mx-auto px-4 py-16 md:py-24">
          <div className="max-w-lg">
            <span className="inline-block px-2.5 py-1 text-xs font-medium bg-primary-500/20 text-primary-300 rounded-full mb-4">
              ✨ 精选推荐
            </span>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-3">{FEATURED.title}</h1>
            <p className="text-gray-300 text-sm mb-2">{FEATURED.author} · {FEATURED.category} · {formatWordCount(FEATURED.wordCount)}字</p>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 line-clamp-3">{FEATURED.description}</p>
            <Link
              href={`/novel/${FEATURED.id}`}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-full transition-colors"
            >
              开始阅读
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-content mx-auto px-4">
        {/* 本周热门 */}
        <section className="py-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-serif font-bold text-gray-900">🔥 本周热门</h2>
            <Link href="/explore" className="text-sm text-primary-600 hover:text-primary-700 transition-colors">
              查看更多 →
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {TRENDING.map((novel) => (
              <div key={novel.id} className="w-36 shrink-0">
                <NovelCard novel={novel} compact />
              </div>
            ))}
          </div>
        </section>

        {/* 最近更新 */}
        <section className="py-6">
          <h2 className="text-lg font-serif font-bold text-gray-900 mb-4">📝 最近更新</h2>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {RECENT_UPDATES.map((item, i) => (
              <Link
                key={i}
                href={`/novel/${item.novelId}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-primary-50/40 transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-700 font-medium truncate group-hover:text-primary-600 transition-colors">
                    {item.novelTitle}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">·</span>
                  <span className="text-xs text-gray-500 truncate">
                    {item.chapter} {item.title}
                  </span>
                </div>
                <span className="text-xs text-gray-400 shrink-0 ml-3">{item.time}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 分类入口 */}
        <section className="py-6 pb-12">
          <h2 className="text-lg font-serif font-bold text-gray-900 mb-4">📂 分类浏览</h2>
          <CategoryGrid />
        </section>
      </div>
    </div>
  );
}
