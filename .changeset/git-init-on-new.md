---
"devc-frontend-generator": minor
---

`dcgen new`가 의존성을 설치하기 전에 Starter 디렉터리에 git 저장소를 만든다(`git init`). 지금까지는 git 저장소가 없는 상태에서 설치해 lefthook이 훅을 설치하지 못했고, 나중에 `git init`만 하고 커밋하면 pre-commit(변경 파일의 린트·포맷 검사와 타입 검사)과 commit-msg(Conventional Commits 검사)가 돌지 않았다. 이제 만든 직후의 첫 커밋부터 훅이 돈다. 첫 커밋은 만들지 않고, 기본 브랜치 이름은 사용자의 git 설정을 따른다. 이미 git 저장소 안(모노레포 등)에 만들면 새 저장소를 만들지 않는다.

`--skip-git`으로 저장소를 만들지 않을 수 있다. git 저장소 밖에서 `--skip-git`으로 만들었을 때와 git을 찾지 못했을 때(경고하고 Starter는 그대로 만든다)는 다음 단계 안내에 `git init` 뒤 `npx lefthook install`이 나오고, `--skip-install`과 함께 쓰면 `git init` 뒤 `npm install`이 훅까지 설치한다.

이미 만든 Starter에서 커밋 훅이 돌지 않으면 Starter의 git 저장소에서 `npx lefthook install`을 한 번 실행한다.
