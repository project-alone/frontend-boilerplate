# API 계층: OpenAPI가 원본이고, 재생성 계층과 Schematic 계층을 나눈다

백엔드는 별도 REST 서버이고 OpenAPI 명세를 원본으로 삼는다. 비즈니스 판단이 없는 계층(타입, fetch 함수, Zod 스키마, MSW 목)은 orval로 명세에서 매번 재생성해 직접 고치지 않으며, 판단이 들어가는 계층(쿼리·뮤테이션 훅, 폼, 페이지)은 Schematic으로 생성한 뒤 프로젝트가 직접 소유한다. orval은 TanStack Query 훅까지 생성할 수 있지만, 캐시 무효화·낙관적 업데이트 같은 결정을 넣을 자리가 없어지므로 훅 생성은 끈다. MSW 목은 Showcase와 개발·테스트용이며 실제 프로젝트에서는 실제 API로 대체된다. 인증처럼 서버가 꼭 필요한 부분만 Next.js Route Handler를 BFF로 쓴다.

## Considered Options

- **전부 재생성(orval 훅 포함)**: 늘 명세와 맞지만 훅을 손으로 고칠 수 없다.
- **전부 Schematic으로 생성**: 모두 직접 소유하지만 명세가 바뀌면 타입과 fetcher까지 손으로 맞춰야 한다.
- **Next.js가 BFF로 DB·내부 서비스에 직접 접근**, **GraphQL**, **BaaS**: 실제 프로젝트의 백엔드 구성과 맞지 않는다.
