import Link from 'next/link';

const CATEGORIES = [
  { name: '玄幻', icon: '🔮', slug: 'xuanhuan' },
  { name: '都市', icon: '🏙️', slug: 'dushi' },
  { name: '科幻', icon: '🚀', slug: 'kehuan' },
  { name: '仙侠', icon: '⚔️', slug: 'xianxia' },
  { name: '历史', icon: '📜', slug: 'lishi' },
  { name: '游戏', icon: '🎮', slug: 'youxi' },
  { name: '体育', icon: '⚽', slug: 'tiyu' },
  { name: '灵异', icon: '👻', slug: 'lingyi' },
];

export function CategoryGrid() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {CATEGORIES.map((cat) => (
        <Link
          key={cat.slug}
          href={`/explore?category=${cat.slug}`}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white border border-gray-100 hover:border-primary-200 hover:shadow-sm transition-all duration-200"
        >
          <span className="text-2xl">{cat.icon}</span>
          <span className="text-xs text-gray-600 font-medium">{cat.name}</span>
        </Link>
      ))}
    </div>
  );
}
