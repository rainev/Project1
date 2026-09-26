#!/usr/bin/env bash
# Extract the framework's documentation from the vendored release into
# docs/reference/, which is committed so a fresh clone can read it before
# anything is installed.
#
# The directory is rebuilt wholesale, so nothing hand-written may live in it —
# the notice below is written here, by this script, for that reason.
set -euo pipefail

VERSION="$(cat .app-stack-version)"
TARBALL="vendor/app-stack-${VERSION}.tar.gz"

[ -f "$TARBALL" ] || { echo "no $TARBALL — check .app-stack-version"; exit 1; }

rm -rf docs/reference
mkdir -p docs/reference
tar xzf "$TARBALL" -C docs/reference --strip-components=2 "app-stack-${VERSION}/docs"

cat > docs/reference/README.md <<MD
# The App-Stack reference — generated

Extracted from \`vendor/app-stack-${VERSION}.tar.gz\` by \`bun run sync-reference\`. It describes the
framework version this app runs.

**Do not edit these files.** The next sync overwrites them, and an edit here cannot reach the
framework. A documentation error is a change in App-Stack and a new release.

| | |
|---|---|
| [\`stack/17-capabilities.md\`](stack/17-capabilities.md) | What the framework does, indexed by need — and what it does not |
| [\`stack/16-building-a-feature.md\`](stack/16-building-a-feature.md) | One feature across every layer, in the order you work |
| [\`stack/\`](stack/) | One document per layer: mechanism, contract, config, failure modes, verification |
| [\`learnings/\`](learnings/) | The traps that bite an app author |
MD

echo "docs/reference/ ← app-stack ${VERSION}"
