## 컨테이너 이미지(Docker)

`docker` Recipe로 넣었습니다. `Dockerfile`이 `standalone` 출력(`next.config.ts`의 `output: 'standalone'`)으로 Next.js 서버만 담은 이미지를 만듭니다. 배포 대상(Kubernetes, 사내 컨테이너 플랫폼 등)이 정해지면 이 이미지를 레지스트리에 올려 띄웁니다.

```sh
docker build -t my-app .                                              # 배포용 이미지(목을 끈 빌드)
docker run -p 3000:3000 -e API_BASE_URL=https://<백엔드 주소> my-app  # 실행할 때 백엔드 주소를 넣는다
curl http://localhost:3000/api/health                                 # {"status":"ok"}
```

- 단계: `deps`(`package.json`과 `package-lock.json`으로 `npm ci`. 두 파일이 그대로면 캐시를 씀) → `build`(배포용 빌드) → `runtime`(실행). 실행 이미지에는 빌드 도구와 소스 없이 `.next/standalone`, `.next/static`, `public`만 들어갑니다.
- 실행 사용자: node 이미지에 있는 `node`(uid 1000)입니다. Kubernetes의 `runAsNonRoot`가 root가 아닌지 확인할 수 있도록 `USER 1000:1000`처럼 숫자로 적었습니다. 서버가 ISR 페이지와 캐시를 `.next` 아래에 다시 쓰므로 앱 파일은 이 사용자가 소유합니다.
- Node: `ARG NODE_IMAGE`가 `.nvmrc`와 같은 메이저 버전의 이미지를 정확한 버전으로 고정합니다. `.nvmrc`를 바꾸면 함께 바꿉니다. 사내 레지스트리의 사본을 쓰려면 `--build-arg NODE_IMAGE=<레지스트리>/node:<버전>`으로 바꿉니다.
- 상태 확인: `GET /api/health`(`src/app/api/health/route.ts`)가 `{"status":"ok"}`를 캐시하지 않고 돌려줍니다. 이미지의 `HEALTHCHECK`가 30초마다 부르고, Kubernetes의 liveness·readiness probe에도 같은 주소를 씁니다. 백엔드를 부르지 않으므로 백엔드가 잠시 응답하지 않아도 컨테이너를 다시 시작하지 않습니다. `API_BASE_URL`이 빠진 서버는 모든 요청에 500으로 응답하므로 상태 확인도 실패합니다.
- 여러 컨테이너: ISR이 다시 렌더링한 페이지와 Next.js의 데이터 캐시는 컨테이너마다 따로 남습니다. 컨테이너를 여러 개 띄우면 공유 캐시(`next.config.ts`의 `cacheHandler`)를 배포 대상과 함께 정합니다.

### 빌드 인자와 환경 변수

| 이름                     | 넣는 곳                                                 | 값                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `API_BASE_URL`           | 실행(`docker run -e`), 빌드(`docker build --build-arg`) | 서버가 부르는 백엔드 주소. 실행할 때는 꼭 넣습니다. 빌드할 때는 데이터를 가져오는 SSG·ISR 페이지가 있을 때만 필요하고, 그런 페이지가 있는데 빠지면 빌드가 실패합니다.                                                                                  |
| `NEXT_PUBLIC_SITE_URL`   | 빌드(`--build-arg`)                                     | 사이트의 공개 주소(`seo` Recipe의 sitemap, robots.txt, canonical, 공유 이미지의 주소). `seo` Recipe를 넣었으면 꼭 넣고, 빠지면 빌드가 실패합니다. 페이지와 번들에 박히므로 바꾸면 이미지를 다시 만듭니다. 그 Recipe가 없으면 쓰이지 않습니다.          |
| `NEXT_PUBLIC_SENTRY_DSN` | 빌드(`--build-arg`)                                     | 브라우저가 오류를 보낼 Sentry DSN(`sentry` Recipe). 브라우저 번들에 박히므로 바꾸면 이미지를 다시 만들고, 빠지면 브라우저의 오류는 보내지 않습니다. 서버의 DSN `SENTRY_DSN`은 실행할 때(`docker run -e`) 넣습니다. 그 Recipe가 없으면 쓰이지 않습니다. |
| `API_MOCKING`            | 빌드(`--build-arg`)                                     | `disabled`(기본값)만 됩니다. 다른 값이면 빌드를 거부합니다(아래 "목 이미지").                                                                                                                                                                          |
| `NODE_IMAGE`             | 빌드(`--build-arg`)                                     | 기반 Node 이미지. 기본값은 `Dockerfile`에 고정한 버전입니다.                                                                                                                                                                                           |
| `PORT`                   | 실행(`docker run -e`)                                   | 서버의 포트(기본 `3000`). 서버는 `HOSTNAME=0.0.0.0`으로 모든 주소에서 받고, `HEALTHCHECK`가 `127.0.0.1`로 부르므로 `HOSTNAME`은 바꾸지 않습니다.                                                                                                       |

- 비밀 값은 `ARG`나 `ENV`로 이미지에 넣지 않습니다. 그 값은 이미지의 설정과 빌드 기록에 남습니다. 실행할 때 쓰는 비밀 값은 배포 환경이 컨테이너의 환경 변수로 넣고(Kubernetes Secret 등), 빌드할 때 필요한 비밀 값(사내 npm 레지스트리의 토큰 등)은 `docker build --secret id=npmrc,src=$HOME/.npmrc`로 넘깁니다. 이 파일은 `npm ci`를 실행하는 동안에만 마운트되고 이미지에는 남지 않습니다.
- `.dockerignore`가 `node_modules`, 빌드 결과, 로컬 환경 변수 파일(`.env*.local`), 프로젝트의 `.npmrc`(토큰이 있을 수 있음)를 빌드 컨텍스트에서 뺍니다. 로컬 파일을 받으면 `next build`가 그 값을 읽어 브라우저 번들(`NEXT_PUBLIC_*`)과 미리 렌더링한 페이지에 담을 수 있고, 빌드 단계의 층(빌드 캐시)에도 남기 때문입니다. standalone 출력은 커밋하는 `.env.production`을 이미지에 함께 복사하므로 그 파일에도 비밀 값을 적지 않습니다.

### 목 이미지

배포용 이미지는 목을 끈 빌드로만 만들고(위 "배포용 빌드와 목 빌드"), `--build-arg API_MOCKING=enabled`는 거부합니다. 백엔드 없이 컨테이너를 띄워 보려면 로컬에서 목 이미지를 따로 만듭니다.

```sh
docker build --target mock -t my-app:mock .
docker run -p 3000:3000 my-app:mock  # 빌드와 서버의 API 요청을 MSW가 받는다
```

목 이미지는 미리 렌더링한 페이지에 목 응답이 담기고 서버도 MSW로 응답하므로 레지스트리에 올리거나 배포하지 않습니다. 이미지의 `org.opencontainers.image.description` 라벨에도 목 이미지라고 적혀 있습니다.

### GitLab CI에서 이미지 만들기

`.gitlab-ci.yml`에는 이미지를 만드는 잡을 넣지 않았습니다. 이미지를 만들려면 privileged 러너(Docker-in-Docker)나 Buildah 같은 도구가 필요하고, 이미지를 올릴 레지스트리와 배포 방식은 아직 정하지 않았기 때문입니다. 정해지면 다음과 같은 잡을 더합니다. GitLab Container Registry에 올리는 예이고, 러너 설정은 GitLab 문서의 "Use Docker to build Docker images"를 따릅니다. Buildah로 만들 때는 `--format docker`를 붙입니다. 기본 형식(OCI)은 `HEALTHCHECK`를 담지 않습니다. `API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`(`seo` Recipe), `NEXT_PUBLIC_SENTRY_DSN`(`sentry` Recipe)은 CI/CD 변수로 넣습니다.

```yaml
docker:
  stage: build
  image: docker:29-cli
  services:
    - docker:29-dind
  variables:
    DOCKER_TLS_CERTDIR: /certs
  # 이 잡은 npm을 쓰지 않으므로 default의 npm 캐시를 끈다. default의 npm ci는 아래 before_script가 대신한다.
  cache: []
  before_script:
    - echo "$CI_REGISTRY_PASSWORD" | docker login --username "$CI_REGISTRY_USER" --password-stdin "$CI_REGISTRY"
  script:
    - docker build --build-arg API_BASE_URL="$API_BASE_URL" --build-arg NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" --build-arg NEXT_PUBLIC_SENTRY_DSN="$NEXT_PUBLIC_SENTRY_DSN" --tag "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA" .
    - docker push "$CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

### 테스트

- `e2e/health.spec.ts`: 빌드한 앱에서 상태 확인 주소가 캐시하지 않는 200 응답을 돌려준다.
- 이미지 자체(빌드, root가 아닌 사용자, `HEALTHCHECK`, 정적 파일과 `public`, 목을 켠 빌드의 거부, 목 이미지)는 Docker가 필요해 이 프로젝트의 스크립트로는 검사하지 않습니다. Generator를 배포하기 전에 Generator의 하네스가 같은 `Dockerfile`로 검사했습니다. `Dockerfile`을 고친 뒤에는 위의 `docker build`와 `docker run`으로 이미지를 만들어 띄우고 `/api/health`와 페이지가 응답하는지 확인합니다.
