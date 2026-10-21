// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/seo/src/app/opengraph-image.tsx

import { ogImage, ogImageMetadata } from '@/shared/seo/og-image'
import { SITE_DESCRIPTION, SITE_NAME } from '@/shared/seo/site'

// seo Recipe: 사이트의 기본 공유 이미지. 자기 폴더나 위 폴더에 opengraph-image.tsx가 없는 페이지(홈 포함)는 모두 이 이미지를
// 쓴다. 빌드할 때 한 번 만들어 두므로 Rendering Mode static-export에서도 정적 파일(out/opengraph-image/image.png)이 된다.
export const dynamic = 'force-static'

export const generateImageMetadata = () => ogImageMetadata(SITE_NAME)

export default function Image() {
  return ogImage({ title: SITE_NAME, description: SITE_DESCRIPTION })
}
