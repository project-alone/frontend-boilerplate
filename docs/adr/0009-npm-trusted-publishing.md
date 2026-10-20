# Generator는 npm trusted publishing으로 배포하고, 처음 한 번만 사람이 자리 표시 버전을 배포한다

Generator는 GitHub Actions의 릴리스 워크플로(`release.yml`)가 npm trusted publishing(OIDC)으로 배포한다. 저장소에는 npm 토큰을 두지 않는다. 배포할 수 있는 곳이 이 저장소의 `release.yml`과 environment `npm`으로 묶이고, provenance가 저절로 붙으며, 바꿔 줄 비밀값이 없다. npm과 changesets 모두 CI 배포에 이 방식을 권한다. trusted publisher는 이미 레지스트리에 있는 패키지에만 설정할 수 있으므로, 처음 한 번은 사람이 자리 표시 버전 0.0.0을 배포해 패키지를 만든다(`docs/release.md`).

## Considered Options

- **npm 토큰(`NPM_TOKEN` 시크릿)**: 첫 배포부터 CI가 할 수 있지만, granular access token은 수명이 최대 90일이라 주기적으로 바꿔야 하고, 2FA를 건너뛰는 토큰은 2FA를 켠 패키지를 배포할 수 없게 바뀌고 있다. 토큰이 새면 어디서든 배포할 수 있다.
- **staged publishing(`npm stage publish`)**: 사람이 npmjs.com에서 승인해야 배포되어 더 안전하지만, changesets가 아직 지원하지 않는다. 배포 전 승인은 environment `npm`의 required reviewers로 대신할 수 있다.
- **진짜 Generator를 사람이 로컬에서 처음 배포**: 자리 표시 버전이 필요 없지만 첫 버전에 provenance가 없고, `publishConfig.provenance`를 끄고 배포해야 한다.

## Consequences

- 첫 배포 전에 사람이 할 일이 있다. 자리 표시 버전 배포, trusted publisher 설정(2일 안에 첫 배포가 성공해야 한다), Actions가 PR을 만들 수 있게 하는 저장소 설정이다.
- 로컬에서 Generator를 `npm publish`하면 provenance를 만들 수 없어 실패한다. 실수로 배포하는 일을 막는 효과도 있다.
- 자리 표시 버전 0.0.0이 레지스트리에 남는다. 첫 배포 뒤 폐기(deprecate)한다.
