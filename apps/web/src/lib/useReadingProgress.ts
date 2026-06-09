'use client';

import { useEffect, useRef, useCallback } from 'react';

export function useReadingProgress(chapterId: string) {
  const timerRef = useRef<NodeJS.Timeout>();

  const save = useCallback(() => {
    localStorage.setItem(`progress-${chapterId}`, JSON.stringify({
      chapterId,
      scrollY: window.scrollY,
      timestamp: Date.now(),
    }));
  }, [chapterId]);

  useEffect(() => {
    const handleScroll = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(save, 3000);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timerRef.current);
    };
  }, [save]);

  // 恢复进度
  useEffect(() => {
    const saved = localStorage.getItem(`progress-${chapterId}`);
    if (saved) {
      try {
        const { scrollY } = JSON.parse(saved);
        setTimeout(() => window.scrollTo(0, scrollY), 100);
      } catch {}
    }
  }, [chapterId]);
}
