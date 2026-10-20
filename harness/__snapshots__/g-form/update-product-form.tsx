'use client'

import { useForm } from 'react-hook-form'
import { useUpdateProductMutation } from '@/queries/products/products.queries'
import { UpdateProductBody } from '@/shared/api/generated/model'
import { formResolver } from '@/shared/form/form-resolver'
import { Button } from '@/shared/ui/button'
import { Field, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { useToast } from '@/shared/ui/toast'

export interface UpdateProductFormProps {
  /** 요청 경로의 productId */
  productId: number
}

/**
 * updateProduct(상품 수정)의 요청 본문을 입력받아 보내는 폼. 입력 값은 재생성 계층의 요청 본문 스키마(UpdateProductBody)로
 * 검증하고, 제출하면 products Query Domain의 useUpdateProductMutation으로 보낸다. 성공하든 실패하든 알림(토스트)으로 알린다.
 * 레이블은 명세의 title(없으면 필드 이름)이다. 문구와 성공한 뒤의 동작(지금은 폼을 비운다)은 화면에 맞게 고친다.
 */
export function UpdateProductForm({ productId }: UpdateProductFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: formResolver(UpdateProductBody),
  })
  const mutation = useUpdateProductMutation()
  const toast = useToast()

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { productId, newProduct: values },
      {
        onSuccess: () => {
          toast.add({ title: '상품 수정 완료' })
          reset()
        },
        onError: () => {
          toast.add({ type: 'error', title: '상품 수정 실패', description: '잠시 뒤에 다시 시도해 주세요.' })
        },
      },
    )
  })

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
      <Field invalid={errors.name !== undefined}>
        <FieldLabel>name</FieldLabel>
        <Input {...register('name')} />
        <FieldError match={errors.name !== undefined}>{errors.name?.message}</FieldError>
      </Field>
      <Field invalid={errors.price !== undefined}>
        <FieldLabel>price</FieldLabel>
        <Input type="number" {...register('price', { valueAsNumber: true })} />
        <FieldError match={errors.price !== undefined}>{errors.price?.message}</FieldError>
      </Field>
      <Button type="submit" disabled={mutation.isPending}>
        상품 수정
      </Button>
    </form>
  )
}
