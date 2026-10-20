import { Field as FieldPrimitive } from '@base-ui/react/field'
import { cx } from 'class-variance-authority'
import type { WithClassName } from './class-name'

// 폼 컨트롤(Input, Select)과 그 레이블이 함께 쓰는 모양
export const formControlClassName =
  'focus-ring h-control-md w-full rounded-md border border-border bg-background px-3 text-md text-foreground data-disabled:cursor-not-allowed data-disabled:opacity-50 data-invalid:border-danger'
export const formLabelClassName = 'text-sm font-medium text-foreground'

/**
 * 폼 컨트롤 하나와 그 레이블, 설명, 오류 메시지를 묶는다. 묶인 부품끼리는 Base UI가 id와 aria 속성으로 이어 준다.
 *
 * - Input: <Field><FieldLabel>이름</FieldLabel><Input /></Field>
 * - Checkbox: <Field><FieldLabel><Checkbox />약관에 동의합니다</FieldLabel></Field>
 * - Select는 label prop으로 자기 레이블을 갖는다. 설명이나 오류를 붙일 때만 Field로 감싼다.
 */
export function Field({ className, ...props }: WithClassName<FieldPrimitive.Root.Props>) {
  return <FieldPrimitive.Root className={cx('flex flex-col gap-1', className)} {...props} />
}

export function FieldLabel({ className, ...props }: WithClassName<FieldPrimitive.Label.Props>) {
  return (
    <FieldPrimitive.Label className={cx('inline-flex items-center gap-2', formLabelClassName, className)} {...props} />
  )
}

export function FieldDescription({ className, ...props }: WithClassName<FieldPrimitive.Description.Props>) {
  return <FieldPrimitive.Description className={cx('text-sm text-muted-foreground', className)} {...props} />
}

/** 검증에 실패했을 때만 보인다. match로 보일 조건(예: "valueMissing")을 정한다. */
export function FieldError({ className, ...props }: WithClassName<FieldPrimitive.Error.Props>) {
  return <FieldPrimitive.Error className={cx('text-sm text-danger', className)} {...props} />
}
