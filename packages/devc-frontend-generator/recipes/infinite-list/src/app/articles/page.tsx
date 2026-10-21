import type { Metadata } from 'next'
import { ArticleInfiniteList } from '@/features/article-list/article-infinite-list'
import { ArticleListNav } from '@/features/article-list/article-list-nav'

export const metadata: Metadata = {
  title: '게시글(무한 스크롤)',
}

// infinite-list Recipe: 스크롤하면 다음 페이지를 불러오는 무한 스크롤 목록. 페이지 뼈대는 빌드할 때 미리 만들고, 게시글은
// 브라우저가 첫 페이지부터 가져온다. 그래서 Rendering Mode server와 static-export에서 같은 코드로 동작한다(server는 BFF
// 프록시, static-export는 백엔드를 직접 부른다).
export default function ArticlesPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">게시글</h1>
      <ArticleListNav current="infinite" />
      <ArticleInfiniteList />
    </main>
  )
}
