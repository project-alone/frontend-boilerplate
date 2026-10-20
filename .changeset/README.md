# Changesets

이 디렉터리의 changeset 파일이 Generator(`devc-frontend-generator`)의 다음 버전과 CHANGELOG가 된다. Generator 사용자에게 보이는 변경을 담은 PR에는 changeset을 함께 커밋한다.

```sh
npm run changeset                                                          # 대화형
npm run changeset -- --minor devc-frontend-generator --message "<요약>"    # 바로 만들기
```

언제 더하는지, 버전을 어떻게 고르는지, 머지한 뒤 어떻게 배포되는지는 [docs/release.md](../docs/release.md)에 있다. 설정은 `config.json`이다(baseBranch `master`, Generator 말고는 모두 `private`이라 배포하지 않는다).
