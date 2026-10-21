import type { Metadata } from 'next'
import { MemberTable } from '@/features/member-table/member-table'

export const metadata: Metadata = {
  title: '회원',
}

// table Recipe: 정렬·필터·페이지를 백엔드가 처리하는 목록 테이블. 페이지 뼈대는 빌드할 때 미리 만들고, 회원 목록은
// 브라우저가 테이블의 상태대로 요청해 가져온다. 상태가 바뀔 때마다 브라우저가 다시 요청하므로 두 Rendering Mode에서
// 같은 코드로 동작한다(server는 BFF 프록시, static-export는 백엔드를 직접 부른다).
export default function MembersPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">회원</h1>
      <MemberTable />
    </main>
  )
}
