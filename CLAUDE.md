# CLAUDE.md

## 작업 규칙

- **용어와 결정**: 작업 전에 `GLOSSARY.md`와 고칠 영역의 ADR(`docs/adr/`)을 읽는다. 코드, 테스트 이름, 이슈, 커밋은 GLOSSARY의 용어로 쓰고, ADR과 다르게 가야 하면 어느 ADR과 왜 어긋나는지 밝힌다(`docs/agents/domain.md`).
- **작업 흐름**: 코드를 고치거나 커밋·PR·후속 이슈를 만들기 전에 `docs/agents/workflow.md`를 읽는다. 하네스 테스트, Showcase 재생성, changeset, 커밋·PR 형식이 있다.
- **공개 저장소**: 이 레포는 공개 저장소(MIT)다. 고객사 이름, 사내 URL·호스트처럼 고객을 알아볼 수 있는 정보는 코드, 문서, 이슈, 커밋 어디에도 쓰지 않고 `example.com` 같은 예시 이름을 쓴다. Starter로 만든 실제 프로젝트는 밖에서 닿지 않는 사내 GitLab에 있어 이 레포의 작업에서는 볼 수 없다.
- **설치 위치**: `npm install`·`npm ci`는 레포 최상위(npm workspaces)에서만 실행하고, Starter는 레포 밖(운영체제의 임시 디렉터리)에 만든다. Base, Showcase, Starter가 devDependency로 가진 lefthook은 `postinstall`에서 설치한 디렉터리를 감싼 git 저장소에 `lefthook install`을 실행한다. 그래서 레포 안의 하위 디렉터리(`apps/showcase`, Base 등)나 레포 안에 만든 Starter에서 설치하면 이 레포에 lefthook의 훅과 `lefthook.yml`이 생기고, 훅은 모든 워크트리가 함께 쓰는 `.git/hooks`에 놓인다. `dcgen new`도 Starter를 만든 뒤 곧바로 설치한다.
- **정리 범위**: 프로세스와 Docker 컨테이너·이미지는 자기가(또는 자기가 돌린 하네스가) 띄운 것만 PID나 이름으로 골라 멈추고 지운다. 다른 워크트리의 하네스가 함께 돌고 있을 수 있으므로 `pkill`, `killall`, `docker system prune`처럼 넓게 지우는 명령은 쓰지 않는다.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`project-alone/frontend-boilerplate`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
