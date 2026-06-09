import { MeiliSearch } from 'meilisearch';

const meilisearch = new MeiliSearch({
  host: process.env.MEILI_HOST || 'http://localhost:7700',
  apiKey: process.env.MEILI_MASTER_KEY || '',
});

export default meilisearch;

// 索引名称
export const NOVELS_INDEX = 'novels';
export const CHAPTERS_INDEX = 'chapters';
