#!/bin/bash
# 측정용 임시 스크립트(머지하지 않는다, #109): CI 러너에서 Starter의 npm install과 node_modules 복사에 걸리는 시간을 잰다.
set -euo pipefail
REPO=$PWD
W=$(mktemp -d "${RUNNER_TEMP:-/tmp}/dcgen-109-XXXXXX")
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_AUTHOR_NAME=h GIT_AUTHOR_EMAIL=h@example.com GIT_COMMITTER_NAME=h GIT_COMMITTER_EMAIL=h@example.com
df -T "$W" || true
(cd packages/devc-frontend-generator && npm run build >/dev/null)
TARBALL="$W/$(cd packages/devc-frontend-generator && npm pack --pack-destination "$W" --silent | tail -1)"
mkdir "$W/consumer"
(cd "$W/consumer" && echo '{"name":"c","private":true}' > package.json && npm install --no-audit --no-fund "$TARBALL" >/dev/null)
DCGEN="$W/consumer/node_modules/.bin/dcgen"

ms() { echo $(( $(date +%s%N) / 1000000 )); }
starter() { # name, dcgen args...
  local name=$1; shift
  mkdir "$W/$name"
  (cd "$W/$name" && "$DCGEN" new my-app "$@" --skip-install >/dev/null)
  node -e '
const fs=require("fs");const p=process.argv[1]+"/package.json";const j=JSON.parse(fs.readFileSync(p,"utf8"));
j.devDependencies["devc-frontend-generator"]="file:"+process.argv[2];fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n")' "$W/$name/my-app" "$TARBALL"
  local t=$(ms)
  (cd "$W/$name/my-app" && npm install --no-audit --no-fund >/dev/null 2>&1)
  echo "npm install $name: $(( $(ms) - t )) ms"
}
starter server1
starter static1 --rendering-mode static-export
starter server2
S="$W/server1/my-app/node_modules"
du -sh "$S"; find "$S" | wc -l
for i in 1 2 3; do
  t=$(ms); cp -R "$S" "$W/cp-R-$i"; echo "cp -R #$i: $(( $(ms) - t )) ms"
done
t=$(ms); cp -a "$S" "$W/cp-a"; echo "cp -a: $(( $(ms) - t )) ms"
t=$(ms); node -e 'require("fs").cpSync(process.argv[1],process.argv[2],{recursive:true,verbatimSymlinks:true})' "$S" "$W/cpsync"; echo "fs.cpSync: $(( $(ms) - t )) ms"
t=$(ms); (mkdir "$W/tar" && tar -C "$S" -cf - . | tar -C "$W/tar" -xf -); echo "tar pipe: $(( $(ms) - t )) ms"
t=$(ms); cp -R --reflink=auto "$S" "$W/reflink-auto"; echo "cp -R --reflink=auto: $(( $(ms) - t )) ms"
cp -R --reflink=always "$S/next/package.json" "$W/reflink-test.json" && echo "reflink supported" || echo "reflink not supported"
# 복사본이 원본을 가리키지 않는지(.bin 링크가 상대 경로로 남는지)
readlink "$W/cp-R-1/.bin/next"; readlink "$W/cpsync/.bin/next"
t=$(ms); rm -rf "$W/cp-R-2"; echo "rm -rf copy: $(( $(ms) - t )) ms"
