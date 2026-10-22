// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/checkbox.tsx

// Base UI 부품에 함수(render)를 넘기므로 클라이언트 컴포넌트로 둔다.
'use client'

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { cx } from 'class-variance-authority'
import type { WithClassName } from './class-name'
import { useFieldLabelId } from './field-label-id'
import { CheckIcon, MinusIcon } from './icons'

export type CheckboxProps = WithClassName<CheckboxPrimitive.Root.Props>

/** 체크박스. FieldLabel로 감싸 레이블을 붙인다. 예: <Field><FieldLabel><Checkbox />약관에 동의합니다</FieldLabel></Field> */
export function Checkbox({ className, ...props }: CheckboxProps) {
  // 체크박스의 접근 가능한 이름이 되는 레이블. 체크박스(span role=checkbox)는 감싼 <label>에서 이름을 얻지 못하고, Base UI는
  // hydration 뒤에야 체크박스를 레이블에 이으므로(aria-labelledby), 서버가 그린 HTML에서도 이름이 있도록 감싼 FieldLabel의 id로 직접 잇는다.
  const labelId = useFieldLabelId()
  return (
    <CheckboxPrimitive.Root
      aria-labelledby={labelId}
      className={cx(
        'focus-ring inline-flex size-5 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-primary-foreground data-checked:border-primary data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:border-danger',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex"
        render={(indicatorProps, { indeterminate }) => (
          <span {...indicatorProps}>{indeterminate ? <MinusIcon /> : <CheckIcon />}</span>
        )}
      />
    </CheckboxPrimitive.Root>
  )
}
