// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/src/features/article-list/article-paged-list.tsx

'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { countArticlesQueryOptions, listArticlesQueryOptions } from '@/queries/articles/articles.queries'
import { failedWithoutData } from '@/shared/paging/failed-without-data'
import { Pagination } from '@/shared/paging/pagination'
import { Button } from '@/shared/ui/button'
import { ArticleSummary } from './article-summary'

// infinite-list Recipe: 무한 스크롤 목록과 같은 게시글(listArticles)을 번호형 페이지네이션으로 보여 준다. 쪽마다
// `npm run g -- query listArticles`가 만든 queryOptions로 그 쪽만 가져오고, 쪽 수는 전체 게시글 수(countArticles)로 정한다.
// 무한 스크롤 목록과 쿼리 키가 달라('infinite' 단계) 캐시는 따로 둔다(ADR-0008).

const PAGE_SIZE = 10

/**
 * 쪽 번호로 넘겨 보는 게시글 목록. 브라우저가 지금 쪽을 가져오므로(CSR) Rendering Mode server와 static-export에서 같은
 * 코드로 동작한다. 쪽을 바꾸면 다음 쪽을 받는 동안 마지막으로 받은 쪽을 그대로 보여 준다(keepPreviousData).
 */
export function ArticlePagedList() {
  const [page, setPage] = useState(1)
  const countQuery = useQuery(countArticlesQueryOptions())
  const pageQuery = useQuery({
    ...listArticlesQueryOptions({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const countFailed = failedWithoutData(countQuery)
  const pageFailed = failedWithoutData(pageQuery)
  const isError = countFailed || pageFailed
  const total = countQuery.data?.total
  const pageArticles = isError ? undefined : pageQuery.data
  // 지금 쪽(받은 게시글)이 전체 게시글 가운데 몇 번째부터 몇 번째까지인지 알린다.
  // 불러오지 못했으면 비워 두고 오류 문구(role="alert")로 알린다.
  let summary = ''
  if (!isError) {
    if (total === undefined || pageArticles === undefined) summary = '게시글 목록을 불러오는 중입니다.'
    else if (total === 0) summary = '게시글 목록이 비어 있습니다.'
    else {
      const first = (page - 1) * PAGE_SIZE + 1
      summary = `게시글 ${String(total)}개 중 ${String(first)}–${String(first + pageArticles.length - 1)}번째`
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm text-muted-foreground">
        {summary}
      </p>
      {isError && (
        <>
          <p role="alert" className="text-sm text-danger">
            게시글 목록을 불러오지 못했습니다.
          </p>
          <Button
            variant="secondary"
            className="self-start"
            onClick={() => {
              if (countFailed) void countQuery.refetch()
              if (pageFailed) void pageQuery.refetch()
            }}
          >
            다시 시도
          </Button>
        </>
      )}
      {total !== undefined && pageArticles !== undefined && pageArticles.length > 0 && (
        <ul aria-label="게시글 목록" aria-busy={pageQuery.isPlaceholderData} className="flex flex-col gap-3">
          {pageArticles.map((article) => (
            <li key={article.id}>
              <ArticleSummary article={article} />
            </li>
          ))}
        </ul>
      )}
      {/* 한 쪽을 불러오지 못해도 쪽 번호는 남겨 다른 쪽으로 옮길 수 있게 한다. */}
      {total !== undefined && total > 0 && !pageQuery.isPending && (
        <Pagination
          label="게시글 목록 페이지"
          page={page}
          pageCount={Math.ceil(total / PAGE_SIZE)}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
