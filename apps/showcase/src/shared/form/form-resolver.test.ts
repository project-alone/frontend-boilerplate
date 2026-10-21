// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/src/shared/form/form-resolver.test.ts

import { expect, test } from 'vitest'
import * as z from 'zod'
import { formResolver, MUST_CHECK_MESSAGE, REQUIRED_MESSAGE } from './form-resolver'

// 재생성 계층(orval)의 요청 본문 스키마처럼 선택 필드는 exactOptional이다. 키가 없어야 하고 undefined 값은 받지 않는다.
const schema = z.object({
  name: z.string().min(2),
  age: z.int().exactOptional(),
  nickname: z.string().exactOptional(),
})

function validate(values: { name?: string; age?: number; nickname?: string }) {
  return formResolver(schema)(values, undefined, { fields: {}, shouldUseNativeValidation: false })
}

test('비워 둔 선택 필드(빈 문자열, 비운 숫자 입력의 NaN)는 빼고 검증을 통과한 값을 넘긴다', async () => {
  const result = await validate({ name: '홍길동', age: Number.NaN, nickname: '' })

  expect(result).toEqual({ values: { name: '홍길동' }, errors: {} })
})

test('비워 둔 필수 필드는 값을 입력하라고 알린다', async () => {
  const { errors } = await validate({ name: '' })

  expect(errors.name?.message).toBe(REQUIRED_MESSAGE)
})

test('그 밖의 검증 오류는 Zod의 한국어 메시지로 알린다', async () => {
  const { errors } = await validate({ name: '홍' })

  expect(errors.name?.message).toContain('2문자 이상')
})

// 재생성 계층(orval)은 null을 받는 필수 필드를 nullable로, null을 받는 선택 필드를 nullish로 만든다.
const profileSchema = z.object({
  name: z.string(),
  phone: z.string().nullable(),
  floor: z.int().nullable(),
  bio: z.string().nullish(),
})

interface ProfileDraft {
  name?: string
  phone?: string | null
  floor?: number | null
  bio?: string | null
}

function validateProfile(values: ProfileDraft, defaultValues?: ProfileDraft) {
  return formResolver(profileSchema, { defaultValues })(values, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  })
}

test('null을 받는 필수 필드는 비워 두면 null을 보내고, 처음부터 비어 있던 null을 받는 선택 필드는 보내지 않는다', async () => {
  const result = await validateProfile({ name: '홍길동', phone: '', floor: Number.NaN, bio: '' })

  expect(result).toEqual({ values: { name: '홍길동', phone: null, floor: null }, errors: {} })
})

test('기본값(default)이 있는 필드는 null을 받아도 비워 두면 기본값을 보낸다', async () => {
  const resolve = formResolver(z.object({ title: z.string().nullable().default('회원') }))

  const result = await resolve({ title: '' }, undefined, { fields: {}, shouldUseNativeValidation: false })

  expect(result).toEqual({ values: { title: '회원' }, errors: {} })
})

test('null을 받는 선택 필드는 처음 값(defaultValues)이 있던 입력을 비우면 null을 보낸다', async () => {
  const result = await validateProfile(
    { name: '홍길동', phone: '010-0000-0000', floor: 3, bio: '' },
    { name: '홍길동', phone: '010-0000-0000', floor: 3, bio: '안녕하세요' },
  )

  expect(result).toEqual({ values: { name: '홍길동', phone: '010-0000-0000', floor: 3, bio: null }, errors: {} })
})

// 반드시 true여야 하는 불리언(명세의 const: true, enum: [true])은 재생성 계층에서 z.literal(true)가 된다.
const consentSchema = z.object({
  terms: z.literal(true),
  privacy: z.literal(true),
  events: z.literal(true).exactOptional(),
  newsletter: z.boolean(),
})

test('반드시 true여야 하는 필드는 체크하지 않으면 체크하라고 알리고, 선택 필드면 보내지 않는다', async () => {
  const validateConsent = formResolver(consentSchema)

  const unchecked = await validateConsent(
    { terms: false, privacy: true, events: false, newsletter: false },
    undefined,
    { fields: {}, shouldUseNativeValidation: false },
  )
  const checked = await validateConsent({ terms: true, privacy: true, events: false, newsletter: false }, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  })

  expect(unchecked.errors.terms?.message).toBe(MUST_CHECK_MESSAGE)
  expect(Object.keys(unchecked.errors)).toEqual(['terms'])
  expect(checked).toEqual({ values: { terms: true, privacy: true, newsletter: false }, errors: {} })
})
