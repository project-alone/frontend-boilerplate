// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/infinite-list/src/features/article-list/article-list-nav.tsx

import Link from 'next/link'

// 같은 게시글을 무한 스크롤과 번호형 페이지네이션으로 번갈아 볼 수 있게 두 라우트를 잇는다.
const VIEWS = [
  { key: 'infinite', href: '/articles', label: '무한 스크롤' },
  { key: 'pagination', href: '/articles/pagination', label: '페이지 번호' },
] as const

export type ArticleListView = (typeof VIEWS)[number]['key']

/** 게시글 목록을 보는 방식(라우트)을 고르는 링크. 지금 보고 있는 방식은 aria-current로 알린다. */
export function ArticleListNav({ current }: Readonly<{ current: ArticleListView }>) {
  return (
    <nav aria-label="게시글 보기 방식">
      <ul className="flex gap-4 text-sm">
        {VIEWS.map((view) => (
          <li key={view.key}>
            <Link
              href={view.href}
              aria-current={view.key === current ? 'page' : undefined}
              className="focus-ring rounded-sm underline-offset-4 hover:underline aria-[current=page]:font-semibold aria-[current=page]:underline"
            >
              {view.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
