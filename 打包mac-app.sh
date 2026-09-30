#!/bin/bash
# 一键打包 macOS 原生 App
cd "$(dirname "$0")"

./tools/mac_app/build_app.sh "$@"
