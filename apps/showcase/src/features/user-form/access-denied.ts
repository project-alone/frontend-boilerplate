// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/features/user-form/access-denied.ts

import { ApiError } from '@/shared/api/api-fetch'

/**
 * 사용자 추가·수정을 백엔드가 지금 로그인 세션으로는 할 수 없다고 거절했는가. 로그인 세션이 끝났거나(401: BFF 프록시가
 * refresh하지 못해 세션 쿠키를 지웠다) 지금 로그인한 사용자에게 관리자 역할이 없다(403: 폼을 연 뒤 같은 브라우저에서 다른
 * 계정으로 로그인했다 등). 폼은 알린 뒤 router.refresh()로 이 화면에 들어갈 수 있는지 서버에서 다시 확인한다. proxy(auth
 * Recipe)가 로그인하지 않았으면 돌아올 주소와 함께 로그인 페이지로, 관리자가 아니면 주소는 그대로 둔 채 접근 권한 없음
 * 페이지로 보낸다.
 */
export function isAccessDenied(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}

/** isAccessDenied인 오류를 알릴 때의 설명 */
export function accessDeniedMessage({ status }: ApiError): string {
  return status === 401
    ? '로그인이 끝났습니다. 다시 로그인해 주세요.'
    : '사용자를 추가하고 고치는 것은 관리자만 할 수 있습니다.'
}
