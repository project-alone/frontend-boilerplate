import { Input as InputPrimitive } from '@base-ui/react/input'
import { cx } from 'class-variance-authority'
import type { WithClassName } from './class-name'
import { formControlClassName } from './field'

export type InputProps = WithClassName<InputPrimitive.Props>

/** 한 줄 입력. 레이블은 Field와 FieldLabel로 붙인다. 예: <Field><FieldLabel>이름</FieldLabel><Input /></Field> */
export function Input({ className, ...props }: InputProps) {
  return (
    <InputPrimitive className={cx(formControlClassName, 'placeholder:text-muted-foreground', className)} {...props} />
  )
}
