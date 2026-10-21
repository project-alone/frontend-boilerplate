// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/form/use-schema-form.test.ts

import { act, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import * as z from 'zod'
import { useSchemaForm } from './use-schema-form'

// 재생성 계층(orval)은 null을 받는 선택 필드를 nullish로 만든다.
const profileSchema = z.object({
  name: z.string(),
  bio: z.string().nullish(),
})

/** 프로필 폼을 만들고, 지금 값으로 제출해 제출 핸들러가 받은 값(검증을 통과한 값)을 돌려주는 submit과 함께 돌려준다. */
function renderProfileForm(defaultValues?: { name?: string; bio?: string }) {
  const { result } = renderHook(() => useSchemaForm(profileSchema, { defaultValues }))
  const submit = async () => {
    const onValid = vi.fn()
    await act(() => result.current.handleSubmit(onValid)())
    return onValid.mock.calls.map(([values]: unknown[]) => values)
  }
  return { form: () => result.current, submit }
}

test('처음 값을 useForm과 formResolver에 함께 넘기므로, 처음 값이 있던 null을 받는 선택 필드를 비우면 null을 보낸다', async () => {
  const { form, submit } = renderProfileForm({ name: '홍길동', bio: '안녕하세요' })

  expect(form().getValues()).toEqual({ name: '홍길동', bio: '안녕하세요' })
  act(() => {
    form().setValue('bio', '')
  })

  expect(await submit()).toEqual([{ name: '홍길동', bio: null }])
})

test('처음 값이 없으면 비워 둔 null을 받는 선택 필드는 보내지 않는다', async () => {
  const { form, submit } = renderProfileForm()

  act(() => {
    form().setValue('name', '홍길동')
    form().setValue('bio', '')
  })

  expect(await submit()).toEqual([{ name: '홍길동' }])
})
