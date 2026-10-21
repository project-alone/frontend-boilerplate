// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/app/admin/page.tsx

import type { Metadata } from 'next'
import { requireServerSession } from '@/shared/auth/server-session'

export const metadata: Metadata = {
  title: '관리자',
}

// auth Recipe: admin 역할이 있는 사용자만 들어오는 보호된 라우트(src/shared/auth/access-rules.ts). 역할이 없으면 proxy가
// 접근 권한 없음 페이지(/forbidden)를 보여 준다.
export default async function AdminPage() {
  const { user } = await requireServerSession()

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">관리자</h1>
      <p>{user.name}님은 관리자 역할이 있어 이 페이지를 볼 수 있습니다.</p>
    </main>
  )
}
