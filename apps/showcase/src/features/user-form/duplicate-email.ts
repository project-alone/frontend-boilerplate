// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/features/user-form/duplicate-email.ts

import { isApiError } from '@/shared/api/api-fetch'

/** 백엔드가 같은 이메일의 사용자가 이미 있다고 답했을 때(409) 이메일 입력에 보이는 오류 */
export const DUPLICATE_EMAIL_MESSAGE = '이미 다른 사용자가 쓰는 이메일입니다.'

/** 사용자 추가·수정이 같은 이메일의 다른 사용자가 있어 실패했는가(명세의 409) */
export function isDuplicateEmail(error: unknown): boolean {
  return isApiError(error, 409)
}
