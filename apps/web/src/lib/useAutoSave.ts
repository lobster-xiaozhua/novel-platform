'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type SaveStatus = 'saved' | 'saving' | 'unsaved';

export function useAutoSave(
  key: string,
  data: string,
  interval: number = 30000
) {
  const [status, setStatus] = useState<SaveStatus>('saved');
  const timerRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef(data);

  const save = useCallback(() => {
    if (data === lastSavedRef.current) return;
    setStatus('saving');
    localStorage.setItem(`autosave-${key}`, data);
    lastSavedRef.current = data;
    setTimeout(() => setStatus('saved'), 500);
  }, [key, data]);

  useEffect(() => {
    if (data !== lastSavedRef.current) {
      setStatus('unsaved');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(save, interval);
    }
    return () => clearTimeout(timerRef.current);
  }, [data, interval, save]);

  const restore = useCallback(() => {
    const saved = localStorage.getItem(`autosave-${key}`);
    return saved || null;
  }, [key]);

  return { status, save, restore };
}
