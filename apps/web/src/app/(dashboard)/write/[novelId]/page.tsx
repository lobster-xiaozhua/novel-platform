'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api, apiPost, apiDelete, type Novel, type Chapter } from '@/lib/api';

export default function ChapterManagePage() {
  const params = useParams();
  const router = useRouter();
  const novelId = params.novelId as string;

  const [novel, setNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [novelRes, chaptersRes] = await Promise.all([
        api<Novel>(`/api/novels/${novelId}`),
        api<Chapter[]>(`/api/novels/${novelId}/chapters`),
      ]);
      if (novelRes.code === 0 && novelRes.data) setNovel(novelRes.data);
      if (chaptersRes.code === 0 && chaptersRes.data) {
        setChapters(
          [...(chaptersRes.data as Chapter[])].sort((a, b) => a.sortOrder - b.sortOrder)
        );
      }
    } catch (err) {
      console.error('[ChapterManage] 获取数据失败:', err);
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Drag & Drop handlers
  const handleDragStart = (idx: number) => {
    dragItemRef.current = idx;
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const sourceIdx = dragItemRef.current;
    if (sourceIdx === null || sourceIdx === targetIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }

    const updated = [...chapters];
    const [moved] = updated.splice(sourceIdx, 1);
    updated.splice(targetIdx, 0, moved);
    // Reassign sortOrder
    updated.forEach((ch, i) => {
      ch.sortOrder = i + 1;
    });
    setChapters(updated);

    try {
      await apiPost('/api/chapters/reorder', {
        novelId,
        order: updated.map((ch) => ch.id),
      });
    } catch (err) {
      console.error('[ChapterManage] 排序保存失败:', err);
    }

    setDragIdx(null);
    setDragOverIdx(null);
    dragItemRef.current = null;
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
    dragItemRef.current = null;
  };

  const handleAddChapter = async () => {
    const title = `第${chapters.length + 1}章`;
    try {
      const res = await apiPost<Chapter>('/api/chapters', {
        novelId,
        title,
        sortOrder: chapters.length + 1,
      });
      if (res.code === 0 && res.data) {
        setChapters((prev) => [...prev, res.data as Chapter]);
        // Navigate to editor for the new chapter
        router.push(`/write/${novelId}/${(res.data as Chapter).id}`);
      } else {
        console.error('[ChapterManage] 新增章节失败:', res.message);
      }
    } catch (err) {
      console.error('[ChapterManage] 新增章节请求失败:', err);
    }
  };

  const handlePublish = async (chapter: Chapter) => {
    try {
      const res = await apiPost<Chapter>(`/api/chapters/${chapter.id}/publish`, {});
      if (res.code === 0) {
        setChapters((prev) =>
          prev.map((ch) => (ch.id === chapter.id ? { ...ch, publishedAt: new Date().toISOString() } : ch))
        );
      } else {
        console.error('[ChapterManage] 发布失败:', res.message);
      }
    } catch (err) {
      console.error('[ChapterManage] 发布请求失败:', err);
    }
  };

  const handleDelete = async (chapterId: string) => {
    if (!confirm('确定要删除这个章节吗？此操作不可撤销。')) return;
    try {
      const res = await apiDelete(`/api/chapters/${chapterId}`);
      if (res.code === 0) {
        setChapters((prev) => prev.filter((ch) => ch.id !== chapterId));
      } else {
        console.error('[ChapterManage] 删除失败:', res.message);
      }
    } catch (err) {
      console.error('[ChapterManage] 删除请求失败:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-content mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/write"
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← 返回
        </Link>
        <h1 className="text-xl font-bold text-gray-900 truncate">
          《{novel?.title || '...'}》章节管理
        </h1>
      </div>

      {/* Chapter list */}
      {chapters.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500">还没有章节，点击下方按钮开始创作</p>
        </div>
      ) : (
        <div className="space-y-2">
          {chapters.map((chapter, idx) => {
            const isPublished = !!chapter.publishedAt;
            return (
              <div
                key={chapter.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`
                  flex items-center gap-3 bg-white rounded-lg border px-4 py-3 transition-all
                  ${dragIdx === idx ? 'opacity-50' : ''}
                  ${dragOverIdx === idx ? 'border-primary-400 border-2' : 'border-gray-100'}
                  hover:shadow-sm cursor-grab active:cursor-grabbing
                `}
              >
                {/* Drag handle */}
                <span className="text-gray-300 select-none text-lg">☰</span>

                {/* Chapter info */}
                <div className="flex-1 min-w-0">
                  <span className="text-gray-400 text-sm mr-2">第{idx + 1}章</span>
                  <span className="text-gray-900 font-medium truncate">{chapter.title}</span>
                </div>

                {/* Status badge */}
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    isPublished
                      ? 'bg-green-50 text-green-600'
                      : 'bg-yellow-50 text-yellow-600'
                  }`}
                >
                  {isPublished ? '已发布' : '草稿'}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/write/${novelId}/${chapter.id}`}
                    className="px-3 py-1 text-sm border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                  >
                    编辑
                  </Link>
                  {!isPublished && (
                    <button
                      onClick={() => handlePublish(chapter)}
                      className="px-3 py-1 text-sm bg-primary-50 text-primary-600 rounded-md hover:bg-primary-100 transition-colors"
                    >
                      发布
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(chapter.id)}
                    className="px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add chapter button */}
      <div className="mt-6">
        <button
          onClick={handleAddChapter}
          className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-primary-300 hover:text-primary-500 transition-colors text-sm"
        >
          + 新增章节
        </button>
      </div>
    </div>
  );
}
