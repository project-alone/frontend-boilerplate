// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/src/features/article-list/article-infinite-list.tsx

'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { listArticlesInfiniteQueryOptions } from '@/queries/articles/articles.queries'
import { failedWithoutData } from '@/shared/paging/failed-without-data'
import { InfiniteList } from '@/shared/paging/infinite-list'
import { ArticleSummary } from './article-summary'

// infinite-list Recipe: 게시글 목록(listArticles)을 무한 스크롤로 보여 준다. 쿼리는 `npm run g -- query listArticles
// --infinite`가 만든 infiniteQueryOptions 그대로이고, 페이지 번호를 하나씩 늘려 가져오다 빈 페이지를 받으면 멈춘다.
// 다른 목록에 쓰려면 이 파일을 복사해 쓰는 infiniteQueryOptions와 항목(ArticleSummary)을 바꾼다.

const PAGE_SIZE = 10

/**
 * 최근 게시글부터 보여 주는 무한 스크롤 목록. 브라우저가 첫 페이지부터 가져오므로(CSR) Rendering Mode server와
 * static-export에서 같은 코드로 동작한다.
 */
export function ArticleInfiniteList() {
  const { data, hasNextPage, isFetchingNextPage, isError, isFetchNextPageError, fetchNextPage, refetch } =
    useInfiniteQuery(listArticlesInfiniteQueryOptions({ pageSize: PAGE_SIZE }))
  // 첫 페이지나 다음 페이지를 받지 못한 것만 알린다. 받아 둔 페이지를 다시 가져오다 실패한 것은 목록을 그대로 둔다.
  const failed = isFetchNextPageError || failedWithoutData({ isError, data })

  return (
    <InfiniteList
      itemName="게시글"
      items={data?.pages.flat()}
      getKey={(article) => article.id}
      renderItem={(article) => <ArticleSummary article={article} />}
      hasNextPage={hasNextPage}
      isFetchingNextPage={isFetchingNextPage}
      isError={failed}
      onLoadMore={() => {
        void fetchNextPage()
      }}
      onRetry={() => {
        // 다음 페이지가 실패했으면 그 페이지만, 첫 페이지가 실패했으면 처음부터 다시 가져온다.
        void (isFetchNextPageError ? fetchNextPage() : refetch())
      }}
    />
  )
}
