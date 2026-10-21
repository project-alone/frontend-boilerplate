import type { Metadata } from 'next'
import Link from 'next/link'

// 검색 결과에 보이지 않을 페이지다.
export const metadata: Metadata = {
  title: '접근 권한 없음',
  robots: { index: false },
}

// auth Recipe: 보호된 라우트의 역할(src/shared/auth/access-rules.ts)이 없는 사용자에게 proxy가 주소는 그대로 둔 채 403으로
// 보여 주는 페이지.
export default function ForbiddenPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">접근 권한이 없습니다</h1>
      <p>이 페이지를 볼 수 있는 역할이 없습니다. 필요하면 관리자에게 권한을 요청하세요.</p>
      <p>
        <Link href="/" className="focus-ring underline">
          홈으로
        </Link>
      </p>
    </main>
  )
}
