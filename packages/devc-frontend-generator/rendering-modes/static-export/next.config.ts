import type { NextConfig } from 'next'

// Rendering Mode static-export: `npm run build`가 모든 페이지를 빌드할 때 렌더링해 out/에 정적 파일로만 내보낸다.
// 요청을 받는 Next.js 서버가 없으므로 요청 시점에 서버가 필요한 기능은 쓸 수 없다(README.md의 "실행과 배포").
const nextConfig: NextConfig = {
  output: 'export',
}

export default nextConfig
