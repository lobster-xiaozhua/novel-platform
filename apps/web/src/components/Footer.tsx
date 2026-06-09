import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="max-w-content mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} 墨卷. 保留所有权利.</p>
        <div className="flex gap-6">
          <Link href="/about" className="hover:text-primary-500 transition-colors">关于我们</Link>
          <Link href="/terms" className="hover:text-primary-500 transition-colors">服务条款</Link>
          <Link href="/privacy" className="hover:text-primary-500 transition-colors">隐私政策</Link>
        </div>
      </div>
    </footer>
  );
}
