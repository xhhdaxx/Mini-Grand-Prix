# 📝 Mini Grand Prix · 博客宣传文章索引

这个目录存放用于**外部平台发布**的项目宣传文章草稿。每篇文章针对不同平台调性和读者画像定制。

## 📂 文章清单

| 文件 | 平台 | 定位 | 字数 | 适合读者 |
|:---|:---|:---|:---:|:---|
| [`blog-post-readme.md`](./blog-post-readme.md) | **掘金 / CSDN / 博客园** | 纯项目介绍（含技术增补段 + 展示增补段） | ~5500 字 | 第一次接触项目的人 |
| [`blog-post-csdn.md`](./blog-post-csdn.md) | CSDN（首选） | 开发故事 + 特色展示 + 互动引导 | ~8000 字 | CSDN 重故事性的读者 |
| [`blog-post-devto-juejin.md`](./blog-post-devto-juejin.md) | 掘金（首选）/ Dev.to | 技术复盘 + Claude Code + Codex 协作章节 | ~9000 字 | 掘金重技术的工程师 |

> 三篇文章定位**互补**，不是简单的复制粘贴。可以全部发布到不同平台，覆盖不同读者群。

---

## 🎯 选哪篇？快速决策

```
你的需求                                         →  推荐文件
─────────────────────────────────────────────────────────────
"我想一篇吃下三个平台"                          →  blog-post-readme.md
"我只想发 CSDN，要带开发故事"                   →  blog-post-csdn.md
"我只想发掘金，重技术深度"                      →  blog-post-devto-juejin.md
"我想发掘金 + CSDN，各发一篇"                   →  掘金用 devto-juejin，CSDN 用 csdn
"我想发博客园"                                  →  blog-post-readme.md（删掘金段）
"我想发英文版（Medium/Dev.to）"                 →  blog-post-devto-juejin.md（待翻译）
```

---

## 🖼️ 图片资源说明

### ✅ 无需上传（外链 GIF 直接显示）

所有 `https://github.com/xhhdaxx/Mini-Grand-Prix/releases/download/gameplay-v1/*.gif` 的 GIF 和 `*.mp4` 视频链接 —— **三个平台都支持外链**，可以直接保留 Markdown 原样。

### ⚠️ 需要手动上传到平台图床的本地图片

文章里引用了项目内的 7 张 PNG 截图（路径 `../../Web_Pictures_Material/CN/xxx.png`）。**发布到外部平台时需要：**

1. 用平台编辑器的"上传图片"功能，把图片传一遍
2. 把 Markdown 中的 `../../Web_Pictures_Material/CN/xxx.png` 替换为平台返回的 URL

每篇文章末尾的 **「发布提示」** 段落都列了完整的图片清单。

> 💡 **从 GitHub 直接预览 markdown**：本地相对路径 `../../Web_Pictures_Material/CN/...` 在 GitHub 上渲染时能正常显示。

---

## 📋 各平台发布前 checklist

每篇文章末尾的「发布提示」段落已经写了详细 checklist，简要版：

### 掘金
- [ ] 删除「CSDN / 博客园读者增补段」（仅 `blog-post-readme.md` 需要）
- [ ] 上传 7 张 PNG 到掘金图床
- [ ] 标签：`前端` `JavaScript` `Canvas` `游戏开发` `开源项目`
- [ ] 封面：`Web_Pictures_Material/CN/1-home.png`

### CSDN
- [ ] 删除「掘金读者增补段」（仅 `blog-post-readme.md` 需要）
- [ ] 上传 7 张 PNG 到 CSDN 图床
- [ ] 标签：`前端` `JavaScript` `HTML5` `Canvas` `游戏开发` `开源项目`
- [ ] 封面：`Web_Pictures_Material/CN/1-home.png`

### 博客园
- [ ] 同 CSDN 操作
- [ ] 额外注意：博客园 markdown 支持较基础，可能需要把 `<details>` 展开为普通段落，复杂 HTML 标签简化

---

## 🔗 项目主链接

| 入口 | 地址 |
|:---|:---|
| 🏠 GitHub 仓库 | <https://github.com/xhhdaxx/Mini-Grand-Prix> |
| 🎮 在线 Demo | <https://xhhdaxx.github.io/Mini-Grand-Prix/> |
| 🎬 完整实录视频 | <https://github.com/xhhdaxx/Mini-Grand-Prix/releases/tag/gameplay-v1> |
| 📧 联系作者 | [xhhdaxx@gmail.com](mailto:xhhdaxx@gmail.com) |

---

<div align="center">

<sub>📝 本目录的所有文章均按 [MIT License](../../LICENSE) 开源，欢迎转发、引用、改编（请保留作者署名）。</sub>

</div>
