import type { Metadata } from 'next'
import { connection } from 'next/server'
import { CreateProductForm } from '@/features/product-admin/create-product-form'

export const metadata: Metadata = {
  title: '상품 등록',
}

// SSR: 요청마다 서버에서 렌더링한다. connection()을 기다리면 Next.js가 이 라우트를 빌드할 때 미리 렌더링하지 않는다.
// 화면은 Feature의 컴포넌트를 조합해 그린다(ADR-0005).
export default async function ProductsNewPage() {
  await connection()

  return (
    <main className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">상품 등록</h1>
      <CreateProductForm />
    </main>
  )
}
