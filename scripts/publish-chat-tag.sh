#!/usr/bin/env bash
# Create git tag chat-v<version> from chat/package.json and push to origin
# to trigger .github/workflows/npm-publish.yml (npm publish on GitHub Actions).
#
# Usage:
#   ./scripts/publish-chat-tag.sh           # create + push tag
#   ./scripts/publish-chat-tag.sh --dry-run # print tag only
#
# Prerequisite: bump version in chat/package.json and commit before tagging.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CHAT_PKG="$REPO_ROOT/chat/package.json"

DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help)
      sed -n '1,12p' "$0" | tail -n +2
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f "$CHAT_PKG" ]]; then
  echo "error: missing $CHAT_PKG" >&2
  exit 1
fi

VERSION="$(node -p "require('$CHAT_PKG').version")"
if [[ -z "$VERSION" || "$VERSION" == "undefined" ]]; then
  echo "error: could not read version from chat/package.json" >&2
  exit 1
fi

TAG="chat-v${VERSION}"

if git -C "$REPO_ROOT" rev-parse "$TAG" >/dev/null 2>&1; then
  echo "error: tag $TAG already exists locally" >&2
  exit 1
fi

echo "chat/package.json version: $VERSION"
echo "git tag: $TAG"

if $DRY_RUN; then
  echo "(dry-run) would run: git tag $TAG && git push origin $TAG"
  exit 0
fi

git -C "$REPO_ROOT" tag "$TAG"
git -C "$REPO_ROOT" push origin "$TAG"

echo "Pushed $TAG — GitHub Actions should publish chat/ to npm."
