// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/button.tsx

import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import type { WithClassName } from './class-name'

// 링크(<a>)를 버튼처럼 보이게 할 때는 Button 대신 <a className={buttonVariants()}>를 쓴다(Base UI는 링크를 버튼으로 렌더링하지 않는다).
export const buttonVariants = cva(
  'focus-ring inline-flex items-center justify-center gap-2 rounded-md border font-medium whitespace-nowrap select-none data-disabled:cursor-not-allowed data-disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'border-primary bg-primary text-primary-foreground hover:not-data-disabled:border-primary-hover hover:not-data-disabled:bg-primary-hover',
        secondary: 'border-border bg-background text-foreground hover:not-data-disabled:bg-muted',
        danger:
          'border-danger bg-danger text-danger-foreground hover:not-data-disabled:border-danger-hover hover:not-data-disabled:bg-danger-hover',
      },
      size: {
        sm: 'h-control-sm px-3 text-sm',
        md: 'h-control-md px-4 text-md',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export type ButtonProps = WithClassName<ButtonPrimitive.Props> & VariantProps<typeof buttonVariants>

/**
 * 버튼. 기본 type은 "button"이므로 폼을 제출하려면 type="submit"을 적는다.
 * Base UI 부품의 render prop에 넘겨 트리거로 쓸 수 있다. 예: <DialogTrigger render={<Button />}>열기</DialogTrigger>
 */
export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <ButtonPrimitive className={buttonVariants({ variant, size, className })} {...props} />
}
