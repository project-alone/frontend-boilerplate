// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/src/shared/multi-step-form/step-form.tsx

'use client'

import { type ReactNode, useEffect } from 'react'
import type { FieldErrors, FieldValues, UseFormReturn } from 'react-hook-form'
import type * as z from 'zod'
import type { FormDraft } from '@/shared/form/form-resolver'
import { useSchemaForm } from '@/shared/form/use-schema-form'
import { Button } from '@/shared/ui/button'

/** 단계 폼이 children에 넘기는 React Hook Form의 폼. schema는 그 단계의 스키마다. */
export type StepFormReturn<Schema extends z.ZodType<unknown, FieldValues>> = UseFormReturn<
  FormDraft<z.input<Schema>>,
  unknown,
  z.output<Schema>
>

export interface StepFormProps<Input extends FieldValues, Output> {
  /**
   * 이 단계에서 검증할 스키마. 요청 본문 스키마에서 이 단계의 필드만 고른 것(예: CreateOrderBody.pick({ ... }))이고,
   * 확인 단계에서는 요청 본문 스키마 전체다.
   */
  schema: z.ZodType<Output, Input>
  /** 폼의 처음 값. 앞뒤 단계에서 입력한 값(useFormSteps의 draft)을 넘긴다. */
  defaultValues: NoInfer<FormDraft<Input>>
  /** 검증을 통과하면 검증한 값(output)과 입력한 그대로의 값(values)을 받는다. */
  onNext: (output: NoInfer<Output>, values: NoInfer<FormDraft<Input>>) => void
  /** 있으면 "이전" 버튼을 둔다. 검증하지 않고 입력한 그대로의 값을 받는다. */
  onBack?: ((values: NoInfer<FormDraft<Input>>) => void) | undefined
  /** 검증에 실패했을 때. 없으면 오류를 알리고 첫 오류 필드로 포커스를 옮기기만 한다. */
  onInvalid?: ((errors: NoInfer<FieldErrors<FormDraft<Input>>>) => void) | undefined
  /** 입력하는 동안 값이 바뀔 때마다 받는다(useFormSteps의 save로 저장). */
  onValuesChange?: ((values: NoInfer<FormDraft<Input>>) => void) | undefined
  /** 처음 그릴 때 검증해 오류를 알리고 첫 오류 필드로 포커스를 옮긴다(useFormSteps의 validateOnMount). */
  validateOnMount?: boolean | undefined
  /** 다음으로 가는(제출) 버튼의 문구 */
  submitLabel: ReactNode
  /** 제출하는 동안 이전·다음 버튼을 끈다. */
  pending?: boolean | undefined
  /** 폼의 이름이 되는 단계 제목의 id */
  labelledBy: string
  children: (form: UseFormReturn<FormDraft<Input>, unknown, Output>) => ReactNode
}

/**
 * 다단계 폼의 한 단계. 이 단계의 필드만 담은 React Hook Form 폼을 만들고, "다음"을 누르면 schema(이 단계의 스키마)로만
 * 검증한다. 그래서 아직 입력하지 않은 다음 단계의 필드는 오류로 알리지 않는다. 검증에 실패하면 React Hook Form이 첫 오류
 * 필드로 포커스를 옮긴다. 단계를 옮길 때마다 key를 바꿔 새로 만든다(useFormSteps의 formKey).
 */
export function StepForm<Input extends FieldValues, Output>({
  schema,
  defaultValues,
  onNext,
  onBack,
  onInvalid,
  onValuesChange,
  validateOnMount = false,
  submitLabel,
  pending = false,
  labelledBy,
  children,
}: StepFormProps<Input, Output>) {
  // 앞뒤 단계에서 입력한 값을 처음 값으로 useForm과 formResolver에 함께 넘긴다. null을 받는 선택 필드는 그 값을 비우면 null을 보낸다.
  const form = useSchemaForm(schema, { defaultValues })

  const { subscribe, trigger } = form

  useEffect(() => {
    if (onValuesChange === undefined) return undefined
    return subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        onValuesChange(values)
      },
    })
  }, [subscribe, onValuesChange])

  useEffect(() => {
    // 처음 그릴 때 검증한다. validateOnMount는 단계 폼(key)마다 정해지므로 같은 폼에서 다시 검증하지 않는다.
    if (validateOnMount) void trigger(undefined, { shouldFocus: true })
  }, [validateOnMount, trigger])

  const onSubmit = form.handleSubmit((output) => {
    onNext(output, form.getValues())
  }, onInvalid)

  return (
    <form
      noValidate
      aria-labelledby={labelledBy}
      className="flex flex-col gap-4"
      onSubmit={(event) => void onSubmit(event)}
    >
      {children(form)}
      <div className="flex gap-2">
        {onBack !== undefined && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              onBack(form.getValues())
            }}
          >
            이전
          </Button>
        )}
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
