export interface OrderSummaryProps {
  /** 제목. 자리표시 prop이므로 화면에 맞게 바꾼다. */
  title: string
}

/**
 * orders Feature의 컴포넌트. Feature는 공통 UI(@/shared/ui)와 Query Domain의 queryOptions(@/queries)를 조합해 화면을 그린다.
 * 모양은 공통 UI와 디자인 토큰으로 만든 유틸리티로만 정한다.
 */
export function OrderSummary({ title }: OrderSummaryProps) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
    </section>
  )
}
