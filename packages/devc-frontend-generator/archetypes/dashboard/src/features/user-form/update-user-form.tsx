'use client'

import { useSuspenseQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { Controller } from 'react-hook-form'
import { getUserQueryOptions, useUpdateUserMutation } from '@/queries/users/users.queries'
import { UpdateUserBody, type UserAccount } from '@/shared/api/generated/model'
import { USERS_PATH } from '@/shared/dashboard/dashboard-routes'
import { ROLE_OPTIONS, USER_STATUS_OPTIONS } from '@/shared/dashboard/user-labels'
import { useSchemaForm } from '@/shared/form/use-schema-form'
import { Button } from '@/shared/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { useToast } from '@/shared/ui/toast'
import { accessDeniedMessage, isAccessDenied } from './access-denied'
import { DUPLICATE_EMAIL_MESSAGE, isDuplicateEmail } from './duplicate-email'

export interface UpdateUserFormProps {
  /** 요청 경로의 userId */
  userId: number
}

/** 사용자의 지금 값으로 폼을 채운다. 부서가 없으면 비워 둔다. */
function formValuesOf({ name, email, role, status, department }: UserAccount) {
  return { name, email, role, status, ...(department === undefined ? {} : { department }) }
}

/**
 * updateUser(사용자 수정)의 요청 본문을 입력받아 보내는 폼. `npm run g -- form updateUser --feature user-form`이 만든 폼에서
 * 사용자의 지금 값(getUser)으로 입력을 채우고, 레이블과 선택지를 화면에 맞게 바꾸고, 고치면 사용자 목록으로 돌아가게 고쳤다.
 * 지금 값은 페이지가 서버에서 가져와(prefetch) hydration으로 넘긴다. 명세의 updateUser는 보낸 값으로 바꾸므로(PUT) 부서를
 * 비우고 보내면 부서를 지운다. 백엔드가 로그인 세션이나 역할 때문에 거절하면(401·403) 알리고 서버가 이 화면의 접근 규칙을
 * 다시 확인하게 한다.
 */
export function UpdateUserForm({ userId }: UpdateUserFormProps) {
  const { data: user } = useSuspenseQuery(getUserQueryOptions(userId))
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useSchemaForm(UpdateUserBody, { defaultValues: formValuesOf(user) })
  const mutation = useUpdateUserMutation()
  const toast = useToast()
  const router = useRouter()

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { userId, userAccountUpdate: values },
      {
        onSuccess: (updated) => {
          toast.add({ title: '사용자를 고쳤습니다', description: `${updated.name}님의 정보를 저장했습니다.` })
          router.push(USERS_PATH)
        },
        onError: (error) => {
          if (isDuplicateEmail(error)) {
            setError('email', { message: DUPLICATE_EMAIL_MESSAGE }, { shouldFocus: true })
            return
          }
          if (isAccessDenied(error)) {
            // 세션이 끝났거나 관리자가 아니다. 서버(proxy)가 이 화면의 접근 규칙을 다시 확인한다(access-denied.ts).
            toast.add({ type: 'error', title: '사용자 수정 실패', description: accessDeniedMessage(error) })
            router.refresh()
            return
          }
          toast.add({ type: 'error', title: '사용자 수정 실패', description: '잠시 뒤에 다시 시도해 주세요.' })
        },
      },
    )
  })

  return (
    <form noValidate className="flex max-w-md flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
      <p className="text-sm text-muted-foreground">
        {user.name}({user.email})님의 정보를 고칩니다.
      </p>
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
      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <Field invalid={errors.status !== undefined}>
            <Select
              label="상태"
              options={USER_STATUS_OPTIONS}
              value={field.value ?? null}
              onValueChange={field.onChange}
              inputRef={field.ref}
            />
            <FieldError match={errors.status !== undefined}>{errors.status?.message}</FieldError>
          </Field>
        )}
      />
      <Field invalid={errors.department !== undefined}>
        <FieldLabel>부서</FieldLabel>
        <Input {...register('department')} />
        <FieldDescription>비워 두면 부서를 지웁니다.</FieldDescription>
        <FieldError match={errors.department !== undefined}>{errors.department?.message}</FieldError>
      </Field>
      <Button type="submit" disabled={mutation.isPending || mutation.isSuccess}>
        사용자 수정
      </Button>
    </form>
  )
}
