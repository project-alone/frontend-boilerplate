// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/ui/select.tsx

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { cx } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { formControlClassName, formLabelClassName } from './field'
import { CheckIcon, ChevronDownIcon } from './icons'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export type SelectProps = Omit<SelectPrimitive.Root.Props<string>, 'items' | 'multiple' | 'children'> & {
  /** 화면에 보이는 레이블. 선택 버튼의 접근 가능한 이름이 된다. */
  label: ReactNode
  options: readonly SelectOption[]
  /** 아무것도 고르지 않았을 때 보이는 문구 */
  placeholder?: string
  className?: string
}

/** 목록에서 값 하나를 고른다. 키보드(화살표, Enter, 글자 입력)로도 고를 수 있다. */
export function Select({ label, options, placeholder, className, ...props }: SelectProps) {
  return (
    <SelectPrimitive.Root items={options} {...props}>
      <div className={cx('flex flex-col gap-1', className)}>
        <SelectPrimitive.Label className={formLabelClassName}>{label}</SelectPrimitive.Label>
        <SelectPrimitive.Trigger
          className={cx(formControlClassName, 'flex items-center justify-between gap-2 select-none')}
        >
          <SelectPrimitive.Value
            className="truncate data-placeholder:text-muted-foreground"
            placeholder={placeholder}
          />
          <SelectPrimitive.Icon className="flex">
            <ChevronDownIcon />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
      </div>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner className="z-50 outline-none" sideOffset={4} alignItemWithTrigger={false}>
          <SelectPrimitive.Popup className="min-w-(--anchor-width) rounded-lg border border-border bg-background p-1 text-foreground outline-none">
            <SelectPrimitive.List className="max-h-(--available-height) overflow-y-auto">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled ?? false}
                  // 키보드로 가리킨 항목은 포커스 링 대신 배경과 글자색을 바꿔 드러낸다.
                  className="relative flex cursor-default items-center rounded-sm py-2 pr-3 pl-8 text-md outline-none select-none data-disabled:opacity-50 data-highlighted:bg-primary data-highlighted:text-primary-foreground"
                >
                  <SelectPrimitive.ItemIndicator className="absolute left-2 flex">
                    <CheckIcon />
                  </SelectPrimitive.ItemIndicator>
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
