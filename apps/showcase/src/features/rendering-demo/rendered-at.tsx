// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): recipes/route-rendering/src/features/rendering-demo/rendered-at.tsx

/**
 * 서버가 이 HTML을 렌더링한 시각을 보여 준다. 새로고침해도 시각이 그대로면 미리 렌더링해 둔 HTML을 받은 것이다.
 * 서버 컴포넌트에서만 쓴다. 클라이언트 컴포넌트에서 쓰면 브라우저가 다시 그리며 시각이 바뀐다.
 */
export function RenderedAt() {
  const renderedAt = new Date().toISOString()

  return (
    <p>
      이 HTML을 서버가 렌더링한 시각: <time dateTime={renderedAt}>{renderedAt}</time>
    </p>
  )
}
