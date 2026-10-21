'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { countArticlesQueryOptions, listArticlesQueryOptions } from '@/queries/articles/articles.queries'
import { Pagination } from '@/shared/paging/pagination'
import { Button } from '@/shared/ui/button'
import { ArticleSummary } from './article-summary'

// infinite-list Recipe: 무한 스크롤 목록과 같은 게시글(listArticles)을 번호형 페이지네이션으로 보여 준다. 쪽마다
// `npm run g -- query listArticles`가 만든 queryOptions로 그 쪽만 가져오고, 쪽 수는 전체 게시글 수(countArticles)로 정한다.
// 무한 스크롤 목록과 쿼리 키가 달라('infinite' 단계) 캐시는 따로 둔다(ADR-0008).

const PAGE_SIZE = 10

/**
 * 쪽 번호로 넘겨 보는 게시글 목록. 브라우저가 지금 쪽을 가져오므로(CSR) Rendering Mode server와 static-export에서 같은
 * 코드로 동작한다. 쪽을 바꾸면 다음 쪽을 받는 동안 지금 쪽을 그대로 보여 준다(keepPreviousData).
 */
export function ArticlePagedList() {
  const [page, setPage] = useState(1)
  const count = useQuery(countArticlesQueryOptions())
  const articles = useQuery({
    ...listArticlesQueryOptions({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  const countFailed = failedWithoutData(count)
  const pageFailed = failedWithoutData(articles)
  const isError = countFailed || pageFailed
  const total = count.data?.total
  const shown = isError ? undefined : articles.data

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="text-sm text-muted-foreground">
        {isError ? '' : summaryOf(total, page, shown?.length)}
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
              if (countFailed) void count.refetch()
              if (pageFailed) void articles.refetch()
            }}
          >
            다시 시도
          </Button>
        </>
      )}
      {total !== undefined && shown !== undefined && shown.length > 0 && (
        <ul aria-label="게시글 목록" aria-busy={articles.isPlaceholderData} className="flex flex-col gap-3">
          {shown.map((article) => (
            <li key={article.id}>
              <ArticleSummary article={article} />
            </li>
          ))}
        </ul>
      )}
      {/* 한 쪽을 불러오지 못해도 쪽 번호는 남겨 다른 쪽으로 옮길 수 있게 한다. */}
      {total !== undefined && total > 0 && !articles.isPending && (
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

/**
 * 보여 줄 데이터를 받지 못했다. 받아 둔 데이터를 다시 가져오다(창에 돌아왔을 때 등) 실패한 것은 그 데이터를 그대로
 * 보여 주고 다음에 다시 가져오므로 알리지 않는다.
 */
function failedWithoutData(query: { isError: boolean; data: unknown }): boolean {
  return query.isError && query.data === undefined
}

/** 지금 쪽이 전체 게시글 가운데 몇 번째부터 몇 번째까지인지 알린다. */
function summaryOf(total: number | undefined, page: number, shown: number | undefined): string {
  if (total === undefined || shown === undefined) return '게시글 목록을 불러오는 중입니다.'
  if (total === 0) return '게시글 목록이 비어 있습니다.'
  const first = (page - 1) * PAGE_SIZE + 1
  return `게시글 ${String(total)}개 중 ${String(first)}–${String(first + shown - 1)}번째`
}
