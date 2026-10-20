'use client'

import { Controller, useForm } from 'react-hook-form'
import { useRegisterMemberMutation } from '@/queries/members/members.queries'
import { RegisterMemberBody } from '@/shared/api/generated/model'
import { formResolver } from '@/shared/form/form-resolver'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { useToast } from '@/shared/ui/toast'

// grade의 선택지. 레이블은 명세의 enum 값이므로 화면에 맞게 바꾼다.
const gradeOptions = [
  { value: 'basic', label: 'basic' },
  { value: 'premium', label: 'premium' },
]

// 입력 요소로 만들지 않은 선택 필드: interests(배열). 보내야 하면 입력 요소를 직접 더한다.

/**
 * registerMember(회원 가입)의 요청 본문을 입력받아 보내는 폼. 입력 값은 재생성 계층의 요청 본문 스키마(RegisterMemberBody)로
 * 검증하고, 제출하면 members Query Domain의 useRegisterMemberMutation으로 보낸다. 성공하든 실패하든 알림(토스트)으로 알린다.
 * 레이블은 명세의 title(없으면 필드 이름)이다. 문구와 성공한 뒤의 동작(지금은 폼을 비운다)은 화면에 맞게 고친다.
 */
export function RegisterMemberForm() {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: formResolver(RegisterMemberBody),
    // 체크박스는 체크하지 않은 값(false)으로 시작한다. 비워 둔 다른 입력은 formResolver가 값을 넣지 않은 것으로 본다.
    defaultValues: { agreed: false },
  })
  const mutation = useRegisterMemberMutation()
  const toast = useToast()

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: () => {
        toast.add({ title: '회원 가입 완료' })
        reset()
      },
      onError: () => {
        toast.add({ type: 'error', title: '회원 가입 실패', description: '잠시 뒤에 다시 시도해 주세요.' })
      },
    })
  })

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
      <Field invalid={errors.name !== undefined}>
        <FieldLabel>이름</FieldLabel>
        <Input {...register('name')} />
        <FieldError match={errors.name !== undefined}>{errors.name?.message}</FieldError>
      </Field>
      <Field invalid={errors.email !== undefined}>
        <FieldLabel>이메일</FieldLabel>
        <Input type="email" {...register('email')} />
        <FieldError match={errors.email !== undefined}>{errors.email?.message}</FieldError>
      </Field>
      <Field invalid={errors.age !== undefined}>
        <FieldLabel>나이</FieldLabel>
        <Input type="number" {...register('age', { valueAsNumber: true })} />
        <FieldError match={errors.age !== undefined}>{errors.age?.message}</FieldError>
      </Field>
      <Field invalid={errors.height !== undefined}>
        <FieldLabel>키</FieldLabel>
        <Input type="number" step="any" {...register('height', { valueAsNumber: true })} />
        <FieldDescription>cm 단위로 적습니다.</FieldDescription>
        <FieldError match={errors.height !== undefined}>{errors.height?.message}</FieldError>
      </Field>
      <Controller
        control={control}
        name="grade"
        render={({ field }) => (
          <Field invalid={errors.grade !== undefined}>
            <Select
              label="등급"
              options={gradeOptions}
              value={field.value ?? null}
              onValueChange={field.onChange}
              inputRef={field.ref}
            />
            <FieldError match={errors.grade !== undefined}>{errors.grade?.message}</FieldError>
          </Field>
        )}
      />
      <Field invalid={errors.nickname !== undefined}>
        <FieldLabel>별명</FieldLabel>
        <Input {...register('nickname')} />
        <FieldError match={errors.nickname !== undefined}>{errors.nickname?.message}</FieldError>
      </Field>
      <Controller
        control={control}
        name="agreed"
        render={({ field }) => (
          <Field invalid={errors.agreed !== undefined}>
            <FieldLabel>
              <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} inputRef={field.ref} />
              약관에 동의합니다
            </FieldLabel>
            <FieldError match={errors.agreed !== undefined}>{errors.agreed?.message}</FieldError>
          </Field>
        )}
      />
      <Button type="submit" disabled={mutation.isPending}>
        회원 가입
      </Button>
    </form>
  )
}
