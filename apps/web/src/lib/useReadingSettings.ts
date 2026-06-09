'use client';

import { useState, useEffect } from 'react';

interface ReadingSettings {
  fontSize: number;       // 14-24
  lineHeight: 'compact' | 'normal' | 'loose';
  background: 'light' | 'dark' | 'paper';
  fontFamily: 'serif' | 'sans' | 'kai';
}

const STORAGE_KEY = 'reading-settings';

const defaults: ReadingSettings = {
  fontSize: 18,
  lineHeight: 'normal',
  background: 'light',
  fontFamily: 'serif',
};

export function useReadingSettings() {
  const [settings, setSettings] = useState<ReadingSettings>(defaults);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSettings({ ...defaults, ...JSON.parse(saved) });
      } catch {}
    }
  }, []);

  const update = (partial: Partial<ReadingSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return { settings, update };
}

export type { ReadingSettings };
