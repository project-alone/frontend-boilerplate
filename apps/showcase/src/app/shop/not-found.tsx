// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/app/shop/not-found.tsx

import Link from 'next/link'
import { SHOP_PATH } from '@/shared/shop/shop-routes'

// /shop 아래에서 없는 주소나 없는 상품·주문(예: /shop/products/<없는 id>의 notFound())을 찾을 때 보이는 화면.
// 쇼핑몰 안의 이동(layout.tsx)은 그대로 남는다.
export default function ShopNotFound() {
  return (
    <main className="flex flex-col items-start gap-4 p-4">
      <h1 className="text-lg font-semibold">찾는 화면이 없습니다</h1>
      <p>판매를 마친 상품이거나 주소가 바뀌었을 수 있습니다.</p>
      <Link href={SHOP_PATH} className="focus-ring rounded-sm underline underline-offset-4">
        상품 목록으로
      </Link>
    </main>
  )
}
