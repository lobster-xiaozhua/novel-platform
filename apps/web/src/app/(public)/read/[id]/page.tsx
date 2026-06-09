'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useReadingSettings, type ReadingSettings } from '@/lib/useReadingSettings';
import { useReadingProgress } from '@/lib/useReadingProgress';

/* ── Mock 数据 ── */

interface ChapterData {
  id: string;
  novelId: string;
  novelTitle: string;
  title: string;
  sortOrder: number;
  content: string;
  prevId: string | null;
  nextId: string | null;
}

const MOCK_PARAGRAPHS = [
  '夜色如墨，星辰隐没。秦羽独自站在悬崖之上，俯瞰着脚下那片无垠的云海。风从谷底翻涌而上，吹得他衣袂猎猎作响，却吹不散他眉宇间那抹凝重。',
  '三个月前，他还只是秦府中一个资质平庸的少年，连最基本的内力都无法凝聚。然而命运的转折往往来得猝不及防——那颗从天而降的流星，那块蕴含着无穷力量的晶石，彻底改变了他的人生轨迹。',
  '"流星泪……"秦羽低声呢喃，右手不自觉地抚上胸口。那里，一颗淡蓝色的晶石正散发着微弱的光芒，与他的心跳同频共振。每一次脉动，都有一股温热的能量顺着经脉流遍全身，修复着曾经断裂的经络，强化着曾经羸弱的体魄。',
  '他深吸一口气，缓缓闭上双眼。内视之下，体内的变化更加惊人——原本堵塞的经脉如今已打通了七条，丹田中那团微弱的真气正以肉眼可见的速度壮大。按照这个进度，最多再有一个月，他就能突破至后天三重。',
  '这在以前，是根本不敢想象的事情。秦府的修炼资源向来倾斜给嫡系子弟，像他这样的旁支庶子，能修炼到后天一重已是极限。更何况他的资质本就平庸，连秦家最低级的功法都修炼得磕磕绊绊。',
  '然而此刻，一切都不同了。',
  '秦羽睁开眼，目光变得坚定而锐利。他转身看向身后那片灯火通明的秦府，嘴角微微上扬。那些曾经嘲笑他、轻视他的人，终将看到他的蜕变。',
  '"不过现在还不是时候。"他自言自语道，"流星泪的秘密绝不能让任何人知道。在拥有足够的自保之力前，我必须隐忍。"',
  '他最后看了一眼夜空，转身跃下悬崖。身形在云雾中穿梭，如同一只矫健的苍鹰，无声无息地消失在了茫茫夜色之中。',
  '回到自己的小院，秦羽并未急着修炼，而是从书架上取下一本泛黄的古籍。这是他偶然从秦府藏书阁的角落里翻到的，名为《九转炼体诀》。据书中记载，这是一门上古炼体功法，虽然残缺不全，但若能修炼成功，可令肉身强大到不可思议的地步。',
  '秦羽翻开书页，借着流星泪散发的微光仔细研读。他越看越是心惊——这功法的第一转就需要承受常人难以忍受的痛苦，以特殊手法锤炼全身骨骼肌肉，使其脱胎换骨。而且每转一次，痛苦都会倍增。',
  '"难怪会被束之高阁。"秦羽合上书，深吸一口气，"但对我而言，这恰恰是最适合的功法。流星泪的能量可以加速修复，只要能扛住痛苦……"',
  '他站起身来，走到院中空地上，按照书中所载的姿势站定。双手结印，引导流星泪的能量运转全身，然后——猛地一掌拍向自己的胸口！',
  '轰！',
  '一股狂暴的力量瞬间贯穿全身，每一条经脉、每一块骨骼都在剧烈震颤。剧痛如同潮水般涌来，秦羽咬紧牙关，额头上青筋暴起，豆大的汗珠滚落而下。',
  '但他没有停下。第二掌、第三掌……每一掌落下，他的身体都在发生着微妙的变化。骨骼在碎裂中重组，肌肉在撕裂中新生，经脉在堵塞中疏通。痛苦如同炼狱，但秦羽的眼神始终坚如磐石。',
  '因为他知道，只有经历过烈火的淬炼，凡铁才能化为精钢。只有经历过最深的黑暗，才能迎来最耀眼的黎明。',
  '一个时辰后，秦羽终于停了下来。他浑身湿透，瘫坐在地上大口喘息。但他的嘴角，却挂着一丝笑意——第一转，成了。',
];

function getMockChapter(id: string): ChapterData {
  const num = parseInt(id.replace(/\D/g, '')) || 1;
  const titles = [
    '流星泪', '潜龙出渊', '初入江湖', '暗流涌动', '破茧成蝶',
    '风云际会', '剑指苍穹', '逆天改命', '九死一生', '浴火重生',
  ];
  return {
    id,
    novelId: 'novel-1',
    novelTitle: '星辰变',
    title: titles[(num - 1) % titles.length],
    sortOrder: num,
    content: MOCK_PARAGRAPHS.join('\n\n'),
    prevId: num > 1 ? String(num - 1) : null,
    nextId: num < 10 ? String(num + 1) : null,
  };
}

/* ── 背景色映射 ── */

const BG_MAP: Record<ReadingSettings['background'], { base: string; dark: string }> = {
  light: { base: 'bg-reading-bg text-gray-900', dark: '' },
  dark: { base: 'bg-reading-dark text-reading-warm', dark: 'dark' },
  paper: { base: 'bg-reading-paper text-gray-800', dark: '' },
};

const LINE_HEIGHT_MAP: Record<ReadingSettings['lineHeight'], string> = {
  compact: 'leading-[1.75]',
  normal: 'leading-[2]',
  loose: 'leading-[2.3]',
};

const FONT_MAP: Record<ReadingSettings['fontFamily'], string> = {
  serif: 'font-serif',
  sans: 'font-sans',
  kai: 'font-kai',
};

/* ── 设置面板 ── */

function SettingsPanel({
  open,
  settings,
  update,
  onClose,
}: {
  open: boolean;
  settings: ReadingSettings;
  update: (p: Partial<ReadingSettings>) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* 遮罩 */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* 面板 */}
      <div
        className={`fixed top-0 right-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-semibold text-gray-900">阅读设置</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          {/* 字体大小 */}
          <section className="mb-5">
            <label className="text-xs text-gray-500 mb-2 block">字体大小</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => update({ fontSize: Math.max(14, settings.fontSize - 2) })}
                className="w-9 h-9 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all"
              >
                A-
              </button>
              <span className="text-sm text-gray-700 w-10 text-center">{settings.fontSize}</span>
              <button
                onClick={() => update({ fontSize: Math.min(24, settings.fontSize + 2) })}
                className="w-9 h-9 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 active:scale-95 transition-all"
              >
                A+
              </button>
            </div>
          </section>

          {/* 行距 */}
          <section className="mb-5">
            <label className="text-xs text-gray-500 mb-2 block">行距</label>
            <div className="flex gap-2">
              {([
                ['compact', '紧凑'],
                ['normal', '标准'],
                ['loose', '宽松'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => update({ lineHeight: val })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                    settings.lineHeight === val
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* 背景色 */}
          <section className="mb-5">
            <label className="text-xs text-gray-500 mb-2 block">背景色</label>
            <div className="flex gap-2">
              {([
                ['light', '☀️ 白'],
                ['dark', '🌙 黑'],
                ['paper', '📜 纸'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => update({ background: val })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                    settings.background === val
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* 字体 */}
          <section>
            <label className="text-xs text-gray-500 mb-2 block">字体</label>
            <div className="flex gap-2">
              {([
                ['serif', '宋体'],
                ['sans', '黑体'],
                ['kai', '楷体'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => update({ fontFamily: val })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                    settings.fontFamily === val
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/* ── 主页面 ── */

export default function ReadPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const chapter = getMockChapter(id);
  const { settings, update } = useReadingSettings();
  useReadingProgress(id);

  const [showBar, setShowBar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [prefetched, setPrefetched] = useState<Set<string>>(new Set());
  const lastScrollY = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // 顶部栏滚动显隐
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY.current;
      lastScrollY.current = y;
      if (delta > 30) setShowBar(false);
      else if (delta < -10) setShowBar(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 夜间模式：添加 dark class 到 html
  useEffect(() => {
    const html = document.documentElement;
    if (settings.background === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    return () => html.classList.remove('dark');
  }, [settings.background]);

  // 键盘翻页
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && chapter.prevId) {
        router.push(`/read/${chapter.prevId}`);
      } else if (e.key === 'ArrowRight' && chapter.nextId) {
        router.push(`/read/${chapter.nextId}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chapter.prevId, chapter.nextId, router]);

  // 章节预加载：滚动到80%时静默请求下一章
  useEffect(() => {
    if (!chapter.nextId || prefetched.has(chapter.nextId)) return;
    const onScroll = () => {
      const scrollH = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollH > 0 && window.scrollY / scrollH >= 0.8) {
        setPrefetched((prev) => new Set(prev).add(chapter.nextId!));
        // 静默预取下一章（mock 场景下仅标记，实际可 fetch API）
        fetch(`/read/${chapter.nextId}`).catch(() => {});
        console.log(`[阅读] 预加载章节: ${chapter.nextId}`);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [chapter.nextId, prefetched]);

  const bgClass = BG_MAP[settings.background].base;

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${bgClass} transition-colors duration-300`}>
      {/* 顶部栏 */}
      <header
        className={`fixed top-0 inset-x-0 z-30 transition-transform duration-300 ease-out ${
          showBar ? 'translate-y-0' : '-translate-y-full'
        } ${settings.background === 'dark' ? 'bg-reading-dark/90' : settings.background === 'paper' ? 'bg-reading-paper/90' : 'bg-reading-bg/90'} backdrop-blur-sm border-b ${settings.background === 'dark' ? 'border-white/10' : 'border-gray-200/60'}`}
      >
        <div className="max-w-reading mx-auto flex items-center justify-between h-11 px-4">
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-800 dark:text-reading-warm dark:hover:text-white transition-colors"
          >
            ← 返回
          </button>
          <span className={`text-sm truncate mx-4 ${settings.background === 'dark' ? 'text-reading-warm' : 'text-gray-600'}`}>
            《{chapter.novelTitle}》第{chapter.sortOrder}章
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className={`text-lg ${settings.background === 'dark' ? 'text-reading-warm' : 'text-gray-500'} hover:opacity-70 transition-opacity`}
            aria-label="阅读设置"
          >
            ☰
          </button>
        </div>
      </header>

      {/* 正文区 */}
      <article
        ref={contentRef}
        className="max-w-reading mx-auto px-5 pt-16 pb-24"
      >
        <h1
          className={`text-center font-bold mb-8 ${FONT_MAP[settings.fontFamily]}`}
          style={{ fontSize: settings.fontSize + 4 }}
        >
          {chapter.title}
        </h1>
        <div
          className={`${FONT_MAP[settings.fontFamily]} ${LINE_HEIGHT_MAP[settings.lineHeight]}`}
          style={{ fontSize: settings.fontSize }}
        >
          {chapter.content.split('\n\n').map((p, i) => (
            <p key={i} className="mb-[1.5em] indent-[2em]">
              {p}
            </p>
          ))}
        </div>
      </article>

      {/* 底部导航 */}
      <footer
        className={`fixed bottom-0 inset-x-0 z-30 ${settings.background === 'dark' ? 'bg-reading-dark/90' : settings.background === 'paper' ? 'bg-reading-paper/90' : 'bg-reading-bg/90'} backdrop-blur-sm border-t ${settings.background === 'dark' ? 'border-white/10' : 'border-gray-200/60'}`}
      >
        <div className="max-w-reading mx-auto flex gap-3 px-5 py-3">
          {chapter.prevId ? (
            <button
              onClick={() => router.push(`/read/${chapter.prevId}`)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
                settings.background === 'dark'
                  ? 'bg-white/10 text-reading-warm hover:bg-white/15'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              上一章
            </button>
          ) : (
            <div className="flex-1" />
          )}
          {chapter.nextId ? (
            <button
              onClick={() => router.push(`/read/${chapter.nextId}`)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-all active:scale-[0.98]"
            >
              下一章
            </button>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      </footer>

      {/* 设置面板 */}
      <SettingsPanel
        open={showSettings}
        settings={settings}
        update={update}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}
