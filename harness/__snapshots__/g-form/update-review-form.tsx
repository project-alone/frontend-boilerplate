'use client'

import { useUpdateReviewMutation } from '@/queries/reviews/reviews.queries'
import { UpdateReviewBody } from '@/shared/api/generated/model'
import type { ListProductReviewsParams } from '@/shared/api/generated/model'
import { useSchemaForm } from '@/shared/form/use-schema-form'
import { Button } from '@/shared/ui/button'
import { Field, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { useToast } from '@/shared/ui/toast'

export interface UpdateReviewFormProps {
  /** 요청 경로의 reviewId */
  reviewId: number
  /** useUpdateReviewMutation에 넘기는 productId. 응답 전에 고칠 쿼리의 인자이므로 화면이 보고 있는 쿼리와 같은 값을 넘긴다 */
  productId: number
  /** useUpdateReviewMutation에 넘기는 params. 응답 전에 고칠 쿼리의 인자이므로 화면이 보고 있는 쿼리와 같은 값을 넘긴다. 생략하면 훅의 기본값을 쓴다 */
  params?: ListProductReviewsParams
}

/**
 * updateReview(리뷰 수정)의 요청 본문을 입력받아 보내는 폼. 입력 값은 재생성 계층의 요청 본문 스키마(UpdateReviewBody)로
 * 검증하고, 제출하면 reviews Query Domain의 useUpdateReviewMutation으로 보낸다. 성공하든 실패하든 알림(토스트)으로 알린다.
 * 레이블은 명세의 title(없으면 필드 이름)이다. 문구와 성공한 뒤의 동작(지금은 폼을 비운다)은 화면에 맞게 고친다.
 */
export function UpdateReviewForm({ reviewId, productId, params }: UpdateReviewFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useSchemaForm(UpdateReviewBody)
  const mutation = useUpdateReviewMutation(productId, params)
  const toast = useToast()

  const onSubmit = handleSubmit((values) => {
    mutation.mutate(
      { reviewId, newReview: values },
      {
        onSuccess: () => {
          toast.add({ title: '리뷰 수정 완료' })
          reset()
        },
        onError: () => {
          toast.add({ type: 'error', title: '리뷰 수정 실패', description: '잠시 뒤에 다시 시도해 주세요.' })
        },
      },
    )
  })

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(event) => void onSubmit(event)}>
      <Field invalid={errors.rating !== undefined}>
        <FieldLabel>별점</FieldLabel>
        <Input type="number" {...register('rating', { valueAsNumber: true })} />
        <FieldError match={errors.rating !== undefined}>{errors.rating?.message}</FieldError>
      </Field>
      <Field invalid={errors.comment !== undefined}>
        <FieldLabel>리뷰</FieldLabel>
        <Input {...register('comment')} />
        <FieldError match={errors.comment !== undefined}>{errors.comment?.message}</FieldError>
      </Field>
      <Button type="submit" disabled={mutation.isPending}>
        리뷰 수정
      </Button>
    </form>
  )
}
