// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/features/shop-checkout/checkout-form.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useId } from 'react'
import { Controller } from 'react-hook-form'
import { getCartQueryOptions } from '@/queries/cart/cart.queries'
import { usePlaceOrderMutation } from '@/queries/orders/orders.queries'
import type { Cart } from '@/shared/api/generated/model'
import { StepForm } from '@/shared/multi-step-form/step-form'
import { StepIndicator } from '@/shared/multi-step-form/step-indicator'
import { useFormSteps } from '@/shared/multi-step-form/use-form-steps'
import { currentCartQuery, useCartId } from '@/shared/shop/cart-id'
import { shopFailureReason } from '@/shared/shop/shop-errors'
import { CART_PATH, orderPaymentPath } from '@/shared/shop/shop-routes'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/shared/ui/field'
import { useToast } from '@/shared/ui/toast'
import {
  CHECKOUT_DRAFT_KEY,
  CHECKOUT_STEP_TITLES,
  CHECKOUT_STEPS,
  CheckoutSchema,
  type CheckoutValues,
  type CommonStepProps,
} from './checkout-steps'
import { OrderLines } from './order-lines'

// 주문서에서 입력하는 단계(입력 단계와 확인 단계). 결제 단계는 주문한 뒤 결제창 화면에서 이어진다.
const FORM_STEP_COUNT = CHECKOUT_STEPS.length + 1

/**
 * 주문서. 이 브라우저의 장바구니를 불러와, 담긴 상품이 있으면 다단계 폼을 보여 준다. 장바구니가 없거나 비었으면 장바구니로
 * 안내한다.
 */
export function CheckoutForm() {
  const cartId = useCartId()
  const { data: cart, isError } = useQuery({ ...getCartQueryOptions(cartId ?? ''), ...currentCartQuery(cartId) })

  if (cartId === undefined || (cartId !== null && cart === undefined && !isError)) {
    return <p role="status">주문서를 준비하는 중입니다.</p>
  }
  if (cart === undefined || cart.items.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p>주문할 상품이 없습니다. 장바구니에 상품을 담은 뒤 주문해 주세요.</p>
        <Link href={CART_PATH} className="focus-ring rounded-sm underline underline-offset-4">
          장바구니로
        </Link>
      </div>
    )
  }
  return <CheckoutSteps cart={cart} />
}

/**
 * 주문서(placeOrder)의 단계. multi-step-form Recipe의 부품(useFormSteps, StepForm)으로 배송 정보 → 결제 수단 → 주문 확인
 * 순서로 입력받는다(단계는 checkout-steps.tsx).
 *
 * - "다음"은 지금 단계의 필드만 검증하고, "이전"은 검증하지 않고 돌아가며 입력한 값은 남는다. 입력하던 값은 sessionStorage에
 *   두어 새로 고치거나 결제창에서 취소하고 돌아와도 이어 간다.
 * - 확인 단계의 "결제하기"가 모든 단계의 값을 한 번 더 검증한 뒤, orders Query Domain의 usePlaceOrderMutation으로 장바구니의
 *   id와 함께 보낸다. 백엔드가 결제 대기 주문을 만들면 그 주문의 결제창(가짜 결제 단계)으로 간다. 실패하면(재고 부족 등)
 *   알림으로 알린다.
 */
function CheckoutSteps({ cart }: Readonly<{ cart: Cart }>) {
  const steps = useFormSteps<CheckoutValues>({ count: FORM_STEP_COUNT, storageKey: CHECKOUT_DRAFT_KEY })
  const headingId = useId()
  const placeOrder = usePlaceOrderMutation()
  const router = useRouter()
  const toast = useToast()
  const inputStep = CHECKOUT_STEPS[steps.index]
  // 결제창으로 옮겨 가는 동안에도 다시 주문하지 않도록 버튼을 끈 채 둔다.
  const pending = placeOrder.isPending || placeOrder.isSuccess
  // 스크린 리더는 단계를 옮길 때 포커스를 받은 제목과 함께 이 문구를 읽는다.
  const position = `(${String(CHECKOUT_STEP_TITLES.length)}단계 중 ${String(steps.index + 1)}단계)`

  const stepProps: CommonStepProps = {
    defaultValues: steps.draft,
    onNext: (_, values) => {
      steps.next(values)
    },
    onBack: steps.index > 0 ? steps.back : undefined,
    onValuesChange: steps.save,
    validateOnMount: steps.validateOnMount,
    labelledBy: headingId,
    submitLabel: '다음',
    pending,
  }

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator label="주문 단계" steps={CHECKOUT_STEP_TITLES} current={steps.index} />
      <h2 id={headingId} ref={steps.headingRef} tabIndex={-1} className="text-md outline-none">
        <span className="font-semibold">{CHECKOUT_STEP_TITLES[steps.index]}</span>{' '}
        <span className="text-muted-foreground">{position}</span>
      </h2>
      {/* 단계를 옮기면 key가 바뀌어 그 단계의 폼을 모든 단계의 값(draft)으로 새로 만든다. */}
      <Fragment key={steps.formKey}>
        {inputStep !== undefined ? (
          inputStep.render(stepProps)
        ) : (
          <StepForm
            schema={CheckoutSchema}
            {...stepProps}
            submitLabel="결제하기"
            // 저장한 값을 이어 보여 줬다면 지금 규칙에 맞지 않을 수 있다. 그 값이 있는 첫 단계로 돌아간다.
            onInvalid={(errors) => {
              const invalid = Object.keys(errors)
              const step = CHECKOUT_STEPS.findIndex(({ fields }) => fields.some((name) => invalid.includes(name)))
              if (step >= 0) steps.goTo(step, { validate: true })
            }}
            onNext={(values) => {
              placeOrder.mutate(
                { ...values, cartId: cart.id },
                {
                  onSuccess: (order) => {
                    router.push(orderPaymentPath(order.id))
                  },
                  onError: (error) => {
                    toast.add({ type: 'error', title: '주문하지 못했습니다', description: shopFailureReason(error) })
                  },
                },
              )
            }}
          >
            {({ control, formState: { errors } }) => (
              <>
                <OrderLines caption="주문 상품" lines={cart.items} totalPrice={cart.totalPrice} />
                {CHECKOUT_STEPS.map(({ title, summary }, step) => (
                  <ReviewSection
                    key={title}
                    title={title}
                    items={summary(steps.draft)}
                    disabled={pending}
                    onEdit={() => {
                      steps.goTo(step)
                    }}
                  />
                ))}
                <Controller
                  control={control}
                  name="agreedToPurchase"
                  render={({ field }) => (
                    <Field invalid={errors.agreedToPurchase !== undefined}>
                      <FieldLabel>
                        <Checkbox
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                          inputRef={field.ref}
                        />
                        주문 내용을 확인했고 결제에 동의합니다
                      </FieldLabel>
                      {/* 명세의 const: true라 체크하지 않으면 formResolver가 MUST_CHECK_MESSAGE로 알린다. */}
                      <FieldError match={errors.agreedToPurchase !== undefined}>
                        {errors.agreedToPurchase?.message}
                      </FieldError>
                    </Field>
                  )}
                />
              </>
            )}
          </StepForm>
        )}
      </Fragment>
    </div>
  )
}

/**
 * 확인 단계에서 한 입력 단계의 값을 묶어 보여 준다. "수정" 버튼으로 그 단계로 돌아간다. 주문하는 동안에는(disabled) 돌아가지
 * 않는다. 돌아가 고친 값은 이미 보낸 요청에 담기지 않기 때문이다.
 */
function ReviewSection({
  title,
  items,
  disabled,
  onEdit,
}: Readonly<{ title: string; items: readonly [string, string][]; disabled: boolean; onEdit: () => void }>) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-md font-semibold">
          {title}
        </h3>
        <Button variant="secondary" size="sm" aria-label={`${title} 수정`} disabled={disabled} onClick={onEdit}>
          수정
        </Button>
      </div>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        {items.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted-foreground">{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
