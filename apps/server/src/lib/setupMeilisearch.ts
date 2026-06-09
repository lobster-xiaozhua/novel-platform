import meilisearch, { NOVELS_INDEX, CHAPTERS_INDEX } from './meilisearch';
import pino from 'pino';

const logger = pino();

export async function setupMeilisearch() {
  try {
    // 创建或更新 novels 索引
    const novelsIndex = meilisearch.index(NOVELS_INDEX);
    await novelsIndex.updateSearchableAttributes(['title', 'authorName', 'description', 'tags']);
    await novelsIndex.updateFilterableAttributes(['category', 'status']);
    await novelsIndex.updateSortableAttributes(['updatedAt', 'wordCount']);
    await novelsIndex.updateRankingRules(['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness']);

    // 创建或更新 chapters 索引
    const chaptersIndex = meilisearch.index(CHAPTERS_INDEX);
    await chaptersIndex.updateSearchableAttributes(['chapterTitle', 'content', 'novelTitle']);
    await chaptersIndex.updateFilterableAttributes(['novelId']);
    await chaptersIndex.updateSortableAttributes(['sortOrder']);
    await chaptersIndex.updateRankingRules(['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness']);
    await chaptersIndex.updateDisplayedAttributes(['id', 'novelId', 'novelTitle', 'chapterTitle', 'contentPreview', 'sortOrder']);

    logger.info('Meilisearch 索引配置完成');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Meilisearch 索引配置失败');
    throw err;
  }
}
