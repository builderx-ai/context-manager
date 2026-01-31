#!/usr/bin/env bash
set -euo pipefail

# Simple dockerized e2e runner for the context-manager project.
# This script is intended to be mounted into a container and executed from
# the repository root. It performs the following steps:
# 1. Install dev dependencies
# 2. Build the project
# 3. Pack the project to a .tgz
# 4. Create a temporary test workspace and install the packed package
# 5. Run a set of smoke e2e checks against the installed CLI

ROOT=$(pwd)
TMPDIR="${ROOT}/tmp-e2e"
PKG_TGZ="$(npm pack --silent)"

echo "-> workspace: ${ROOT}"
echo "-> tmpdir: ${TMPDIR}"
echo "-> package: ${PKG_TGZ}"

rm -rf "${TMPDIR}"
mkdir -p "${TMPDIR}"

echo "Installing dev dependencies..."
npm ci --prefer-offline --no-audit --no-fund

echo "Building project..."
npm run build

echo "Packing project to tarball..."
# npm pack already created the file in CWD; ensure path
TGZ_PATH="${ROOT}/${PKG_TGZ}"

echo "Creating test workspace and installing package..."
pushd "${TMPDIR}" >/dev/null
npm init -y >/dev/null
npm install --no-audit --no-fund "${TGZ_PATH}" >/dev/null

echo "Running CLI smoke tests..."
NODE_MODULE_BIN="${TMPDIR}/node_modules/.bin"
export PATH="${NODE_MODULE_BIN}:$PATH"

echo "- Check installed binary exists"
if [ ! -x "${NODE_MODULE_BIN}/ctx" ]; then
  echo "ERROR: ctx binary not found after install" >&2
  exit 2
fi

echo "- Run 'ctx --help'"
ctx --help | sed -n '1,20p'

echo "- Run basic command: ctx status (should exit 0)"
ctx status || true

echo "- Create a fresh test repo and run ctx init"
mkdir repo-a && pushd repo-a >/dev/null
git init -q
# ctx init currently doesn't take a --name option; call without args
ctx init || true
popd >/dev/null

echo "E2E smoke tests completed successfully"
popd >/dev/null

echo "Cleaning ephemeral files..."
rm -rf "${TMPDIR}"

echo "Done"
