// 앱 수준의 로딩 상태. 페이지가 서버에서 데이터를 기다리는 동안과 이 페이지로 옮겨 가는 동안 페이지 대신 보이고, 루트 레이아웃
// (머리글)은 그대로 남는다. 라우트에 loading.tsx가 있으면(npm run g -- page가 만든 로딩 상태 등) 그 라우트에서는 그쪽이 보인다.
// 요청마다 렌더링하는 페이지는 이 로딩 상태를 먼저 보내므로(스트리밍), 그 뒤에 난 오류와 notFound()는 상태 코드 대신 화면으로
// 알린다(README의 "오류·로딩·404 화면").
export default function AppLoading() {
  return (
    <main className="flex flex-col gap-4 p-4">
      <p role="status">불러오는 중입니다.</p>
    </main>
  )
}
