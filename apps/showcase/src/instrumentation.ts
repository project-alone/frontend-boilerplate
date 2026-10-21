// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/extensions.json, recipes/sentry/extensions.json

import type { Instrumentation } from 'next'
import { apiInstrumentation } from '@/shared/api/api-instrumentation'
import { sentryInstrumentation } from '@/shared/sentry/sentry-instrumentation'

// Starter를 만들 때 Generator가 Base와 Recipe가 더한 조각을 모아 만든 파일이다. 이제는 이 프로젝트의 코드이므로 직접 고친다.
// Next.js 서버가 뜰 때(register)와 서버가 요청을 처리하다 오류가 났을 때(onRequestError) 조각을 위에서부터 차례로 실행한다.
// next build에서는 실행되지 않으므로, 빌드할 때도 필요한 준비(예: 목 빌드의 MSW)는 그 코드를 쓰는 곳에서 한다.
interface InstrumentationHook {
  /** 서버 런타임(nodejs, edge)마다 한 번 실행된다. Node.js 전용 코드는 process.env.NEXT_RUNTIME을 확인한 뒤 동적 import로 불러온다. */
  register?: () => void | Promise<void>
  onRequestError?: Instrumentation.onRequestError
}

const hooks: readonly InstrumentationHook[] = [sentryInstrumentation, apiInstrumentation]

export async function register() {
  for (const hook of hooks) await hook.register?.()
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  for (const hook of hooks) await hook.onRequestError?.(...args)
}
