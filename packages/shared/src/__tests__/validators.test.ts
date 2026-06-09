import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, createNovelSchema, searchSchema } from '../validators';

describe('registerSchema', () => {
  it('accepts valid input', () => {
    const result = registerSchema.safeParse({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short username', () => {
    const result = registerSchema.safeParse({
      username: 'ab',
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      username: 'testuser',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = registerSchema.safeParse({
      username: 'testuser',
      email: 'test@example.com',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid input', () => {
    const result = loginSchema.safeParse({
      username: 'testuser',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty fields', () => {
    const result = loginSchema.safeParse({
      username: '',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('createNovelSchema', () => {
  it('accepts valid input', () => {
    const result = createNovelSchema.safeParse({
      title: '我的小说',
      description: '一个故事',
      category: '玄幻',
      tags: ['修仙', '热血'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = createNovelSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });
});

describe('searchSchema', () => {
  it('applies defaults', () => {
    const result = searchSchema.safeParse({ q: '测试' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('all');
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });
});
