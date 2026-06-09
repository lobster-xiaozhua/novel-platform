'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (key: string, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.username.length < 3) e.username = '用户名至少 3 个字符';
    if (!validateEmail(form.email)) e.email = '邮箱格式不正确';
    if (form.password.length < 8) e.password = '密码至少 8 个字符';
    if (form.password !== form.confirmPassword) e.confirmPassword = '两次密码不一致';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;

    setSubmitting(true);
    try {
      await register(form.username, form.email, form.password);
      router.push('/login');
    } catch (err) {
      setServerError(err instanceof Error ? err.message : '注册失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (field: string) =>
    `w-full px-4 py-2.5 border rounded-lg outline-none transition-colors ${
      errors[field] ? 'border-red-400 focus:ring-red-300 focus:border-red-400' : 'border-gray-300 focus:ring-primary-400 focus:border-primary-400'
    } focus:ring-2`;

  return (
    <div className="w-full max-w-md">
      <div className="lg:hidden text-center mb-8">
        <h1 className="text-4xl font-bold text-primary-500 mb-2">墨卷</h1>
        <p className="text-gray-500">万千故事，皆在指尖</p>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">注册</h2>

      {serverError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">用户名</label>
          <input id="username" type="text" value={form.username} onChange={e => update('username', e.target.value)} placeholder="至少 3 个字符" className={inputCls('username')} autoComplete="username" />
          {errors.username && <p className="mt-1 text-xs text-red-500">{errors.username}</p>}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">邮箱</label>
          <input id="email" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="your@email.com" className={inputCls('email')} autoComplete="email" />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">密码</label>
          <input id="password" type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="至少 8 个字符" className={inputCls('password')} autoComplete="new-password" />
          {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">确认密码</label>
          <input id="confirmPassword" type="password" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} placeholder="再次输入密码" className={inputCls('confirmPassword')} autoComplete="new-password" />
          {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
        </div>

        <button type="submit" disabled={submitting} className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-300 text-white font-medium rounded-lg transition-colors">
          {submitting ? '注册中…' : '注册'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        已有账号？
        <Link href="/login" className="text-primary-500 hover:text-primary-600 ml-1 font-medium">立即登录</Link>
      </p>
    </div>
  );
}
