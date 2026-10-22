'use client'

import { Button } from '@/shared/ui/button'

export interface AppErrorProps {
  /** 던져진 값. 서버 컴포넌트의 오류는 배포한 앱에서 메시지 대신 서버 로그와 맞춰 볼 식별자(digest)만 담긴다. */
  error: unknown
  /** 오류가 난 화면을 서버에서 다시 가져와 렌더링한다. */
  retry: () => void
}

// 앱 수준의 오류 상태. 페이지를 렌더링하다 오류가 나면(서버에서 데이터를 가져오지 못했을 때 등) 페이지 대신 보이고, 루트 레이아웃
// (머리글)은 그대로 남는다. 라우트에 error.tsx가 있으면(npm run g -- page가 만든 오류 상태 등) 그 라우트의 오류는 그쪽이 먼저 받는다.
// 루트 레이아웃에서 난 오류를 받는 global-error.tsx도 이 화면을 그리므로, 루트 레이아웃의 Provider(TanStack Query, 알림 등)에 기대지 않는다.
export default function AppError({ retry }: AppErrorProps) {
  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">문제가 생겼습니다</h1>
      <p role="alert">페이지를 불러오지 못했습니다. 잠시 뒤에 다시 시도해 주세요.</p>
      <Button onClick={retry}>다시 시도</Button>
    </main>
  )
}
