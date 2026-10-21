'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { getCatalogProductQueryOptions } from '@/queries/catalog/catalog.queries'
import { useAddCartItemMutation, useCreateCartMutation } from '@/queries/cart/cart.queries'
import { AddCartItemBody } from '@/shared/api/generated/model'
import { useSchemaForm } from '@/shared/form/use-schema-form'
import { forgetCartId, rememberCartId, useCartId } from '@/shared/shop/cart-id'
import { isNotFound, shopFailureReason } from '@/shared/shop/shop-errors'
import { CART_PATH } from '@/shared/shop/shop-routes'
import { Button } from '@/shared/ui/button'
import { Field, FieldError, FieldLabel } from '@/shared/ui/field'
import { Input } from '@/shared/ui/input'
import { useToast } from '@/shared/ui/toast'

// 수량만 입력받는다. 담을 상품(productId)은 이 폼이 놓인 상품 상세의 것이다. 검증 규칙(1~99)은 명세에서 온다.
const QuantitySchema = AddCartItemBody.pick({ quantity: true })

/**
 * 장바구니에 담는 폼(addCartItem). `npm run g -- form addCartItem --feature shop-cart`가 만든 폼에서 수량만 입력받고, 장바구니가
 * 없으면 처음 담는 상품으로 장바구니를 만들게(createCart) 고쳤다.
 *
 * - 장바구니가 있으면 cart Query Domain의 useAddCartItemMutation이 응답을 기다리지 않고 장바구니 쿼리를 고치므로(낙관적
 *   업데이트) 쇼핑몰 안 이동의 장바구니 수량이 바로 늘어난다. 백엔드가 거절하면(재고 부족 등) 훅이 되돌리고, 이 폼은 무엇을 왜
 *   되돌렸는지 알림으로 알린다.
 * - 장바구니가 없으면 백엔드가 장바구니의 id를 정해야 하므로 응답을 기다린 뒤 그 id를 저장한다(src/shared/shop/cart-id.ts).
 * - 담았다는 것은 스크린 리더도 듣도록 상태 문구(role="status")로 알린다.
 */
export function AddToCartForm({ productId }: Readonly<{ productId: number }>) {
  const { data: product } = useQuery(getCatalogProductQueryOptions(productId))
  const cartId = useCartId()
  const createCart = useCreateCartMutation()
  const addItem = useAddCartItemMutation(cartId ?? '')
  const toast = useToast()
  const [added, setAdded] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useSchemaForm(QuantitySchema, { defaultValues: { quantity: 1 } })

  if (product === undefined) return null
  if (product.stock === 0) return <p>품절된 상품이라 장바구니에 담을 수 없습니다.</p>

  const fail = (error: Error) => {
    setAdded('')
    // 백엔드에 저장한 장바구니가 없으면 id를 지운다. 다시 담으면 새 장바구니를 만든다.
    if (isNotFound(error)) forgetCartId()
    toast.add({
      type: 'error',
      title: '장바구니에 담지 못했습니다',
      description: `${product.name}: ${shopFailureReason(error)}`,
    })
  }

  const onSubmit = handleSubmit(({ quantity }) => {
    const newCartItem = { productId, quantity }
    const message = `${product.name} ${String(quantity)}개를 장바구니에 담았습니다.`
    if (typeof cartId === 'string') {
      setAdded(message)
      addItem.mutate({ cartId, newCartItem }, { onError: fail })
      return
    }
    createCart.mutate(newCartItem, {
      onSuccess: (cart) => {
        rememberCartId(cart.id)
        setAdded(message)
      },
      onError: fail,
    })
  })

  return (
    <form
      noValidate
      aria-label="장바구니에 담기"
      className="flex flex-col gap-4"
      onSubmit={(event) => void onSubmit(event)}
    >
      <Field invalid={errors.quantity !== undefined} className="max-w-40">
        <FieldLabel>수량</FieldLabel>
        <Input type="number" min={1} max={99} {...register('quantity', { valueAsNumber: true })} />
        <FieldError match={errors.quantity !== undefined}>{errors.quantity?.message}</FieldError>
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        {/* 브라우저가 저장한 장바구니를 읽기 전(cartId가 undefined)에는 담지 않아 장바구니를 둘 만들지 않는다. */}
        <Button type="submit" disabled={cartId === undefined || createCart.isPending}>
          장바구니에 담기
        </Button>
        <p role="status" className="text-sm">
          {added}
          {added !== '' && (
            <>
              {' '}
              <Link href={CART_PATH} className="focus-ring rounded-sm underline underline-offset-4">
                장바구니 보기
              </Link>
            </>
          )}
        </p>
      </div>
    </form>
  )
}
