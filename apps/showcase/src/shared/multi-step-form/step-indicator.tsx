// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/src/shared/multi-step-form/step-indicator.tsx

import { cx } from 'class-variance-authority'
import { CheckIcon } from '@/shared/ui/icons'

export interface StepIndicatorProps {
  /** 목록의 이름(예: "입점 신청 단계") */
  label: string
  /** 단계마다의 제목 */
  steps: readonly string[]
  /** 지금 단계. 0부터 센다. */
  current: number
}

/**
 * 다단계 폼의 단계 목록. 지금 단계는 aria-current="step"으로, 끝낸 단계는 "(완료)"로 알린다. 단계를 고르는 링크가 아니라
 * 보여 주기만 하므로 포커스를 받지 않는다. 단계를 옮기면 포커스는 단계의 제목으로 간다(useFormSteps).
 */
export function StepIndicator({ label, steps, current }: StepIndicatorProps) {
  return (
    <ol aria-label={label} className="flex flex-wrap gap-x-6 gap-y-2">
      {steps.map((title, index) => {
        const done = index < current
        const active = index === current
        return (
          <li
            key={title}
            aria-current={active ? 'step' : undefined}
            className={cx(
              'flex items-center gap-2 text-sm',
              active ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {/* 단계 번호와 완료 표시는 보이기만 한다. 스크린 리더는 목록의 몇 번째 항목인지와 아래 문구로 듣는다. */}
            <span
              aria-hidden="true"
              className={cx(
                'flex size-6 shrink-0 items-center justify-center rounded-sm border',
                done || active ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
              )}
            >
              {done ? <CheckIcon /> : index + 1}
            </span>
            {title}
            {done && <span className="sr-only"> (완료)</span>}
          </li>
        )
      })}
    </ol>
  )
}
