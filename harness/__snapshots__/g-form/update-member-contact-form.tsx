'use client'

import { Controller } from 'react-hook-form'
import { useUpdateMemberContactMutation } from '@/queries/members/members.queries'
import { UpdateMemberContactBody } from '@/shared/api/generated/model'
import { useSchemaForm } from '@/shared/form/use-schema-form'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { useToast } from '@/shared/ui/toast'

// region의 선택지. 레이블은 명세의 enum 값이므로 화면에 맞게 바꾼다.
const regionOptions = [
  { value: 'seoul', label: 'seoul' },
  { value: 'busan', label: 'busan' },
]

/**
 * updateMemberContact(연락처 수정)의 요청 본문을 입력받아 보내는 폼. 입력 값은 재생성 계층의 요청 본문 스키마(UpdateMemberContactBody)로
 * 검증하고, 제출하면 members Query Domain의 useUpdateMemberContactMutation으로 보낸다. 성공하든 실패하든 알림(토스트)으로 알린다.
 * 레이블은 명세의 title(없으면 필드 이름)이다. 문구와 성공한 뒤의 동작(지금은 폼을 비운다)은 화면에 맞게 고친다.
 * null을 받는 필수 필드(phone, floor, region)는 비워 두면 null을 보낸다.
 * null을 받는 선택 필드(memo, homepage, fax)는 처음 값이 있던 입력을 비웠을 때만 null을 보내고(값을 지운다), 처음부터 비어 있으면 보내지 않는다.
 * 현재 값을 채워 수정 폼으로 쓰려면 그 값을 useSchemaForm의 defaultValues에 더한다(useForm과 formResolver가 함께 받는다).
 */
export function UpdateMemberContactForm() {
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useSchemaForm(UpdateMemberContactBody, {
    // 체크박스는 체크하지 않은 값(false)으로 시작한다. 비워 둔 다른 입력은 formResolver가 명세에 따라 빼거나 null로 보낸다.
    defaultValues: { sms: false, shared: false },
  })
  const mutation = useUpdateMemberContactMutation()
  const toast = useToast()

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: () => {
        toast.add({ title: '연락처 수정 완료' })
        reset()
      },
      onError: () => {
        toast.add({ type: 'error', title: '연락처 수정 실패', description: '잠시 뒤에 다시 시도해 주세요.' })
      },
    })
  })

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
      <Field invalid={errors.phone !== undefined}>
        <FieldLabel>전화번호</FieldLabel>
        <Input {...register('phone')} />
        <FieldError match={errors.phone !== undefined}>{errors.phone?.message}</FieldError>
      </Field>
      <Field invalid={errors.floor !== undefined}>
        <FieldLabel>층</FieldLabel>
        <Input type="number" {...register('floor', { valueAsNumber: true })} />
        <FieldError match={errors.floor !== undefined}>{errors.floor?.message}</FieldError>
      </Field>
      <Controller
        control={control}
        name="region"
        render={({ field }) => (
          <Field invalid={errors.region !== undefined}>
            <Select
              label="지역"
              clearLabel="선택 안 함"
              options={regionOptions}
              value={field.value ?? null}
              onValueChange={field.onChange}
              inputRef={field.ref}
            />
            <FieldError match={errors.region !== undefined}>{errors.region?.message}</FieldError>
          </Field>
        )}
      />
      <Field invalid={errors.memo !== undefined}>
        <FieldLabel>메모</FieldLabel>
        <Input {...register('memo')} />
        <FieldError match={errors.memo !== undefined}>{errors.memo?.message}</FieldError>
      </Field>
      <Field invalid={errors.homepage !== undefined}>
        <FieldLabel>홈페이지</FieldLabel>
        <Input type="url" {...register('homepage')} />
        <FieldError match={errors.homepage !== undefined}>{errors.homepage?.message}</FieldError>
      </Field>
      <Field invalid={errors.fax !== undefined}>
        <FieldLabel>팩스</FieldLabel>
        <Input {...register('fax')} />
        <FieldError match={errors.fax !== undefined}>{errors.fax?.message}</FieldError>
      </Field>
      <Field invalid={errors.greeting !== undefined}>
        <FieldLabel>인사말</FieldLabel>
        <Input {...register('greeting')} />
        <FieldError match={errors.greeting !== undefined}>{errors.greeting?.message}</FieldError>
      </Field>
      <Field invalid={errors.extension !== undefined}>
        <FieldLabel>내선 번호</FieldLabel>
        <Input {...register('extension')} />
        <FieldError match={errors.extension !== undefined}>{errors.extension?.message}</FieldError>
      </Field>
      <Controller
        control={control}
        name="sms"
        render={({ field }) => (
          <Field invalid={errors.sms !== undefined}>
            <FieldLabel>
              <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} inputRef={field.ref} />
              문자를 받습니다
            </FieldLabel>
            <FieldError match={errors.sms !== undefined}>{errors.sms?.message}</FieldError>
          </Field>
        )}
      />
      <Controller
        control={control}
        name="shared"
        render={({ field }) => (
          <Field invalid={errors.shared !== undefined}>
            <FieldLabel>
              <Checkbox checked={field.value ?? false} onCheckedChange={field.onChange} inputRef={field.ref} />
              연락처 공개에 동의합니다
            </FieldLabel>
            <FieldError match={errors.shared !== undefined}>{errors.shared?.message}</FieldError>
          </Field>
        )}
      />
      <Button type="submit" disabled={mutation.isPending}>
        연락처 수정
      </Button>
    </form>
  )
}
