import { useId } from 'react'
import { Button } from '@/shared/ui/button'

export interface ReviewSection {
  title: string
  /** [항목, 값] */
  items: readonly [term: string, value: string][]
}

/**
 * 확인 단계에서 모든 단계의 입력을 단계마다 묶어 보여 준다. 묶음마다 "수정" 버튼으로 그 단계(sections의 순서)로 돌아간다.
 * 신청하는 동안에는(disabled) 돌아가지 않는다. 돌아가 고친 값은 이미 보낸 요청에 담기지 않기 때문이다.
 */
export function PartnerApplicationReview({
  sections,
  onEdit,
  disabled,
}: Readonly<{ sections: readonly ReviewSection[]; onEdit: (step: number) => void; disabled: boolean }>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-6">
      {sections.map(({ title, items }, step) => (
        <section key={title} aria-labelledby={`${id}-${String(step)}`} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 id={`${id}-${String(step)}`} className="text-md font-semibold">
              {title}
            </h3>
            <Button
              variant="secondary"
              size="sm"
              aria-label={`${title} 수정`}
              disabled={disabled}
              onClick={() => {
                onEdit(step)
              }}
            >
              수정
            </Button>
          </div>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
            {items.map(([term, value]) => (
              <div key={term} className="contents">
                <dt className="text-muted-foreground">{term}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
