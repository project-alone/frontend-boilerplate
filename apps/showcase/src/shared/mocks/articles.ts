// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/src/shared/mocks/articles.ts

import { http, HttpResponse } from 'msw'
import { MOCK_API_BASE_URL } from '@/shared/api/base-url'
import { type Article, type ArticleCount, ListArticlesParams } from '@/shared/api/generated/model'
import { slicePage } from '@/shared/lib/array'
import { searchParamsOf } from '@/shared/lib/http'

// infinite-list Recipe: 게시글 목록(listArticles)과 게시글 수(countArticles)를 흉내 내는 MSW 핸들러. 명세에서 생성한
// 핸들러는 example을 그대로 돌려주므로, 이 핸들러가 그보다 앞에서 페이지 번호대로 나눈 페이지를 백엔드처럼 돌려준다.
// 확장 지점 mockHandlers(Recipe의 extensions.json)로 선언해, MSW의 핸들러 목록(src/shared/mocks/handlers.ts)이 생성된
// 핸들러보다 앞에 둔다. Vitest, 개발 서버, E2E가 모두 이 핸들러를 쓰므로 결과가 늘 같도록 게시글을 고정된 규칙으로 만든다.

/** 목 백엔드에 있는 게시글 수. 한 페이지에 10개씩이면 다섯 페이지이고, 마지막 페이지에는 6개가 있다. */
const ARTICLE_COUNT = 46

const CATEGORIES = ['릴리스 노트', '운영 공지', '개발 블로그'] as const

const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'UTC' })

/**
 * 목 백엔드의 게시글. 최근에 올린 글(id가 큰 글)이 앞에 온다. 첫 글(id 1)은 2024년 1월 3일에 올렸고, 그 뒤로 한 주에 하나씩
 * 올렸다.
 */
const ARTICLES: readonly Article[] = Array.from({ length: ARTICLE_COUNT }, (_, index): Article => {
  const id = ARTICLE_COUNT - index
  const category = CATEGORIES[(id - 1) % CATEGORIES.length] ?? CATEGORIES[0]
  const publishedAt = new Date(Date.UTC(2024, 0, 3 + (id - 1) * 7))
  return {
    id,
    title: `${category} ${String(id)}호`,
    summary: `${DATE_FORMAT.format(publishedAt)}에 올린 ${category}입니다.`,
    publishedAt: publishedAt.toISOString().slice(0, 10),
  }
})

export const articlesHandlers = [
  http.get(`${MOCK_API_BASE_URL}/articles`, ({ request }) => {
    // 실제 백엔드처럼 명세에 없는 값(0쪽, 너무 큰 pageSize 등)은 400으로 거절한다.
    const params = ListArticlesParams.safeParse(searchParamsOf(new URL(request.url), ['page', 'pageSize']))
    if (!params.success) return HttpResponse.json({ message: params.error.message }, { status: 400 })
    // 명세의 listArticles처럼 page번째 페이지를 돌려준다. 마지막 페이지 뒤의 페이지는 빈 배열이다.
    return HttpResponse.json(slicePage(ARTICLES, params.data.page, params.data.pageSize))
  }),
  http.get(`${MOCK_API_BASE_URL}/articles/count`, () =>
    HttpResponse.json({ total: ARTICLES.length } satisfies ArticleCount),
  ),
]
