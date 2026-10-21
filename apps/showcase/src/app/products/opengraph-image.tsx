// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/app/products/opengraph-image.tsx

import { ogImage, ogImageMetadata } from '@/shared/seo/og-image'

// seo Recipe: 페이지별 공유 이미지의 예. 페이지 폴더에 opengraph-image.tsx를 두면 그 페이지(와 아래 페이지)는 사이트 기본
// 이미지(src/app/opengraph-image.tsx) 대신 이 이미지를 쓴다. 제목은 페이지의 title과 맞춘다(src/app/products/page.tsx).
const TITLE = '상품'

export const dynamic = 'force-static'

export const generateImageMetadata = () => ogImageMetadata(TITLE)

export default function Image() {
  return ogImage({ title: TITLE, description: '샘플 API에서 가져온 상품 목록' })
}
