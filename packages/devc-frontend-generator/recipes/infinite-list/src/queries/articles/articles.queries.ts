import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { listArticles, countArticles } from '@/shared/api/generated'
import type { ListArticlesParams } from '@/shared/api/generated/model'
import { articlesKeys } from './articles.keys'

// articles Query Domain의 queryOptions와 뮤테이션 훅. queryOptions는 서버 컴포넌트의 prefetch와 클라이언트 컴포넌트의 쿼리 훅(useSuspenseQuery 등)이 함께 쓴다.

export function listArticlesInfiniteQueryOptions(params: Omit<ListArticlesParams, 'page'> = {}) {
  return infiniteQueryOptions({
    queryKey: articlesKeys.listArticlesInfinite(params),
    queryFn: ({ pageParam, signal }) => listArticles({ ...params, page: pageParam }, { signal }),
    initialPageParam: 1,
    // 빈 페이지를 받으면 다음 페이지가 없다고 본다. 백엔드가 다음 페이지 정보를 함께 주면 그 값을 쓰도록 고친다.
    getNextPageParam: (lastPage, _allPages, lastPageParam) => (lastPage.length === 0 ? undefined : lastPageParam + 1),
  })
}

export function listArticlesQueryOptions(params: ListArticlesParams = {}) {
  return queryOptions({
    queryKey: articlesKeys.listArticles(params),
    queryFn: ({ signal }) => listArticles(params, { signal }),
  })
}

export function countArticlesQueryOptions() {
  return queryOptions({
    queryKey: articlesKeys.countArticles(),
    queryFn: ({ signal }) => countArticles({ signal }),
  })
}
