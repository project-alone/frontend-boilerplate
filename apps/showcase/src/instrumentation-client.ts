// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/analytics/extensions.json, recipes/sentry/extensions.json

import type { RouterTransitionType } from 'next'
import { analyticsClientInstrumentation } from '@/shared/analytics/analytics-instrumentation-client'
import { sentryClientInstrumentation } from '@/shared/sentry/sentry-instrumentation-client'

// Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 만든 파일이다. 이제는 이 프로젝트의 코드이므로 직접 고친다.
// 브라우저에서 앱 코드보다 먼저 한 번(register), App Router가 다른 페이지로 옮겨 가기 시작할 때마다(onRouterTransitionStart)
// 조각을 위에서부터 차례로 실행한다.
interface ClientInstrumentationPiece {
  register?: () => void
  onRouterTransitionStart?: (url: string, navigationType: RouterTransitionType) => void
}

const pieces: readonly ClientInstrumentationPiece[] = [sentryClientInstrumentation, analyticsClientInstrumentation]

for (const piece of pieces) piece.register?.()

export function onRouterTransitionStart(url: string, navigationType: RouterTransitionType) {
  for (const piece of pieces) piece.onRouterTransitionStart?.(url, navigationType)
}
