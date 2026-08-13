#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"
echo "Project directory: $PROJECT_DIR"

export NODE_ENV=production

# 平台基础设施守卫（禁止 AI 误删 inspector 中间件）
bash "$SCRIPT_DIR/check-inspector.sh"

echo "Installing dependencies..."
CI=true pnpm install

# [前端构建] 如需前端框架构建，在此处添加命令，产物输出至 public/
# 示例: pnpm --filter client build && cp -r client/dist/* public/

echo "Building server (TypeScript)..."
pnpm build

echo "Build completed successfully!"
