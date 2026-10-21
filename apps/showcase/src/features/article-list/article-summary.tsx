// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/src/features/article-list/article-summary.tsx

import type { Article } from '@/shared/api/generated/model'

const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeZone: 'UTC' })

/** 목록에 보여 줄 게시글 하나. 무한 스크롤 목록과 번호형 페이지네이션이 함께 쓴다. */
export function ArticleSummary({ article }: Readonly<{ article: Article }>) {
  return (
    <article className="flex flex-col gap-1 rounded-md border border-border p-4">
      <h2 className="font-semibold">{article.title}</h2>
      <p className="text-sm">{article.summary}</p>
      <time dateTime={article.publishedAt} className="text-sm text-muted-foreground">
        {DATE_FORMAT.format(new Date(article.publishedAt))}
      </time>
    </article>
  )
}
