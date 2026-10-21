// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): archetypes/commerce/src/app/shop/loading.tsx

// /shop 아래 페이지의 로딩 상태. 페이지가 서버에서 데이터를 기다리는 동안과 이 페이지로 옮겨 가는 동안 페이지 대신 보인다.
// 쇼핑몰 안의 이동(layout.tsx)은 그대로 남는다.
export default function ShopLoading() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <p role="status">불러오는 중입니다.</p>
    </main>
  )
}
