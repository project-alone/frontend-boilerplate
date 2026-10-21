// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/features/shop-nav/shop-nav.tsx

'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getCartQueryOptions } from '@/queries/cart/cart.queries'
import { currentCartQuery, useCartId, useForgetMissingCart } from '@/shared/shop/cart-id'
import { CART_PATH, SHOP_PATH } from '@/shared/shop/shop-routes'

const LINK_CLASS_NAME =
  'focus-ring inline-flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline aria-[current=page]:underline'

/**
 * /shop 아래 모든 화면 위의 쇼핑몰 안 이동(상품, 장바구니). 장바구니 링크에 담긴 수량을 보여 준다. 수량은 cart Query Domain의
 * getCart 쿼리에서 읽으므로, 담거나 수량을 바꾸면 응답을 기다리지 않고 바로 바뀌고(낙관적 업데이트) 실패하면 되돌아간다.
 * 장바구니는 브라우저에 둔 id로 찾으므로, 서버가 미리 렌더링한 HTML에는 수량이 없고 화면을 연 뒤에 채운다.
 */
export function ShopNav() {
  const pathname = usePathname()
  const cartId = useCartId()
  const { data: cart, error } = useQuery({ ...getCartQueryOptions(cartId ?? ''), ...currentCartQuery(cartId) })
  useForgetMissingCart(error)
  const quantity = typeof cartId === 'string' ? (cart?.totalQuantity ?? 0) : 0

  return (
    <nav aria-label="쇼핑몰 화면" className="border-b border-border px-4 pb-2">
      <ul className="flex gap-4">
        <li>
          <Link href={SHOP_PATH} aria-current={pathname === SHOP_PATH ? 'page' : undefined} className={LINK_CLASS_NAME}>
            상품
          </Link>
        </li>
        <li>
          {/* 수량은 배지로 보이고, 스크린 리더는 링크 이름(예: "장바구니 3개")으로 듣는다. 이름이 보이는 글자를 그대로 담도록
              aria-label 대신 링크의 내용으로 이름을 만든다. */}
          <Link href={CART_PATH} aria-current={pathname === CART_PATH ? 'page' : undefined} className={LINK_CLASS_NAME}>
            장바구니
            {quantity > 0 && (
              <>
                <span className="inline-flex min-w-6 items-center justify-center rounded-sm bg-primary px-1 text-sm text-primary-foreground">
                  {quantity}
                </span>
                <span className="sr-only">개</span>
              </>
            )}
          </Link>
        </li>
      </ul>
    </nav>
  )
}
