// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/shared/auth/auth-instrumentation.ts

import { sessionSecret } from './session'

/**
 * Next.js 서버가 뜰 때 한 번 실행된다(src/instrumentation.ts가 부른다). 세션 쿠키를 암호화할 SESSION_SECRET이 없거나
 * 짧으면 서버가 요청을 처리하기 전에 무엇을 넣어야 하는지 알린다.
 */
export const authInstrumentation = {
  register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return
    sessionSecret()
  },
}
