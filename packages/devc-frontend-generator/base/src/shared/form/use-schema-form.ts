import { type DefaultValues, type FieldValues, useForm, type UseFormProps, type UseFormReturn } from 'react-hook-form'
import type * as z from 'zod'
import { type FormDraft, formResolver, type FormResolverOptions } from './form-resolver'

/** useSchemaForm의 옵션. 처음 값(defaultValues)과, resolver를 뺀 useForm의 나머지 옵션(mode 등)이다. */
export type SchemaFormOptions<Input extends FieldValues, Output> = FormResolverOptions<Input> &
  Omit<UseFormProps<FormDraft<Input>, unknown, Output>, 'resolver' | 'defaultValues'>

/**
 * Zod 스키마(재생성 계층의 요청 본문 스키마)로 검증하는 React Hook Form 폼. useForm에 formResolver(schema)를 resolver로 넘기고,
 * 폼의 처음 값(defaultValues)을 useForm과 formResolver에 함께 넘긴다. 현재 값을 채운 수정 폼도 처음 값을 한 번만 적으면 되고,
 * 두 곳에 따로 적다가 한쪽만 고쳐 null을 받는 선택 필드를 비워도 null을 보내지 않는 일이 없다(formResolver).
 *
 *   const form = useSchemaForm(UpdateProfileBody, { defaultValues: { nickname: profile.nickname, bio: profile.bio } })
 *
 * 돌려주는 값은 useForm과 같다. 제출 핸들러(handleSubmit)는 검증을 통과한 값(스키마의 output)을 받는다.
 * reset(values)로 처음 값을 바꾸면 formResolver는 바뀐 값을 모르므로, 새 처음 값으로 폼을 다시 만든다(컴포넌트의 key를 바꾼다).
 */
export function useSchemaForm<Input extends FieldValues, Output>(
  schema: z.ZodType<Output, Input>,
  { defaultValues, ...options }: SchemaFormOptions<Input, Output> = {},
): UseFormReturn<FormDraft<Input>, unknown, Output> {
  return useForm<FormDraft<Input>, unknown, Output>({
    ...options,
    resolver: formResolver(schema, { defaultValues }),
    // FormDraft는 모든 필드가 비어 있을 수 있는 값이라 DefaultValues(DeepPartial)에 들어맞지만, 제네릭 타입으로는 TypeScript가
    // 증명하지 못하므로 타입만 맞춘다.
    ...(defaultValues === undefined ? {} : { defaultValues: defaultValues as DefaultValues<FormDraft<Input>> }),
  })
}
