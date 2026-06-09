'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

function LoginContent() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('请填写用户名和密码');
      return;
    }

    setSubmitting(true);
    try {
      await login(username, password);
      const from = searchParams.get('from') || '/';
      router.push(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="lg:hidden text-center mb-8">
        <h1 className="text-4xl font-bold text-primary-500 mb-2">墨卷</h1>
        <p className="text-gray-500">万千故事，皆在指尖</p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">登录</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
            用户名
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="请输入用户名"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition-colors"
            autoComplete="username"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
            密码
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="请输入密码"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400 outline-none transition-colors"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white font-medium rounded-lg transition-colors"
        >
          {submitting ? '登录中…' : '登录'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        还没有账号？
        <Link href="/register" className="text-primary-500 hover:text-primary-600 ml-1 font-medium">
          立即注册
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-md py-16 text-center text-gray-400">加载中…</div>}>
      <LoginContent />
    </Suspense>
  );
}
