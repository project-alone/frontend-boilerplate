// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/auth/src/features/login-form/login-form.tsx

'use client'

import { useForm } from 'react-hook-form'
import { useLoginMutation } from '@/queries/auth/auth.queries'
import { LoginBody } from '@/shared/api/generated/model'
import { LoginFailedError } from '@/shared/auth/auth-client'
import { formResolver } from '@/shared/form/form-resolver'
import { Button } from '@/shared/ui/button'
import { Field, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'

/**
 * 이메일과 비밀번호로 로그인하는 폼. 입력 값은 재생성 계층의 요청 본문 스키마(LoginBody)로 검증하고, BFF의 로그인 Route
 * Handler로 보낸다(useLoginMutation). 로그인하면 returnPath로 돌아간다. 브라우저는 토큰을 받지 않는다.
 */
export function LoginForm({
  returnPath,
  // 로그인한 뒤 돌아갈 페이지로 새로 들어간다. 로그인하기 전에 받아 둔 화면과 캐시를 남기지 않는다.
  onLoggedIn = (path) => {
    window.location.assign(path)
  },
}: Readonly<{ returnPath: string; onLoggedIn?: (path: string) => void }>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: formResolver(LoginBody) })
  const login = useLoginMutation()

  const onSubmit = handleSubmit((credentials) => {
    login.mutate(credentials, {
      onSuccess: () => {
        onLoggedIn(returnPath)
      },
    })
  })

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
      <Field invalid={errors.email !== undefined}>
        <FieldLabel>이메일</FieldLabel>
        <Input type="email" autoComplete="username" {...register('email')} />
        <FieldError match={errors.email !== undefined}>{errors.email?.message}</FieldError>
      </Field>
      <Field invalid={errors.password !== undefined}>
        <FieldLabel>비밀번호</FieldLabel>
        <Input type="password" autoComplete="current-password" {...register('password')} />
        <FieldError match={errors.password !== undefined}>{errors.password?.message}</FieldError>
      </Field>
      {login.isError && (
        <p role="alert" className="text-sm text-danger">
          {login.error instanceof LoginFailedError ? login.error.message : '잠시 뒤에 다시 시도해 주세요.'}
        </p>
      )}
      <Button type="submit" disabled={login.isPending || login.isSuccess}>
        로그인
      </Button>
    </form>
  )
}
