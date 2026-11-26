#!/usr/bin/env bash
# Builds one ZIP per skill into dist/, for people who upload skills by hand (Customize > Skills), e.g. on the free plan.
# Each ZIP holds one folder named after the skill, with SKILL.md at its top.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist && mkdir -p dist
for manifest in plugins/*/.claude-plugin/plugin.json; do
  plugin=$(dirname "$(dirname "$manifest")")
  name=$(basename "$plugin")
  version=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$manifest")
  for skill in "$plugin"/skills/*/; do
    s=$(basename "$skill")
    (cd "$plugin/skills" && zip -qr "$OLDPWD/dist/$name-$s-$version.zip" "$s" -x '*.DS_Store' '*__pycache__*')
  done
  echo "$name $version"
done
ls dist
