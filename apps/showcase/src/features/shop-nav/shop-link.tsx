// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/features/shop-nav/shop-link.tsx

import Link from 'next/link'
import { SHOP_PATH } from '@/shared/shop/shop-routes'

/**
 * 모든 페이지 위의 머리글에 놓이는 쇼핑몰 링크(확장 지점 header). 장바구니의 수량은 쇼핑몰 안의 이동(ShopNav)이 보여 주므로,
 * 쇼핑몰 밖의 페이지는 장바구니를 불러오지 않는다.
 */
export function ShopLink() {
  return (
    <nav aria-label="쇼핑몰" className="flex items-center">
      <Link href={SHOP_PATH} className="focus-ring rounded-sm text-sm font-medium underline-offset-4 hover:underline">
        쇼핑
      </Link>
    </nav>
  )
}
