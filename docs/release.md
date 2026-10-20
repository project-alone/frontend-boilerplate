# 릴리스와 배포

npm에 배포하는 패키지는 Generator(`packages/devc-frontend-generator`, npm 이름 `devc-frontend-generator`) 하나다. 버전과 CHANGELOG는 [changesets](https://changesets.dev)로 관리하고, `master`에 머지되면 GitHub Actions(`.github/workflows/release.yml`)가 공개 npm 레지스트리에 provenance와 함께 배포한다. 배포 인증은 npm trusted publishing(OIDC)이 맡으므로 저장소에 npm 토큰을 두지 않는다([ADR-0009](adr/0009-npm-trusted-publishing.md)).

루트 패키지와 그 밖의 워크스페이스 패키지(예: Showcase 앱)는 배포하지 않는다. changesets는 `"private": true`가 아닌 워크스페이스 패키지를 모두 배포하므로, 워크스페이스에 패키지를 더할 때는 `package.json`에 `"private": true`를 적는다.

## changeset 더하기

Generator 사용자에게 보이는 변경에는 changeset을 더한다. `packages/devc-frontend-generator` 아래(CLI 코드, Base, Rendering Mode, Recipe, Schematic, 의존성)를 고쳐 `dcgen`의 동작이나 만들어지는 Starter가 달라지는 경우다. 하네스, 레포 문서(`docs/`, ADR), 레포 CI만 바꾸는 PR에는 필요 없다.

```sh
npm run changeset                                                              # 패키지, 버전 종류, 요약을 차례로 묻는다
npm run changeset -- --patch devc-frontend-generator --message "<요약>"        # 묻지 않고 바로 만든다
```

생긴 `.changeset/<이름>.md`를 PR에 함께 커밋한다. 파일 이름은 아무렇게나 지어도 되고, 한 PR에 여러 개를 둬도 된다. 머지되기 전에는 파일을 직접 고쳐 요약이나 버전 종류를 바꿀 수 있다.

```md
---
"devc-frontend-generator": minor
---

`dcgen g mutation` Schematic을 더한다.
```

- 버전 종류: 고친 것은 `patch`, 새 Recipe·Schematic·옵션처럼 더한 것은 `minor`다. 0.x 동안은 기존 옵션을 바꾸거나 빼는 깨지는 변경도 `minor`로 올리고 요약에 그 사실을 적는다. `major`는 버전을 1.0.0으로 올리므로 1.0.0을 내기로 정했을 때만 쓴다.
- 요약: CHANGELOG에 그대로 실린다. Generator 사용자가 읽을 문장으로 쓴다.
- Starter는 Generator를 정확한 버전으로 고정하므로, 이미 만든 Starter는 새 버전을 저절로 받지 않는다.

## 배포 흐름

`release.yml`은 `master`에 push될 때마다 돌고, changesets가 상태를 보고 할 일을 고른다(`select-mode`).

1. **Version PR**: `.changeset/`에 changeset이 쌓여 있으면 `npm run release:version`(`changeset version`과 `package-lock.json` 맞추기)으로 Generator의 `package.json` 버전과 `CHANGELOG.md`를 올리고 changeset 파일을 지운 커밋을 만들어, `changeset-release/master` 브랜치의 PR(`chore: release devc-frontend-generator`)을 열거나 갱신한다. 그 뒤에 머지된 changeset도 같은 PR에 더해진다.
2. **배포**: Version PR을 머지하면 changeset이 없고 Generator의 버전이 npm에 아직 없으므로 배포한다.
   - `verify`: CI 워크플로(`ci.yml`)를 그대로 불러 타입 검사와 하네스를 다시 통과해야 다음으로 넘어간다.
   - `pack`: 빌드한 뒤 `changeset pack`으로 tarball을 만든다.
   - `publish`: environment `npm`에서 trusted publishing으로 배포한다. provenance는 trusted publishing이 저절로 붙인다(`publishConfig.provenance`도 켜 두었다). git 태그 `devc-frontend-generator@<버전>`과 GitHub Release도 만든다.
3. 배포된 Generator로 만든 Starter는 그 버전을 `devDependencies`에 고정한다. Generator는 고정할 버전을 자기 `package.json`에서 읽으므로 배포된 버전과 같다. `harness/release.test.ts`가 changeset 더하기 → `changeset version` → npm pack → 레지스트리 → `dcgen new`로 이어지는 흐름에서 이를 확인한다.

changeset이 없고 npm에 없는 버전도 없으면 아무것도 하지 않는다.

Version PR은 Actions의 `GITHUB_TOKEN`으로 만들어지므로 그 PR에서는 CI가 저절로 돌지 않는다(GitHub의 제약). 배포 직전에 `verify`가 같은 검사를 하므로 검사를 통과하지 못한 버전이 배포되지는 않는다. Version PR에서 CI 결과를 보려면 PR을 닫았다가 다시 연다. Actions가 그 뒤에 Version PR을 고치면(새 changeset이 머지되면) 다시 CI 없는 커밋이 되므로, 머지하기 직전에 한 번 더 닫았다 연다. 매번 자동으로 돌게 하려면 [GitHub App 토큰을 version 잡의 `github-token`으로 넘긴다](https://changesets.dev/guide/automating#run-github-actions-for-version-prs).

로컬에서 Generator를 `npm publish`하지 않는다. `publishConfig.provenance`가 켜져 있어 CI 밖에서는 provenance를 만들 수 없다며 실패한다. 배포할 내용을 확인할 때는 `packages/devc-frontend-generator`에서 `npm pack --dry-run`이나 `npm publish --dry-run`을 쓴다.

## 사람이 해야 하는 설정

아래는 저장소와 npm 계정의 권한이 필요해 사람이 한 번 해야 한다. 1~4는 이 설정을 담은 PR을 머지하기 전후 언제든 할 수 있고, 5는 첫 Version PR을 머지하기 직전에 한다.

### 1. GitHub: Actions가 PR을 만들 수 있게 하기

Settings → Actions → General → Workflow permissions에서 **Allow GitHub Actions to create and approve pull requests**를 켠다. 꺼져 있으면 version 잡이 `GitHub Actions is not permitted to create or approve pull requests`로 실패한다. 켠 뒤 실패한 Release 실행을 다시 돌리면 된다.

### 2. GitHub: `npm` environment와 브랜치 보호

- Settings → Environments → **New environment** `npm`(첫 Release 실행 때 저절로 생기지만 미리 만들어 규칙을 건다). Deployment branches and tags를 **Selected branches and tags**로 바꾸고 `master`만 허락한다. 배포 전에 사람의 승인을 받으려면 Required reviewers에 메인테이너를 넣는다.
- Settings → Rules(또는 Branches)에서 `master`에 PR 필수, force push 금지, 필수 status check `Typecheck and harness`를 건다. Version PR은 위에 적은 대로 CI가 저절로 돌지 않으므로, 필수 status check를 걸었다면 머지하기 직전에 PR을 닫았다 다시 열어 CI를 돌린 뒤 머지한다.
- 선택: [Changesets bot](https://github.com/apps/changeset-bot)을 저장소에 설치하면 PR마다 changeset이 있는지 댓글로 알려 준다.

### 3. npm: 계정과 2FA

npmjs.com 계정에 2FA를 켠다(trusted publisher 설정에 필요하다). 처음 배포한 계정이 패키지 소유자가 된다. 여러 사람이 관리하려면 npm organization의 팀에 패키지를 붙이거나 `npm owner add <사용자> devc-frontend-generator`로 소유자를 더한다.

### 4. npm: 자리 표시 버전으로 패키지 만들기

trusted publisher는 이미 레지스트리에 있는 패키지에만 설정할 수 있다. 그래서 처음 한 번은 레포 밖의 빈 디렉터리에서 자리 표시 버전 0.0.0을 사람이 배포한다.

```sh
mkdir devc-frontend-generator-placeholder && cd devc-frontend-generator-placeholder
cat > package.json <<'EOF'
{
  "name": "devc-frontend-generator",
  "version": "0.0.0",
  "description": "자리 표시용 버전입니다. 0.1.0 이상을 쓰세요.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/project-alone/frontend-boilerplate.git",
    "directory": "packages/devc-frontend-generator"
  }
}
EOF
npm login
npm publish --access public   # 2FA 코드를 묻는다
```

레포의 Generator도 버전이 0.0.0이지만, changesets는 레지스트리에 이미 있는 버전을 다시 배포하지 않고, 첫 changeset(`.changeset/first-public-release.md`)이 버전을 0.1.0으로 올린다.

### 5. npm: trusted publisher 설정

새 trusted publisher 설정은 2일 안에 첫 배포에 성공하지 않으면 만료된다. 그래서 첫 Version PR을 머지하기 직전에 설정한다.

npmjs.com → `devc-frontend-generator` → Settings → **Trusted Publisher** → GitHub Actions에 다음을 적는다. 모든 칸은 대소문자까지 정확해야 한다.

| 칸                     | 값                                                                               |
| ---------------------- | -------------------------------------------------------------------------------- |
| Organization or user   | `project-alone`                                                                  |
| Repository             | `frontend-boilerplate`                                                           |
| Workflow filename      | `release.yml`                                                                    |
| Environment name       | `npm`                                                                            |
| Allowed actions        | `npm publish`도 허락한다(changesets는 staged publishing을 지원하지 않는다)       |

npm 11.15.0 이상이면 CLI로도 설정할 수 있다.

```sh
npm trust github devc-frontend-generator --repo project-alone/frontend-boilerplate --file release.yml --env npm --allow-publish
```

npm은 저장할 때 설정을 검사하지 않고 배포할 때 오류를 낸다. Generator의 `package.json` `repository.url`은 GitHub 저장소와 정확히 같아야 하므로 바꾸지 않는다.

### 6. 첫 배포 확인과 마무리

1. 첫 Version PR(0.1.0)을 머지하고 Actions의 Release 실행이 끝나는지 본다.
2. npmjs.com의 패키지 페이지에 0.1.0과 provenance가 보이는지 확인한다. Starter 안에서 `npm audit signatures`로도 확인할 수 있다.
3. npmjs.com → 패키지 Settings → Publishing access에서 **Require two-factor authentication and disallow tokens**를 고른다. trusted publishing에는 영향이 없고 토큰으로는 더 이상 배포할 수 없게 된다.
4. 자리 표시 버전을 폐기한다: `npm deprecate devc-frontend-generator@0.0.0 "자리 표시용 버전입니다. 0.1.0 이상을 쓰세요."`

배포가 `ENEEDAUTH`, `E404`, `E403`으로 실패하면 5의 칸(특히 workflow 파일 이름과 environment), Allowed actions, 2일 만료를 먼저 확인한다. 설정은 고칠 수 없으므로 지우고 다시 만든다.

## 첫 배포 전 `dcgen new`의 설치 실패(E404)

Starter는 Generator를 정확한 버전으로 고정하고, `dcgen new`는 Starter를 만든 뒤 바로 `npm install`을 한다. 그 버전이 npm에 없으면 `npm install`이 `E404`로 실패한다. Starter는 지우지 않고, 설치를 다시 하라고 안내한 뒤 종료 코드 1로 끝난다.

첫 배포 전에는 레포 소스로 만든 Generator가 이렇게 된다. 자리 표시 버전 0.0.0을 배포한 뒤에는 설치는 되지만 자리 표시 패키지가 설치되어 `npm run g`가 동작하지 않는다. 첫 배포 뒤 npm에서 받은 Generator는 자기 버전이 늘 npm에 있으므로 사용자에게는 생기지 않는다.

그래서 Generator는 고치지 않는다. 레포 소스로 Starter를 만들어 볼 때는 `--skip-install`을 쓰고, 하네스는 Generator tarball을 배포된 것처럼 내주는 레지스트리(`harness/registry.ts`)로 설치한다. npm에 없으면 다른 곳에서 설치하는 식의 우회를 Generator에 넣으면 Starter가 레지스트리의 정확한 버전을 고정한다는 보장이 흐려진다.
