// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/multi-step-form/src/app/partners/apply/page.tsx

import type { Metadata } from 'next'
import { PartnerApplicationForm } from '@/features/partner-application/partner-application-form'

export const metadata: Metadata = {
  title: '입점 신청',
}

// multi-step-form Recipe: 세 단계로 나눠 입력받고 확인 단계에서 한 번에 보내는 입점 신청서. 페이지 뼈대(첫 단계)는 빌드할 때
// 미리 만들고, 단계와 입력한 값은 브라우저가 들고 있다가 신청할 때 한 번 보낸다. 그래서 두 Rendering Mode에서 같은 코드로
// 동작한다(server는 BFF 프록시, static-export는 백엔드를 직접 부른다).
export default function PartnerApplicationPage() {
  return (
    <main className="flex max-w-xl flex-col gap-6 p-4">
      <h1 className="text-lg font-semibold">입점 신청</h1>
      <PartnerApplicationForm />
    </main>
  )
}
