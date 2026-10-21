// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/app/dashboard/users/new/page.tsx

import type { Metadata } from 'next'
import { CreateUserForm } from '@/features/user-form/create-user-form'

export const metadata: Metadata = {
  title: '사용자 추가',
}

// 대시보드 Archetype의 사용자 추가. 관리자만 들어온다(src/shared/auth/access-rules.ts). 다른 역할이면 proxy가 주소는 그대로
// 둔 채 접근 권한 없음 페이지를 403으로 보여 준다. 폼은 데이터를 미리 가져오지 않으므로 페이지는 빌드할 때 미리 렌더링한다.
export default function NewUserPage() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">사용자 추가</h1>
      <p className="text-sm text-muted-foreground">추가한 사용자는 초대됨 상태로 시작합니다.</p>
      <CreateUserForm />
    </main>
  )
}
