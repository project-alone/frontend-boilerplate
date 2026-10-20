// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/class-name.ts

/**
 * 공통 컴포넌트가 받는 className. 컴포넌트가 정한 클래스 뒤에 덧붙으므로 바깥 여백이나 너비 같은 배치에만 쓴다.
 * Base UI는 상태를 받는 함수도 받지만, 모양은 컴포넌트의 변형(cva)으로 정하므로 문자열만 받는다.
 */
export type WithClassName<Props> = Omit<Props, 'className'> & { className?: string }
