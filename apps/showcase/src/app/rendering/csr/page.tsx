// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/route-rendering/src/app/rendering/csr/page.tsx

import type { Metadata } from 'next'
import { BrowserProductList } from '@/features/rendering-demo/browser-product-list'
import { DemoPage } from '@/features/rendering-demo/demo-page'

export const metadata: Metadata = {
  title: 'CSR · 라우트별 Rendering Mode',
}

// CSR: 페이지 뼈대는 빌드할 때 미리 렌더링하고(SSG), 데이터는 브라우저가 클라이언트 컴포넌트에서 가져온다.
export default function CsrPage() {
  return (
    <DemoPage title="CSR">
      <p>
        서버는 데이터 없이 미리 렌더링한 HTML(불러오는 중 상태)을 보내고, 브라우저가 BFF 프록시(
        <code>/api/proxy</code>)로 상품 목록을 가져와 그립니다. 서버가 보낸 HTML에는 상품 이름이 없습니다. 클라이언트
        컴포넌트에서 <code>useQuery</code>로 가져옵니다. 사용자마다 다르고 검색 노출이 필요 없는 화면이나 브라우저에서
        자주 다시 가져오는 데이터에 씁니다. 첫 화면에 데이터가 바로 보여야 하면 <code>/products</code>처럼 서버에서 미리
        가져와 넘깁니다.
      </p>
      <BrowserProductList />
    </DemoPage>
  )
}
