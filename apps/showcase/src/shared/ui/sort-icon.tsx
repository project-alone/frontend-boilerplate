// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/table/src/shared/ui/sort-icon.tsx

import type { SortDirection } from '@tanstack/react-table'

// table Recipe: 정렬할 수 있는 열 머리글의 버튼에 넣는 아이콘. 회원 테이블과 그 테이블을 본뜬 테이블(대시보드 Archetype의
// 사용자 테이블 등)이 함께 쓴다.

/** 정렬 방향을 보여 주는 장식용 아이콘. 스크린 리더는 열 머리글의 aria-sort로 정렬 방향을 듣는다. */
export function SortIcon({ direction }: Readonly<{ direction: SortDirection | false }>) {
  const path = { asc: 'm4 10 4-4 4 4', desc: 'm4 6 4 4 4-4', none: 'm5 6 3-3 3 3M5 10l3 3 3-3' }[direction || 'none']
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
      <path d={path} />
    </svg>
  )
}
