// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/src/queries/articles/articles.keys.ts

import type { ListArticlesParams } from '@/shared/api/generated/model'

// articles Query Domain(OpenAPI tag `articles`)의 쿼리 키. 위 단계의 키로 아래 단계를 한꺼번에 무효화할 수 있게
// ['articles'] → ['articles', <operationId>] → ['articles', <operationId>, ...인자]처럼 계층으로 만든다.
export const articlesKeys = {
  all: ['articles'] as const,
  listArticlesInfinite: (params: Omit<ListArticlesParams, 'page'>) =>
    [...articlesKeys.all, 'listArticles', 'infinite', params] as const,
  listArticles: (params: ListArticlesParams) => [...articlesKeys.all, 'listArticles', params] as const,
  countArticles: () => [...articlesKeys.all, 'countArticles'] as const,
}
