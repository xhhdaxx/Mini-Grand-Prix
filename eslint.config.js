// ESLint flat config：ES module + 浏览器环境，宽松策略（warn 而非 error）。
// 目标是建立基线，让后续 PR 能在 CI 中发现明显问题，而非一次性重写所有代码。
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.worktrees/**',
      '.claude/**',
      '暑期实训DOC/**',
      'scripts/qr-svg.js',
      'scripts/gen-gamepad-icons.js'
    ]
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      }
    },
    rules: {
      // 宽松基线：用 warn 而非 error，避免阻塞现有代码
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-undef': 'error',
      'no-use-before-define': 'off',
      'no-inner-declarations': 'off',
      'prefer-const': 'warn',
      'eqeqeq': ['warn', 'smart'],
      'no-var': 'error',
      // 循环与递归深度等不强制
      'no-loop-func': 'off',
      'no-unused-private-class-members': 'warn'
    }
  },
  {
    // 测试脚本：允许顶层 await
    files: ['tests/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module'
    }
  }
];
