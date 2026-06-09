'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setDropdownOpen(false);
    await logout();
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-content mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-primary-500 shrink-0">
          墨卷
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm text-gray-700 hover:text-primary-500 transition-colors">发现</Link>
          <Link href="/search" className="text-sm text-gray-700 hover:text-primary-500 transition-colors">搜索</Link>

          {!loading && (
            user ? (
              <div className="flex items-center gap-4">
                <Link href="/bookshelf" className="text-sm text-gray-700 hover:text-primary-500 transition-colors">书架</Link>
                <Link href="/write" className="text-sm text-gray-700 hover:text-primary-500 transition-colors">创作台</Link>
                <div ref={dropdownRef} className="relative">
                  <button
                    onClick={() => setDropdownOpen(v => !v)}
                    className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 text-sm font-medium flex items-center justify-center hover:bg-primary-200 transition-colors"
                  >
                    {user.username[0]?.toUpperCase()}
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                      <Link href="/profile" onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">个人中心</Link>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-50">退出登录</button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="text-sm text-gray-700 hover:text-primary-500 transition-colors">登录</Link>
                <Link href="/register" className="text-sm px-4 py-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors">注册</Link>
              </div>
            )
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-gray-600"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="菜单"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-2 space-y-2">
          <Link href="/" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700">发现</Link>
          <Link href="/search" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700">搜索</Link>
          {!loading && (
            user ? (
              <>
                <Link href="/bookshelf" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700">书架</Link>
                <Link href="/write" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700">创作台</Link>
                <Link href="/profile" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700">个人中心</Link>
                <button onClick={() => { setMenuOpen(false); handleLogout(); }} className="block py-2 text-sm text-red-600">退出登录</button>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-gray-700">登录</Link>
                <Link href="/register" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-primary-500 font-medium">注册</Link>
              </>
            )
          )}
        </div>
      )}
    </nav>
  );
}
