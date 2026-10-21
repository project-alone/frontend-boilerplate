import { useId } from 'react'
import type { PartnerCategory, SubmitPartnerApplicationBody } from '@/shared/api/generated/model'
import type { FormDraft } from '@/shared/form/form-resolver'
import { Button } from '@/shared/ui/button'

export const CATEGORY_LABELS: Record<PartnerCategory, string> = {
  fashion: '패션',
  food: '식품',
  living: '리빙',
  digital: '디지털',
}

const NOT_ENTERED = '입력하지 않음'

interface ReviewSection {
  /** 이 묶음을 입력한 단계(0부터) */
  step: number
  title: string
  items: [term: string, value: string][]
}

/** 비워 둔 입력(빈 문자열, 비운 숫자 입력의 NaN)은 입력하지 않은 것으로 보인다. */
function text(value: string | number | undefined, format: (value: number) => string = String): string {
  if (value === undefined || value === '' || Number.isNaN(value)) return NOT_ENTERED
  return typeof value === 'number' ? format(value) : value
}

function sectionsOf(draft: FormDraft<SubmitPartnerApplicationBody>): ReviewSection[] {
  const count = (value: number) => value.toLocaleString('ko-KR')
  return [
    {
      step: 0,
      title: '사업자 정보',
      items: [
        ['상호', text(draft.companyName)],
        ['사업자등록번호', text(draft.businessNumber)],
        ['판매 분야', draft.category === undefined ? NOT_ENTERED : CATEGORY_LABELS[draft.category]],
      ],
    },
    {
      step: 1,
      title: '담당자 정보',
      items: [
        ['담당자 이름', text(draft.contactName)],
        ['이메일', text(draft.email)],
        ['연락처', text(draft.phone)],
      ],
    },
    {
      step: 2,
      title: '판매 계획',
      items: [
        ['판매할 상품 수', text(draft.productCount, (value) => `${count(value)}개`)],
        ['월 예상 매출', text(draft.monthlySales, (value) => `${count(value)}만 원`)],
        ['회사 소개', text(draft.introduction)],
        ['입점 약관', draft.agreedToTerms === true ? '동의함' : '동의하지 않음'],
      ],
    },
  ]
}

/**
 * 확인 단계에서 모든 단계의 입력을 묶음(단계)마다 보여 준다. 묶음마다 "수정" 버튼으로 그 단계로 돌아간다.
 * 값의 문구(enum의 레이블, 단위)는 화면에 맞게 고친다.
 */
export function PartnerApplicationReview({
  draft,
  onEdit,
}: Readonly<{ draft: FormDraft<SubmitPartnerApplicationBody>; onEdit: (step: number) => void }>) {
  const id = useId()
  return (
    <div className="flex flex-col gap-6">
      {sectionsOf(draft).map(({ step, title, items }) => (
        <section key={title} aria-labelledby={`${id}-${String(step)}`} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 id={`${id}-${String(step)}`} className="text-md font-semibold">
              {title}
            </h3>
            <Button
              variant="secondary"
              size="sm"
              aria-label={`${title} 수정`}
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
