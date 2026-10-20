# 캐시 정책(Query Domain)과 UI 조합(Feature)을 분리한다

실제 화면은 API와 1:1로 대응하지 않고 여러 도메인의 데이터를 섞어 쓰므로, 흔히 쓰는 "feature 하나에 쿼리와 UI를 함께 두는" 구조 대신 `src/queries/<domain>/`(쿼리 키, queryOptions, mutation 훅. UI 없음)과 `src/features/<feature>/`(UI 조합. 여러 Query Domain을 섞어 씀)를 나눈다. import는 `app → features → queries → shared/api/generated` 한 방향으로만 허용하고 ESLint로 강제한다. `app`이 `queries`를 직접 쓰는 것은 서버에서 prefetch할 때만 허용한다. 폴더 깊이는 `src/<layer>/<name>/<file>`을 넘지 않는다. 다만 `app`은 Next.js 라우트 구조가 폴더 깊이를 정하고, 재생성 API 계층(`shared/api/generated`)은 손으로 고치지 않고 생성 도구가 구조를 정하므로 둘 다 깊이 제한에서 뺀다.

## Consequences

- Query Domain마다 `<domain>.keys.ts`와 `<domain>.queries.ts` 한 쌍에 코드가 모이므로, `query`·`mutation` Schematic은 새 파일을 만드는 대신 기존 파일에 코드를 끼워 넣는다(AST 편집).
