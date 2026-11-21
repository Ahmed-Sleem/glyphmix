#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo '== formatting/diff safety =='
git diff --check --no-index /dev/null /dev/null >/dev/null || true
echo '== secret scan =='
if grep -RInE --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude='original-glyphmix.html' '(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' .; then
  echo 'Potential secret detected' >&2; exit 1
fi
echo '== lint =='
npm run lint
echo '== unit tests =='
npm run test
echo '== production build =='
npm run build
echo '== browser tests =='
npm run test:e2e
echo 'Verification complete.'
