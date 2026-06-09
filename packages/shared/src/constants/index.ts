// 错误码
export const ErrorCode = {
  // 通用错误 40xxx
  VALIDATION_ERROR: 40000,
  RESOURCE_EXISTS: 40001,
  RESOURCE_NOT_FOUND: 40002,

  // 认证错误 41xxx
  UNAUTHORIZED: 41001,
  TOKEN_EXPIRED: 41002,
  FORBIDDEN: 41003,

  // 业务错误 42xxx
  CHAPTER_NOT_PUBLISHED: 42001,
  BOOKSHELF_EXISTS: 42002,
  AUTHOR_APP_EXISTS: 42003,

  // 服务错误 50xxx
  INTERNAL_ERROR: 50000,
  DB_ERROR: 50001,
  SEARCH_ERROR: 50002,
} as const;

// 角色
export const Roles = {
  READER: 'reader',
  AUTHOR: 'author',
  ADMIN: 'admin',
} as const;

// 小说状态
export const NovelStatuses = {
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  HIATUS: 'hiatus',
} as const;

// 分类
export const Categories = [
  '玄幻', '都市', '科幻', '仙侠', '历史',
  '游戏', '体育', '灵异', '军事', '现实',
] as const;

// 限流配置
export const RateLimitConfig = {
  LOGIN: { windowMs: 60_000, max: 5 },
  API: { windowMs: 60_000, max: 60 },
  SEARCH: { windowMs: 60_000, max: 20 },
} as const;
