import type { Metadata } from 'next'
import { ArticleListNav } from '@/features/article-list/article-list-nav'
import { ArticlePagedList } from '@/features/article-list/article-paged-list'

export const metadata: Metadata = {
  title: '게시글(페이지 번호)',
}

// infinite-list Recipe: 무한 스크롤 목록(/articles)과 같은 게시글을 쪽 번호로 넘겨 보는 번호형 페이지네이션. 페이지 뼈대는
// 빌드할 때 미리 만들고, 지금 쪽의 게시글은 브라우저가 가져오므로 Rendering Mode server와 static-export에서 같은 코드로 동작한다.
export default function ArticlePaginationPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">게시글</h1>
      <ArticleListNav current="pagination" />
      <ArticlePagedList />
    </main>
  )
}
