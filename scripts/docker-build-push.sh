#!/usr/bin/env bash
#
# Build the mdbrowse image for linux/amd64 and linux/arm64 and push it to the
# GitHub Container Registry as ghcr.io/geekitycom/mdbrowse.
#
# This runs by hand, not in CI: GitHub's runners are amd64 only and the server
# may be arm64, so buildx builds both here and pushes them as one manifest list.
#
# The version tag comes from package.json, which release-please bumps when its
# release pull request is merged. The usual order is: merge the release pull
# request, `git pull` on main, then run this. `latest` is pushed alongside the
# version, and so is a custom tag when one is given.
#
# Usage (from the repository root):
#
#   scripts/docker-build-push.sh [--dry-run | --check-only] [CUSTOM_TAG]
#   pnpm docker:build-push [CUSTOM_TAG]
#   pnpm docker:dry-run [CUSTOM_TAG]
set -euo pipefail

readonly IMAGE="ghcr.io/geekitycom/mdbrowse"
readonly REGISTRY="ghcr.io"
readonly PLATFORMS="linux/amd64,linux/arm64"
readonly BUILDER="multiplatform"
readonly DOCKERFILE="Dockerfile"
readonly VERSION_FILE="package.json"

log() {
  printf '\033[1m==> %s\033[0m\n' "$*"
}

fail() {
  printf '\033[31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<EOF
Usage: scripts/docker-build-push.sh [--dry-run | --check-only] [CUSTOM_TAG]

Build ${IMAGE} for ${PLATFORMS} and push it tagged with the version in
${VERSION_FILE}, latest, and CUSTOM_TAG when one is given.

Options:
  --dry-run     Print what would be built and pushed without doing any of it
  --check-only  Check Docker and the ${REGISTRY} login, then stop
  -h, --help    Show this help
EOF
}

mode=full
custom_tag=""

set_mode() {
  [[ "$mode" == full || "$mode" == "$1" ]] || fail "--dry-run and --check-only cannot be used together"
  mode="$1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage
      exit 0
      ;;
    --dry-run) set_mode dry-run ;;
    --check-only) set_mode check-only ;;
    # pnpm passes the -- in `pnpm docker:build-push -- beta` through.
    --) ;;
    -*)
      usage >&2
      fail "unknown option: $1"
      ;;
    *)
      [[ -z "$custom_tag" ]] || fail "only one custom tag may be given (got '$custom_tag' and '$1')"
      custom_tag="$1"
      ;;
  esac
  shift
done

if [[ -n "$custom_tag" && ! "$custom_tag" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]]; then
  fail "'${custom_tag}' is not a valid tag; use letters, digits, '_', '.' and '-'"
fi

root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
if [[ "$(pwd -P)" != "$root" || ! -f "$DOCKERFILE" || ! -f "$VERSION_FILE" ]]; then
  fail "run this from the repository root (${root}), for example with pnpm docker:build-push"
fi

version="$(node -p "require('./${VERSION_FILE}').version")"
tags=("${IMAGE}:${version}" "${IMAGE}:latest")
[[ -z "$custom_tag" ]] || tags+=("${IMAGE}:${custom_tag}")

print_tags() {
  local tag
  for tag in "${tags[@]}"; do
    echo "  ${tag}"
  done
}

if [[ "$mode" == dry-run ]]; then
  log "Dry run: nothing will be built or pushed"
  echo "Image:     ${IMAGE}"
  echo "Version:   ${version} (from ${VERSION_FILE})"
  echo "Platforms: ${PLATFORMS}"
  echo "Would build and push:"
  print_tags
  exit 0
fi

log "Checking Docker is running"
docker info >/dev/null 2>&1 || fail "Docker is not running; start it and try again"

# `docker login` writes the registry under "auths" in the docker config, even
# when a credential helper holds the secret itself.
log "Checking ${REGISTRY} login"
config="${DOCKER_CONFIG:-$HOME/.docker}/config.json"
if ! grep -q "\"${REGISTRY}\"" "$config" 2>/dev/null; then
  echo "Not logged in to ${REGISTRY}; running docker login ${REGISTRY}"
  echo "(use a GitHub personal access token with write:packages as the password)"
  docker login "$REGISTRY" || fail "could not log in to ${REGISTRY}; run 'docker login ${REGISTRY}' and try again"
fi

if [[ "$mode" == check-only ]]; then
  log "Preflight checks passed: ready to build and push:"
  print_tags
  exit 0
fi

if docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  log "Using buildx builder ${BUILDER}"
else
  log "Creating buildx builder ${BUILDER}"
  docker buildx create --name "$BUILDER" --driver docker-container >/dev/null
fi

tag_args=()
for tag in "${tags[@]}"; do
  tag_args+=(--tag "$tag")
done

log "Building and pushing ${PLATFORMS}"
docker buildx build \
  --builder "$BUILDER" \
  --platform "$PLATFORMS" \
  --file "$DOCKERFILE" \
  --pull \
  --no-cache \
  "${tag_args[@]}" \
  --push \
  . || fail "docker buildx build failed"

log "Pushed ${IMAGE} for ${PLATFORMS}:"
print_tags
echo "Confirm both platforms are in the manifest list with:"
echo "  docker buildx imagetools inspect ${IMAGE}:${version}"
