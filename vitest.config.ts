import { configDefaults, defineConfig } from 'vitest/config'

const TEN_MINUTES = 10 * 60_000
const timeouts = { testTimeout: TEN_MINUTES, hookTimeout: TEN_MINUTES }

// docker Recipe의 이미지 검사. 이미지를 만들고 컨테이너를 띄울 때마다 Docker가 호스트에 네트워크 인터페이스를 만들고 지운다.
// Linux의 Chromium은 인터페이스나 주소가 바뀌면 진행 중인 요청을 net::ERR_NETWORK_CHANGED로 끊으므로, 그동안 다른 테스트
// 파일이 브라우저로 돌리던 Storybook 테스트와 E2E가 모듈을 불러오지 못하고 실패한다(#88). 그래서 이 파일은 다른 하네스
// 테스트가 모두 끝난 뒤에 따로 돌린다.
const DOCKER_IMAGE_TEST = 'harness/docker.test.ts'

export default defineConfig({
  test: {
    // Generator를 한 번만 팩해 두고, 그 값(provide)을 두 프로젝트가 함께 쓴다.
    globalSetup: ['harness/global-setup.ts'],
    projects: [
      {
        test: {
          name: 'harness',
          include: ['harness/**/*.test.ts'],
          // 시험용 Recipe(harness/fixtures)의 테스트는 Starter의 테스트다. 그 Recipe를 넣은 Starter가 실행한다.
          exclude: [...configDefaults.exclude, 'harness/fixtures/**', DOCKER_IMAGE_TEST],
          ...timeouts,
        },
      },
      {
        test: {
          name: 'docker',
          include: [DOCKER_IMAGE_TEST],
          // groupOrder가 큰 프로젝트는 작은 프로젝트의 테스트가 모두 끝난 뒤에 시작한다.
          sequence: { groupOrder: 1 },
          ...timeouts,
        },
      },
    ],
  },
})
