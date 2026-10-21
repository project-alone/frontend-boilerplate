'use client'

import { useRouter } from 'next/navigation'
import { Controller } from 'react-hook-form'
import { useCreateUserMutation } from '@/queries/users/users.queries'
import { CreateUserBody } from '@/shared/api/generated/model'
import { USERS_PATH } from '@/shared/dashboard/dashboard-routes'
import { ROLE_OPTIONS } from '@/shared/dashboard/user-labels'
import { useSchemaForm } from '@/shared/form/use-schema-form'
import { Button } from '@/shared/ui/button'
import { Field, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { useToast } from '@/shared/ui/toast'
import { DUPLICATE_EMAIL_MESSAGE, isDuplicateEmail } from './duplicate-email'

/**
 * createUser(사용자 추가)의 요청 본문을 입력받아 보내는 폼. `npm run g -- form createUser --feature user-form`이 만든 폼에서
 * 레이블과 선택지를 화면에 맞게 바꾸고, 추가하면 사용자 목록으로 돌아가게 고쳤다. 입력 값은 재생성 계층의 요청 본문
 * 스키마(CreateUserBody)로 검증하고, users Query Domain의 useCreateUserMutation으로 보낸다(목록과 통계를 무효화한다).
 */
export function CreateUserForm() {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useSchemaForm(CreateUserBody)
  const mutation = useCreateUserMutation()
  const toast = useToast()
  const router = useRouter()

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: (user) => {
        toast.add({ title: '사용자를 추가했습니다', description: `${user.name}님을 초대했습니다.` })
        router.push(USERS_PATH)
      },
      onError: (error) => {
        if (isDuplicateEmail(error)) {
          setError('email', { message: DUPLICATE_EMAIL_MESSAGE }, { shouldFocus: true })
          return
        }
        toast.add({ type: 'error', title: '사용자 추가 실패', description: '잠시 뒤에 다시 시도해 주세요.' })
      },
    })
  })

  return (
    <form noValidate className="flex max-w-md flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
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
      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <Field invalid={errors.role !== undefined}>
            <Select
              label="역할"
              options={ROLE_OPTIONS}
              value={field.value ?? null}
              onValueChange={field.onChange}
              inputRef={field.ref}
            />
            <FieldError match={errors.role !== undefined}>{errors.role?.message}</FieldError>
          </Field>
        )}
      />
      <Field invalid={errors.department !== undefined}>
        <FieldLabel>부서</FieldLabel>
        <Input {...register('department')} />
        <FieldError match={errors.department !== undefined}>{errors.department?.message}</FieldError>
      </Field>
      <Button type="submit" disabled={mutation.isPending || mutation.isSuccess}>
        사용자 추가
      </Button>
    </form>
  )
}
