'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, apiPut, type Chapter } from '@/lib/api';
import { useAutoSave } from '@/lib/useAutoSave';
import MarkdownPreview from '@/components/MarkdownPreview';

export default function ChapterEditorPage() {
  const params = useParams();
  const router = useRouter();
  const novelId = params.novelId as string;
  const chapterId = params.chapterId as string;

  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const { status, save, restore } = useAutoSave(
    `${novelId}-${chapterId}`,
    content
  );

  // Load chapter data
  useEffect(() => {
    async function load() {
      try {
        const res = await api<Chapter & { content?: string }>(`/api/chapters/${chapterId}`);
        if (res.code === 0 && res.data) {
          setChapter(res.data);
          setTitle(res.data.title);
          // Try to restore autosaved content first
          const autosaved = restore();
          if (autosaved !== null) {
            setContent(autosaved);
          } else {
            setContent((res.data as Chapter & { content?: string }).content || '');
          }
        }
      } catch (err) {
        console.error('[ChapterEditor] 加载章节失败:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [chapterId, restore]);

  // Save to API when autosave triggers
  const saveToApi = useCallback(async () => {
    try {
      await apiPut(`/api/chapters/${chapterId}`, { title, content });
    } catch (err) {
      console.error('[ChapterEditor] 保存到服务器失败:', err);
    }
  }, [chapterId, title, content]);

  // Sync autosave with API save
  useEffect(() => {
    if (status === 'saving') {
      saveToApi();
    }
  }, [status, saveToApi]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      // Save first
      await apiPut(`/api/chapters/${chapterId}`, { title, content, published: true });
      router.push(`/write/${novelId}`);
    } catch (err) {
      console.error('[ChapterEditor] 发布失败:', err);
    } finally {
      setPublishing(false);
    }
  };

  const wordCount = content.replace(/\s/g, '').length;

  const statusLabel: Record<string, { text: string; color: string }> = {
    saved: { text: '已保存 ✓', color: 'text-green-600' },
    saving: { text: '保存中...', color: 'text-yellow-600' },
    unsaved: { text: '未保存', color: 'text-red-500' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-reading-bg">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-12 bg-white border-b border-gray-200 shrink-0">
        <Link
          href={`/write/${novelId}`}
          className="text-gray-500 hover:text-gray-700 transition-colors text-sm shrink-0"
        >
          ← 返回
        </Link>
        <div className="w-px h-5 bg-gray-200" />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 text-sm font-medium text-gray-900 bg-transparent outline-none placeholder:text-gray-300"
          placeholder="章节标题"
        />
        <button
          onClick={handlePublish}
          disabled={publishing}
          className="px-4 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 shrink-0"
        >
          {publishing ? '发布中...' : '发布'}
        </button>
      </div>

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Markdown editor */}
        <div className="flex-1 flex flex-col border-r border-gray-200">
          <div className="px-4 py-2 text-xs text-gray-400 bg-white border-b border-gray-100">
            Markdown 编辑
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 p-4 bg-white text-gray-900 text-sm leading-relaxed font-mono resize-none outline-none"
            placeholder="开始写作..."
            spellCheck={false}
          />
        </div>

        {/* Right: Preview */}
        <div className="flex-1 flex flex-col bg-reading-paper overflow-y-auto">
          <div className="px-4 py-2 text-xs text-gray-400 bg-white border-b border-gray-100 sticky top-0">
            实时预览
          </div>
          <div className="p-6">
            {content ? (
              <MarkdownPreview content={content} />
            ) : (
              <p className="text-gray-300 text-sm">在左侧编辑器中输入内容，这里将实时预览</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-4 h-8 bg-white border-t border-gray-200 text-xs shrink-0">
        <span className="text-gray-500">字数：{wordCount.toLocaleString()}</span>
        <span className={statusLabel[status]?.color || 'text-gray-400'}>
          {statusLabel[status]?.text || ''}
        </span>
      </div>
    </div>
  );
}
