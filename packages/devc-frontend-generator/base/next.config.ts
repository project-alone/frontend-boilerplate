import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 특정 배포 방식에 묶이지 않도록, 필요한 파일만 모아 Node로 바로 띄우는 서버(.next/standalone)를 함께 만든다.
  // `next start`로도 실행된다(README의 실행과 배포 참고).
  output: 'standalone',
}

export default nextConfig
