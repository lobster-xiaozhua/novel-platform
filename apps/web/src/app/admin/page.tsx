'use client';

/* ── Mock 数据 ── */
const STATS = {
  todayRegistrations: 23,
  totalUsers: 12847,
  totalNovels: 3421,
  totalChapters: 87654,
};

const TREND = [
  { day: '6/3', value: 18 },
  { day: '6/4', value: 25 },
  { day: '6/5', value: 12 },
  { day: '6/6', value: 30 },
  { day: '6/7', value: 22 },
  { day: '6/8', value: 28 },
  { day: '6/9', value: 23 },
];
const TREND_MAX = Math.max(...TREND.map((d) => d.value));

const CARDS = [
  { label: '今日注册', value: STATS.todayRegistrations, color: 'bg-blue-500' },
  { label: '总用户数', value: STATS.totalUsers.toLocaleString(), color: 'bg-green-500' },
  { label: '总小说数', value: STATS.totalNovels.toLocaleString(), color: 'bg-purple-500' },
  { label: '总章节数', value: STATS.totalChapters.toLocaleString(), color: 'bg-primary-500' },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((c) => (
          <div key={c.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${c.color} rounded-lg flex items-center justify-center text-white text-lg`}>
                {c.label[0]}
              </div>
              <div>
                <p className="text-sm text-gray-500">{c.label}</p>
                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 近7天趋势 */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-base font-semibold text-gray-800 mb-4">近7天注册趋势</h3>
        <div className="flex items-end gap-3 h-48">
          {TREND.map((d) => {
            const height = (d.value / TREND_MAX) * 100;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500">{d.value}</span>
                <div
                  className="w-full bg-primary-400 rounded-t transition-all hover:bg-primary-600"
                  style={{ height: `${height}%` }}
                />
                <span className="text-xs text-gray-400">{d.day}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
