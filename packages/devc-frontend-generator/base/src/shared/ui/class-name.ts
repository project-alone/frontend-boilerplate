/**
 * 공통 컴포넌트가 받는 className. 컴포넌트가 정한 클래스 뒤에 덧붙으므로 바깥 여백이나 너비 같은 배치에만 쓴다.
 * Base UI는 상태를 받는 함수도 받지만, 모양은 컴포넌트의 변형(cva)으로 정하므로 문자열만 받는다.
 */
export type WithClassName<Props> = Omit<Props, 'className'> & { className?: string }
