#!/bin/zsh
set -eu
cd "$(dirname "$0")"

# Use the bundled Node runtime when available on this Mac.
bundled_node_dir="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
if [ -x "$bundled_node_dir/node" ]; then
  export PATH="$bundled_node_dir:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  print "Node.js 22.13 이상을 설치한 뒤 다시 실행해주세요."
  read -r "?Enter를 누르면 닫습니다."
  exit 1
fi
node --input-type=module -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 13)) { console.error("Node.js 22.13 이상이 필요합니다."); process.exit(1); }'

if [ ! -d node_modules ]; then
  npm ci
fi
print "칭찬핑을 실행합니다. 브라우저에서 http://localhost:5173 을 여세요."
npm run dev
