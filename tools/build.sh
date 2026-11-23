#!/bin/sh
# Renders every image the README uses, in both themes. Run from the repo root: sh tools/build.sh
set -e
for theme in light dark; do
  node tools/render.js hero "$theme" "assets/hero-$theme.png" 1600 3
  node tools/render.js foundation "$theme" "assets/foundation-$theme.png" 840 3
  node tools/render.js pipeline "$theme" "assets/pipeline-$theme.png" 840 3
  for icon in translate switch book watch subtitle camera; do
    node tools/render.js "$icon" "$theme" "assets/$icon-$theme.png" 264 3
  done
done
