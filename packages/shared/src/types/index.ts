// 用户角色
export type UserRole = 'reader' | 'author' | 'admin';

// 小说状态
export type NovelStatus = 'ongoing' | 'completed' | 'hiatus';

// 用户
export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  role: UserRole;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

// 小说
export interface Novel {
  id: string;
  authorId: string;
  title: string;
  coverUrl: string | null;
  description: string | null;
  category: string | null;
  tags: string[];
  status: NovelStatus;
  wordCount: number;
  viewCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

// 章节
export interface Chapter {
  id: string;
  novelId: string;
  title: string;
  content: string;
  wordCount: number;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// 书架
export interface BookshelfItem {
  id: string;
  userId: string;
  novelId: string;
  lastChapterId: string | null;
  addedAt: string;
}

// 作者申请
export type AuthorAppStatus = 'pending' | 'approved' | 'rejected';

export interface AuthorApplication {
  id: string;
  userId: string;
  status: AuthorAppStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

// API 响应
export interface ApiResponse<T = unknown> {
  code: number;
  data: T | null;
  message: string;
}

// 分页
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 搜索
export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface SearchHit {
  title: string;
  snippet: string;
}
