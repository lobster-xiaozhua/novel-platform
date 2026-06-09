import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPaths = ['/profile', '/bookshelf', '/write'];
const authPaths = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('accessToken')?.value;

  // 已登录用户访问登录/注册页，重定向到首页
  if (authPaths.some(p => pathname.startsWith(p)) && accessToken) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 未登录用户访问受保护页面，重定向到登录页
  if (protectedPaths.some(p => pathname.startsWith(p)) && !accessToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/profile/:path*', '/bookshelf/:path*', '/write/:path*', '/login', '/register'],
};
