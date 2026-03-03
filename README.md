# 🏛️ x2o

> X (Twitter) 书签 → Obsidian 知识库，一键搞定。

![macOS](https://img.shields.io/badge/macOS-10.15+-black?logo=apple)
![License](https://img.shields.io/badge/license-MIT-green)
![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8D8?logo=tauri)

---

## ✨ 功能亮点

- 📥 **一键抓取** — 粘贴浏览器 Cookie，自动拉取全部 X 书签
- 🤖 **AI 智能分类** — 支持 18+ AI 服务商，自动归类 + 生成中文摘要
- 📚 **Obsidian 知识库** — 按分类生成 Markdown 文件，直接用 Obsidian 打开
- 🔒 **隐私优先** — 数据全部本地处理，不经过第三方服务器
- ⚡ **Rust 高性能** — 核心 HTTP 请求和 JSON 解析在 Rust 侧完成，不卡不爆内存
- 🖥️ **桌面 App + CLI** — 图形界面或命令行，随你选

---

## 📦 安装

### 桌面 App（macOS Apple Silicon）

从 [Releases](../../releases) 下载最新的 `.dmg` 文件，拖入 Applications 即可。

> ⚠️ 首次打开可能提示"无法验证开发者"，前往 **系统设置 → 隐私与安全性 → 仍要打开**

### CLI Skill（Claude Code / OpenClaw 用户）

**一键安装：**

```bash
# 克隆仓库并复制 skill
git clone https://github.com/kiki123124/x2o.git /tmp/x2o
mkdir -p ~/.claude/skills/x2o
cp -r /tmp/x2o/apps/desktop/skill/* ~/.claude/skills/x2o/
rm -rf /tmp/x2o
```

**或手动安装：**

```bash
# 1. 下载 skill 文件
mkdir -p ~/.claude/skills/x2o/scripts
curl -sL https://raw.githubusercontent.com/kiki123124/x2o/main/apps/desktop/skill/SKILL.md -o ~/.claude/skills/x2o/SKILL.md
curl -sL https://raw.githubusercontent.com/kiki123124/x2o/main/apps/desktop/skill/scripts/x2o.ts -o ~/.claude/skills/x2o/scripts/x2o.ts
```

安装后重启 Claude Code，说"帮我导出 X 书签"即可触发。

**OpenClaw 用户：**

```bash
# OpenClaw skills 目录
mkdir -p ~/.openclaw/skills/x2o/scripts
curl -sL https://raw.githubusercontent.com/kiki123124/x2o/main/apps/desktop/skill/SKILL.md -o ~/.openclaw/skills/x2o/SKILL.md
curl -sL https://raw.githubusercontent.com/kiki123124/x2o/main/apps/desktop/skill/scripts/x2o.ts -o ~/.openclaw/skills/x2o/scripts/x2o.ts
```

**直接运行（不安装 skill）：**

```bash
npx tsx ~/.claude/skills/x2o/scripts/x2o.ts \
  --cookie "<你的 X Cookie>" \
  --provider deepseek \
  --api-key "sk-..." \
  --output ~/x2o-output
```

### 从源码构建

```bash
git clone https://github.com/kiki123124/x2o.git
cd x2o/apps/desktop
pnpm install
pnpm tauri build
```

---

## 🚀 使用方法

### 1️⃣ 获取 Cookie 🍪

1. 打开 [x.com](https://x.com) 并登录
2. 按 `F12` 打开 DevTools → **Network** 标签
3. 刷新页面，点击任意请求
4. 找到 **Request Headers** 中的 `Cookie` 字段，完整复制

### 2️⃣ 配置 AI 服务商 🤖

| 服务商 | 说明 |
|--------|------|
| 🟢 OpenAI | GPT-4o-mini，性价比高 |
| 🔵 DeepSeek | 便宜好用，国内直连 |
| 🟡 Claude | Anthropic，分类质量高 |
| 🟣 Gemini | Google，免费额度大 |
| ⚪ Ollama | 本地模型，完全免费 |
| ... | 还支持 OpenRouter / Moonshot / Qwen / SiliconFlow / Groq 等 18+ 服务商 |

### 3️⃣ 开始导出 📚

**桌面 App：**
1. 点击 **获取书签** → 预览抓取结果
2. 确认后点击 **开始 AI 分类**
3. 完成后点击 **Obsidian 打开** 或 **打开文件夹**

**CLI：**
```bash
npx tsx x2o.ts --cookie "..." --provider deepseek --api-key "sk-..." --output ~/vault
```

---

## 🏗️ 技术栈

| 层 | 技术 |
|----|------|
| 🖼️ 前端 | [SolidJS](https://solidjs.com) + [Tailwind CSS](https://tailwindcss.com) |
| 🦀 后端 | [Tauri 2](https://tauri.app) + Rust |
| 📡 HTTP | Rust `reqwest`（绕过 WebKit IPC 序列化瓶颈） |
| 🎨 图标 | [@lobehub/icons](https://lobehub.com/icons) |
| 🔧 CLI | TypeScript + Node.js |

### 为什么用 Rust 做 HTTP？

Tauri 的 HTTP 插件通过 IPC 把响应体传回 WebView 时，会将字节数组序列化为 JSON 数字数组。一个 1MB 的响应会膨胀到 5-10MB 的 JSON，导致 WebKit 进程内存飙到 9GB+。x2o 把所有 HTTP 请求和 JSON 解析放在 Rust 侧完成，只将精简后的结构化数据传给前端。

---

## 🗂️ 项目结构

```
apps/desktop/
├── src/                  # SolidJS 前端
│   ├── App.tsx           # 主界面（侧边栏布局）
│   ├── lib/sync.ts       # 同步管线（fetch → classify → generate）
│   └── styles.css        # 主题样式
├── src-tauri/            # Rust 后端
│   └── src/lib.rs        # HTTP 请求 / 书签解析 / 文件读写
├── public/               # 静态资源（logo + AI 服务商图标）
└── skill/                # Claude Code Skill
    ├── SKILL.md
    └── scripts/x2o.ts
```

---

## 🤝 贡献

欢迎 PR 和 Issue！

- 🐛 Bug 反馈 → [New Issue](../../issues/new)
- 💡 功能建议 → [Discussions](../../discussions)

---

## 📄 License

[MIT](LICENSE)

---

<p align="center">
  用 ❤️ 和 🤖 构建 by <a href="https://github.com/kiki123124">@kiki123124</a>
</p>
