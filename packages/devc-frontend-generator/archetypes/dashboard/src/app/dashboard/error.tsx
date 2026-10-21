'use client'

import { Button } from '@/shared/ui/button'

interface DashboardErrorProps {
  /** 던져진 값. 서버 컴포넌트의 오류는 배포한 앱에서 메시지 대신 서버 로그와 맞춰 볼 식별자(digest)만 담긴다. */
  error: unknown
  /** 이 라우트를 서버에서 다시 가져와 렌더링한다. */
  retry: () => void
}

// /dashboard 아래 페이지의 오류 상태. 페이지를 렌더링하다 오류가 나면(서버에서 데이터를 가져오지 못했을 때 등) 페이지 대신
// 보인다. 대시보드 안의 이동(layout.tsx)은 그대로 남는다.
export default function DashboardError({ retry }: DashboardErrorProps) {
  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">대시보드</h1>
      <p role="alert">페이지를 불러오지 못했습니다. 잠시 뒤에 다시 시도해 주세요.</p>
      <Button onClick={retry}>다시 시도</Button>
    </main>
  )
}
