// 생성된 Showcase 파일이니 직접 고치지 마세요. 원본을 고친 뒤 레포 최상위에서 npm run showcase로 다시 만듭니다.
// 원본(packages/devc-frontend-generator/): base/config/vitest.config.ts, recipes/i18n/config/vitest.config.ts.patch

import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

// 이 설정은 config/에 있으므로 npm 스크립트가 --config로 넘긴다. 경로는 Starter 최상위(root)를 기준으로 적는다.
const root = join(import.meta.dirname, '..')

export default defineConfig({
  root,
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    // 테스트를 종류마다 프로젝트로 나눈다. npm test는 unit 프로젝트만 실행한다.
    projects: [
      {
        extends: true,
        resolve: {
          alias: {
            // 서버 전용 모듈(import 'server-only')은 Next.js 밖에서 불러오면 오류를 던진다. 단위 테스트는 서버 모듈도 직접 불러
            // 시험하므로 빈 모듈로 바꾼다.
            'server-only': join(root, 'node_modules/server-only/empty.js'),
            // apiFetch가 서버에서 불러오는 모듈(package.json의 imports). Next.js는 서버 컴포넌트 쪽(react-server 조건)에서
            // api-fetch.server.ts를 고르지만 Vitest에는 그 조건이 없으므로 직접 정한다. window가 없는 테스트
            // (`// @vitest-environment node`)가 서버의 요청을 시험한다.
            '#api-fetch.server': join(root, 'src/shared/api/api-fetch.server.ts'),
          },
        },
        test: {
          name: 'unit',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['config/vitest.setup.ts'],
          // i18n Recipe: next-intl의 proxy(next-intl/middleware)는 next/server를 확장자 없이 import해 Node.js가 바로 불러오지
          // 못하므로 Vite가 변환해 불러오게 한다(src/shared/i18n/i18n-proxy.test.ts).
          server: { deps: { inline: ['next-intl'] } },
        },
      },
    ],
  },
})
