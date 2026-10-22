// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/app/error.tsx, recipes/sentry/src/app/error.tsx.patch

'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
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
export default function AppError({ error, retry }: AppErrorProps) {
  // sentry Recipe: 오류 경계가 잡은 오류는 Next.js가 콘솔에만 남기므로 Sentry로 직접 보낸다(global-error.tsx도 이 화면을 그린다).
  // 서버 컴포넌트에서 난 오류(digest가 있음)는 서버의 onRequestError가 이미 보냈다. SDK를 초기화하지 않았으면(DSN이 없거나 개발
  // 서버·목 빌드) 아무것도 보내지 않는다.
  useEffect(() => {
    if (error instanceof Error && 'digest' in error) return
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">문제가 생겼습니다</h1>
      <p role="alert">페이지를 불러오지 못했습니다. 잠시 뒤에 다시 시도해 주세요.</p>
      <Button onClick={retry}>다시 시도</Button>
    </main>
  )
}
