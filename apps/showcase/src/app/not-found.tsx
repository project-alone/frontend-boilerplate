// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/app/not-found.tsx

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '찾는 화면이 없습니다',
}

// 앱 수준의 404 화면. 어느 라우트에도 맞지 않는 주소와, 가까운 라우트에 not-found.tsx가 없는 곳에서 부른 notFound()에 보이고,
// 루트 레이아웃(머리글)은 그대로 남는다. 없는 주소에는 상태 코드 404로 보낸다. static-export Starter는 빌드가 이 화면을
// out/404.html로 내보내고, 정적 파일 서버가 없는 주소에 그 파일을 보낸다.
export default function AppNotFound() {
  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">찾는 화면이 없습니다</h1>
      <p>주소가 바뀌었거나 없어진 화면일 수 있습니다.</p>
      <Link href="/" className="focus-ring rounded-sm underline underline-offset-4">
        홈으로
      </Link>
    </main>
  )
}
