// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/features/shop-checkout/checkout-steps.tsx

'use client'

import type { ReactNode } from 'react'
import { Controller } from 'react-hook-form'
import { PaymentMethod, PlaceOrderBody } from '@/shared/api/generated/model'
import type { FormDraft } from '@/shared/form/form-resolver'
import { StepForm, type StepFormProps, type StepFormReturn } from '@/shared/multi-step-form/step-form'
import { PAYMENT_METHOD_LABELS } from '@/shared/shop/shop-labels'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'

// 커머스 Archetype: 주문서(placeOrder)의 단계. multi-step-form Recipe의 입점 신청서처럼 단계마다 재생성 계층의 요청 본문
// 스키마(PlaceOrderBody)에서 그 단계의 필드만 고른 스키마(pick)로 검증하므로 검증 규칙은 명세에서만 온다. 장바구니 id(cartId)는
// 사용자가 입력하지 않으므로 폼의 스키마에서 빼고, 주문할 때 더한다. 단계를 더하거나 순서를 바꾸려면 CHECKOUT_STEPS의
// 항목(제목, 스키마, 입력 요소, 확인 단계에 보일 값)만 고친다.

/** 주문서가 검증하는 값. 요청 본문에서 사용자가 입력하지 않는 장바구니 id를 뺐다. */
export const CheckoutSchema = PlaceOrderBody.omit({ cartId: true })

export type CheckoutValues = Omit<PlaceOrderBody, 'cartId'>

/** 모든 단계에서 입력한 값(검증하기 전) */
export type CheckoutDraft = FormDraft<CheckoutValues>

/** 입력하던 주문서를 둘 sessionStorage의 키. 결제를 마치면 지운다(fake-payment.tsx). */
export const CHECKOUT_DRAFT_KEY = 'shop-checkout-draft'

/** 모든 단계 폼이 함께 받는 props. CheckoutForm이 useFormSteps로 채운다. */
export type CommonStepProps = Omit<StepFormProps<CheckoutValues, unknown>, 'schema' | 'children' | 'onInvalid'>

export interface CheckoutStep {
  title: string
  /** 이 단계에서 입력하는 필드. 확인 단계의 검증이 실패하면 오류 필드가 있는 단계로 돌아갈 때 쓴다. */
  fields: readonly string[]
  /** 이 단계의 폼 */
  render: (props: CommonStepProps) => ReactNode
  /** 확인 단계에 보일 [항목, 값] */
  summary: (draft: CheckoutDraft) => [term: string, value: string][]
}

const shippingStep = CheckoutSchema.pick({
  recipient: true,
  phone: true,
  postalCode: true,
  address: true,
  addressDetail: true,
  deliveryMemo: true,
})
const paymentStep = CheckoutSchema.pick({ paymentMethod: true })

const paymentMethodOptions = PaymentMethod.options.map((method) => ({
  value: method,
  label: PAYMENT_METHOD_LABELS[method],
}))

const NOT_ENTERED = '입력하지 않음'

function displayValue(value: string | undefined): string {
  return value === undefined || value === '' ? NOT_ENTERED : value
}

/** 우편번호, 주소, 상세 주소를 한 줄로 */
function addressOf({ postalCode, address, addressDetail }: CheckoutDraft): string {
  const parts = [postalCode, address, addressDetail].filter((part) => part !== undefined && part !== '')
  return parts.length === 0 ? NOT_ENTERED : parts.join(' ')
}

/** 입력 단계. 이 뒤에 확인 단계(주문 확인)가 오고, 주문하면 결제 단계(테스트 결제창)로 간다. */
export const CHECKOUT_STEPS: readonly CheckoutStep[] = [
  {
    title: '배송 정보',
    fields: Object.keys(shippingStep.shape),
    render: (props) => (
      <StepForm schema={shippingStep} {...props}>
        {(form) => <ShippingFields form={form} />}
      </StepForm>
    ),
    summary: (draft) => [
      ['받는 사람', displayValue(draft.recipient)],
      ['연락처', displayValue(draft.phone)],
      ['주소', addressOf(draft)],
      ['배송 메모', displayValue(draft.deliveryMemo)],
    ],
  },
  {
    title: '결제 수단',
    fields: Object.keys(paymentStep.shape),
    render: (props) => (
      <StepForm schema={paymentStep} {...props}>
        {(form) => <PaymentFields form={form} />}
      </StepForm>
    ),
    summary: (draft) => [
      ['결제 수단', draft.paymentMethod === undefined ? NOT_ENTERED : PAYMENT_METHOD_LABELS[draft.paymentMethod]],
    ],
  },
]

/** 주문서의 모든 단계 제목. 입력 단계, 확인 단계, 그리고 주문한 뒤 다른 화면에서 이어지는 결제 단계다. */
export const CHECKOUT_STEP_TITLES = [...CHECKOUT_STEPS.map(({ title }) => title), '주문 확인', '결제']

// 입력 요소와 오류 표시는 `npm run g -- form placeOrder`가 만드는 폼과 같다(Base README의 "폼"). 레이블은 명세의 title이다.

function ShippingFields({ form }: Readonly<{ form: StepFormReturn<typeof shippingStep> }>) {
  const {
    register,
    formState: { errors },
  } = form
  return (
    <>
      <Field invalid={errors.recipient !== undefined}>
        <FieldLabel>받는 사람</FieldLabel>
        <Input autoComplete="shipping name" {...register('recipient')} />
        <FieldError match={errors.recipient !== undefined}>{errors.recipient?.message}</FieldError>
      </Field>
      <Field invalid={errors.phone !== undefined}>
        <FieldLabel>연락처</FieldLabel>
        <Input type="tel" autoComplete="shipping tel" {...register('phone')} />
        <FieldDescription>010-0000-0000 형식으로 적습니다.</FieldDescription>
        <FieldError match={errors.phone !== undefined}>{errors.phone?.message}</FieldError>
      </Field>
      <Field invalid={errors.postalCode !== undefined}>
        <FieldLabel>우편번호</FieldLabel>
        <Input inputMode="numeric" autoComplete="shipping postal-code" {...register('postalCode')} />
        <FieldDescription>다섯 자리 숫자로 적습니다.</FieldDescription>
        <FieldError match={errors.postalCode !== undefined}>{errors.postalCode?.message}</FieldError>
      </Field>
      <Field invalid={errors.address !== undefined}>
        <FieldLabel>주소</FieldLabel>
        <Input autoComplete="shipping address-line1" {...register('address')} />
        <FieldError match={errors.address !== undefined}>{errors.address?.message}</FieldError>
      </Field>
      <Field invalid={errors.addressDetail !== undefined}>
        <FieldLabel>상세 주소</FieldLabel>
        <Input autoComplete="shipping address-line2" {...register('addressDetail')} />
        <FieldError match={errors.addressDetail !== undefined}>{errors.addressDetail?.message}</FieldError>
      </Field>
      <Field invalid={errors.deliveryMemo !== undefined}>
        <FieldLabel>배송 메모</FieldLabel>
        <Input {...register('deliveryMemo')} />
        <FieldError match={errors.deliveryMemo !== undefined}>{errors.deliveryMemo?.message}</FieldError>
      </Field>
    </>
  )
}

function PaymentFields({ form }: Readonly<{ form: StepFormReturn<typeof paymentStep> }>) {
  const {
    control,
    formState: { errors },
  } = form
  return (
    <Controller
      control={control}
      name="paymentMethod"
      render={({ field }) => (
        <Field invalid={errors.paymentMethod !== undefined}>
          <Select
            label="결제 수단"
            options={paymentMethodOptions}
            value={field.value ?? null}
            onValueChange={field.onChange}
            inputRef={field.ref}
          />
          <FieldDescription>
            PG(결제대행사)를 연동하지 않아 어느 결제 수단을 골라도 주문한 뒤 테스트 결제창이 열립니다.
          </FieldDescription>
          <FieldError match={errors.paymentMethod !== undefined}>{errors.paymentMethod?.message}</FieldError>
        </Field>
      )}
    />
  )
}
