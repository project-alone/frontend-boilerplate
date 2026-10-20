import type { Instrumentation } from 'next'

/** 시험용 instrumentation 조각: 서버가 뜰 때 실행된 순서를 서버 출력에 남긴다. */
export const fixtureAInstrumentation: {
  register: () => void
  onRequestError: Instrumentation.onRequestError
} = {
  register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') console.log('[extension-a-fixture] register')
  },
  onRequestError(_error, request) {
    console.error(`[extension-a-fixture] onRequestError ${request.path}`)
  },
}
