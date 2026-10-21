import { http, HttpResponse } from 'msw'
import { type Article, type ArticleCount, ListArticlesParams } from '@/shared/api/generated/model'

// infinite-list Recipe: 게시글 목록(listArticles)과 게시글 수(countArticles)를 흉내 내는 MSW 핸들러. 명세에서 생성한
// 핸들러는 example을 그대로 돌려주므로, 이 핸들러가 그보다 앞에서(handlers.ts) 페이지 번호대로 나눈 페이지를 백엔드처럼
// 돌려준다. Vitest, 개발 서버, E2E가 모두 이 핸들러를 쓰므로 결과가 늘 같도록 게시글을 고정된 규칙으로 만든다.

/** 목 백엔드에 있는 게시글 수. 한 페이지에 10개씩이면 다섯 페이지이고, 마지막 페이지에는 6개가 있다. */
const ARTICLE_COUNT = 46

const CATEGORIES = ['릴리스 노트', '운영 공지', '개발 블로그'] as const

const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'UTC' })

/** id번째로 올린 게시글. 첫 글은 2024년 1월 3일에 올렸고, 그 뒤로 한 주에 하나씩 올렸다. */
function articleOf(id: number): Article {
  const category = CATEGORIES[(id - 1) % CATEGORIES.length] ?? CATEGORIES[0]
  const publishedAt = new Date(Date.UTC(2024, 0, 3 + (id - 1) * 7))
  return {
    id,
    title: `${category} ${String(id)}호`,
    summary: `${DATE_FORMAT.format(publishedAt)}에 올린 ${category}입니다.`,
    publishedAt: publishedAt.toISOString().slice(0, 10),
  }
}

/** 목 백엔드의 게시글. 최근에 올린 글(id가 큰 글)이 앞에 온다. */
const ARTICLES: readonly Article[] = Array.from({ length: ARTICLE_COUNT }, (_, index) =>
  articleOf(ARTICLE_COUNT - index),
)

/** URL의 쿼리 파라미터를 명세의 파라미터 모양으로 읽는다. 숫자 파라미터는 문자열로 오므로 숫자로 바꾼다. */
function readParams(url: URL): Record<string, unknown> {
  const params: Record<string, unknown> = Object.fromEntries(url.searchParams)
  for (const name of ['page', 'pageSize']) {
    const value = params[name]
    if (typeof value === 'string') params[name] = Number(value)
  }
  return params
}

export const articlesHandlers = [
  http.get('*/articles', ({ request }) => {
    // 실제 백엔드처럼 명세에 없는 값(0쪽, 너무 큰 pageSize 등)은 400으로 거절한다.
    const params = ListArticlesParams.safeParse(readParams(new URL(request.url)))
    if (!params.success) return HttpResponse.json({ message: params.error.message }, { status: 400 })
    // 명세의 listArticles처럼 page번째 페이지를 돌려준다. 마지막 페이지 뒤의 페이지는 빈 배열이다.
    const { page, pageSize } = params.data
    const start = (page - 1) * pageSize
    return HttpResponse.json(ARTICLES.slice(start, start + pageSize))
  }),
  http.get('*/articles/count', () => HttpResponse.json({ total: ARTICLES.length } satisfies ArticleCount)),
]
