#!/bin/bash
# ============================================================================
# 平台基础设施守卫 — 校验 tbox 微调（Inspector）注入未被破坏。
# 由 build.sh 自动调用。AI agent 修改代码时如果误删平台能力，构建会在此失败。
# 如确需禁用，请由人类工程师手动移除本脚本及 build.sh 中的调用。
# ============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

INSPECTOR_FILE="$PROJECT_DIR/src/middlewares/inspector.ts"
INDEX_FILE="$PROJECT_DIR/src/index.ts"

fail() {
  echo ""
  echo "❌ [check-inspector] 平台基础设施校验失败：$1"
  echo ""
  echo "   tbox 平台微调能力（点选元素 → 写入聊天框）是平台基础设施。"
  echo "   AI agent 不得删除或修改 inspector 中间件相关代码。"
  echo "   请恢复以下内容后重新构建："
  echo "     1. src/middlewares/inspector.ts 必须存在并导出 installInspector"
  echo "     2. src/index.ts 必须 import 并调用 installInspector(app)"
  echo "   参考 AGENTS.md「平台基础设施（禁止修改）」章节。"
  echo ""
  exit 1
}

# 1. inspector.ts 必须存在
[ -f "$INSPECTOR_FILE" ] || fail "缺失文件 src/middlewares/inspector.ts"

# 2. inspector.ts 必须导出 installInspector
grep -qE "export\s+(async\s+)?function\s+installInspector" "$INSPECTOR_FILE" \
  || fail "src/middlewares/inspector.ts 未导出 installInspector"

# 3. inspector.ts 必须保留 RUNTIME_PATH 常量（前后端约定路径）
grep -qE "RUNTIME_PATH\s*=\s*['\"]/__vs_inspector__\.js['\"]" "$INSPECTOR_FILE" \
  || fail "src/middlewares/inspector.ts 中 RUNTIME_PATH 被改动（必须为 /__vs_inspector__.js）"

# 4. index.ts 必须 import installInspector
grep -qE "import\s+\{[^}]*installInspector[^}]*\}\s+from\s+['\"]\./middlewares/inspector['\"]" "$INDEX_FILE" \
  || fail "src/index.ts 未 import installInspector"

# 5. index.ts 必须调用 installInspector(app[, ...])
#    兼容单参数 installInspector(app) 与多参数 installInspector(app, PUBLIC_DIR) 形式
grep -qE "installInspector\s*\(\s*app\s*[,)]" "$INDEX_FILE" \
  || fail "src/index.ts 未调用 installInspector(app)"

echo "✅ [check-inspector] 平台基础设施校验通过"
