# 배포용 컨테이너 이미지. next.config.ts의 output: 'standalone'이 만든 서버(.next/standalone)만 담아 node_modules 없이 띄운다.
# 빌드 인자, 환경 변수, 목 이미지는 README의 "컨테이너 이미지(Docker)"에 있다.
#
#   docker build -t my-app .                                       # 배포용 이미지(목을 끈 빌드)
#   docker run -p 3000:3000 -e API_BASE_URL=https://<백엔드 주소> my-app
#
# 단계: deps(의존성 설치) → build(배포용 빌드) → runtime(실행). 로컬 확인용 목 이미지(mock)는 --target mock으로만 만든다.
# 비밀 값은 ARG나 ENV에 넣지 않는다. ARG와 ENV는 이미지 기록과 설정에 남는다. 실행할 때 넣는 비밀 값은 컨테이너의 환경 변수로,
# 빌드할 때 필요한 비밀 값(사내 npm 레지스트리 토큰 등)은 --secret으로 넘긴다.

# Node는 .nvmrc와 같은 메이저 버전의 이미지를 정확한 버전으로 고정한다. .nvmrc를 바꾸면 이 값도 함께 바꾼다.
ARG NODE_IMAGE=node:24.22.0-trixie-slim

FROM ${NODE_IMAGE} AS base
WORKDIR /app

# 의존성 설치. package.json과 package-lock.json이 그대로면 이 단계는 캐시를 쓴다. 빌드에 devDependencies(TypeScript,
# Tailwind CSS 등)가 필요하므로 모두 설치하고, 실행 이미지에는 standalone 서버가 쓰는 파일만 옮긴다.
FROM base AS deps
COPY package.json package-lock.json ./
# 사내 레지스트리처럼 인증이 필요하면 docker build --secret id=npmrc,src=$HOME/.npmrc로 .npmrc를 넘긴다.
# 이 RUN 동안에만 마운트되고 이미지에는 남지 않는다.
RUN --mount=type=cache,target=/root/.npm \
    --mount=type=secret,id=npmrc,target=/root/.npmrc \
    npm ci --no-audit --no-fund

FROM base AS source
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# standalone 서버는 public이 있으면 함께 내준다. 아직 public 파일이 없어도 아래 COPY가 실패하지 않게 만들어 둔다.
RUN mkdir -p public

# 배포용 빌드. MSW를 끄고(.env.production과 같은 값) 빌드할 때 데이터를 가져오는 페이지(SSG·ISR)는 API_BASE_URL의 백엔드를
# 부른다. 그런 페이지가 있는데 API_BASE_URL이 없으면 빌드가 무엇을 넣어야 하는지 알리며 실패한다(README의 "실행과 배포").
FROM source AS build
# 목 빌드는 미리 렌더링한 페이지에 목 응답이 담겨 배포할 수 없으므로, 배포용 이미지는 목을 켠 빌드를 거부한다.
ARG API_MOCKING=disabled
RUN if [ "$API_MOCKING" != disabled ]; then \
      echo "API_MOCKING=$API_MOCKING: 배포용 이미지는 목을 끈 빌드(API_MOCKING=disabled)만 만듭니다. 목 빌드에는 목 응답이 담겨 배포할 수 없습니다. 로컬에서 확인할 목 이미지는 docker build --target mock으로 만드세요(README의 \"컨테이너 이미지(Docker)\")." >&2; \
      exit 1; \
    fi
# 빌드할 때 SSG·ISR 페이지가 부를 백엔드 주소. 실행할 때의 주소는 컨테이너의 환경 변수 API_BASE_URL로 따로 넣는다.
ARG API_BASE_URL
# 브라우저가 BFF 프록시 대신 직접 부를 백엔드 주소. 브라우저 번들에 박히므로 비밀 값이 아니어야 한다.
ARG NEXT_PUBLIC_API_BASE_URL
RUN npm run build

# 로컬 확인용 목 빌드: docker build --target mock -t my-app:mock . 빌드와 서버의 API 요청을 MSW가 받는다. 배포하지 않는다.
FROM source AS mock-build
RUN API_MOCKING=enabled npm run build

# 실행 단계의 공통 설정. 빌드 도구와 소스 없이 standalone 서버, 정적 파일(.next/static), public만 담는다.
FROM base AS runner
ENV NODE_ENV=production
# standalone 서버(server.js)는 PORT와 HOSTNAME으로 포트와 주소를 정한다. 컨테이너 밖에서 들어오도록 모든 주소에서 받는다.
# 아래 HEALTHCHECK가 127.0.0.1로 부르므로 HOSTNAME은 바꾸지 않는다.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
# node 이미지에 있는 root가 아닌 사용자 node(uid 1000)로 실행한다. Kubernetes의 runAsNonRoot가 확인할 수 있도록 숫자로 적는다.
USER 1000:1000
# 상태 확인 주소(src/app/api/health/route.ts). slim 이미지에는 curl이 없어 Node의 fetch로 부른다.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/api/health`).then((response) => process.exit(response.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "server.js"]

FROM runner AS mock
LABEL org.opencontainers.image.description="목 이미지: API 요청을 MSW가 받는다. 로컬 확인용이며 배포하지 않는다."
ENV API_MOCKING=enabled
# 서버가 ISR 페이지와 데이터 캐시를 .next 아래에 다시 쓰므로 실행 사용자가 파일을 소유한다.
COPY --from=mock-build --chown=1000:1000 /app/.next/standalone ./
COPY --from=mock-build --chown=1000:1000 /app/.next/static ./.next/static
COPY --from=mock-build --chown=1000:1000 /app/public ./public

# 배포용 이미지. 마지막 단계라 --target 없이 빌드하면 이 이미지가 된다.
FROM runner AS runtime
COPY --from=build --chown=1000:1000 /app/.next/standalone ./
COPY --from=build --chown=1000:1000 /app/.next/static ./.next/static
COPY --from=build --chown=1000:1000 /app/public ./public
