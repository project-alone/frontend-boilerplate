// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/i18n/src/features/i18n-example/cart-counter.tsx

'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@/shared/ui/button'

/**
 * 클라이언트 컴포넌트의 번역 예: 담은 상품 수를 locale의 복수형 규칙으로 알린다(CartCounter.count). 메시지는 앱 전체를
 * 감싼 I18nProvider가 주소의 locale로 넘긴다.
 */
export function CartCounter() {
  const t = useTranslations('CartCounter')
  const [count, setCount] = useState(0)

  return (
    <div className="flex flex-col items-start gap-2">
      <p>{t('description')}</p>
      <p role="status">{t('count', { count })}</p>
      <Button
        onClick={() => {
          setCount((current) => current + 1)
        }}
      >
        {t('add')}
      </Button>
    </div>
  )
}
