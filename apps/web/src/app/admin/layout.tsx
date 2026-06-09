'use client';

import { useAuth } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV_ITEMS = [
  { label: '仪表盘', href: '/admin', icon: '📊' },
  { label: '用户管理', href: '/admin/users', icon: '👥' },
  { label: '作者申请', href: '/admin/applications', icon: '✍️' },
  { label: '小说审核', href: '/admin/novels', icon: '📖' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // 登录页不需要鉴权
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (!loading && !isLoginPage) {
      if (!user) {
        router.replace('/admin/login');
      } else if (user.role !== 'admin') {
        router.replace('/');
      }
    }
  }, [user, loading, isLoginPage, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isLoginPage) return <>{children}</>;

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* 侧边栏 */}
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-56'
        } flex-shrink-0 bg-gray-900 text-white transition-all duration-200 flex flex-col`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-700">
          {!collapsed && (
            <h1 className="text-base font-bold tracking-wide truncate">墨卷管理后台</h1>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-gray-700 text-gray-300"
            title={collapsed ? '展开' : '收起'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
        <nav className="flex-1 py-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-primary-700 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </a>
            );
          })}
        </nav>
        <div className="border-t border-gray-700 p-2">
          <a
            href="/"
            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <span className="text-base">🏠</span>
            {!collapsed && <span>返回前台</span>}
          </a>
        </div>
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-800">
            {NAV_ITEMS.find((i) => pathname === i.href || (i.href !== '/admin' && pathname.startsWith(i.href)))?.label ?? '管理后台'}
          </h2>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span>{user.username}</span>
            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded text-xs font-medium">管理员</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
