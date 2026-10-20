// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/icons.tsx

// 공통 컴포넌트 안에서 쓰는 장식용 아이콘. 색은 글자색(currentColor)을 따르고, 스크린 리더는 읽지 않는다.

export function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
      <path d="m3 8.5 3.5 3.5 6.5-8" />
    </svg>
  )
}

export function MinusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
      <path d="M3.5 8h9" />
    </svg>
  )
}

export function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4">
      <path d="m4 6 4 4 4-4" />
    </svg>
  )
}
