// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/dashboard/src/shared/dashboard/user-labels.ts

import { Role, UserStatus } from '@/shared/api/generated/model'

// 대시보드가 사용자의 역할과 상태를 화면에 쓰는 이름. 목록, 폼, 통계가 함께 쓴다.

export const ROLE_LABELS: Record<Role, string> = { admin: '관리자', user: '사용자' }

export const USER_STATUS_LABELS: Record<UserStatus, string> = { active: '활성', invited: '초대됨', suspended: '정지' }

/** 역할을 고르는 Select의 선택지(명세의 순서) */
export const ROLE_OPTIONS = Role.options.map((role) => ({ value: role, label: ROLE_LABELS[role] }))

/** 상태를 고르는 Select의 선택지(명세의 순서) */
export const USER_STATUS_OPTIONS = UserStatus.options.map((status) => ({
  value: status,
  label: USER_STATUS_LABELS[status],
}))
