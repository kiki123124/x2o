# x2o

> X (Twitter) Bookmarks → Obsidian Knowledge Vault, one click.
>
> X (Twitter) 书签 → Obsidian 知识库，一键搞定。

![macOS](https://img.shields.io/badge/macOS-10.15+-black?logo=apple)
![License](https://img.shields.io/badge/license-MIT-green)
![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8D8?logo=tauri)

Export your X (Twitter) bookmarks, classify them with 19+ AI providers (including local models via Ollama and API-free host mode for AI agents like Claude Code), and generate a structured Obsidian knowledge vault — all locally, no third-party servers.

---

## Features / 功能亮点

- **无需 API Key** — `--provider host` 让宿主 AI（Claude Code / OpenClaw）直接分类，零配置
- **一键抓取** — 粘贴浏览器 Cookie，自动拉取全部 X 书签
- **AI 智能分类** — 支持 19+ AI 服务商（含 host 模式），自动归类 + 生成中文摘要
- **Obsidian 知识库** — 按分类生成 Markdown 文件，直接用 Obsidian 打开
- **重新分类** — 选已有文件夹，换 AI 模型重新分类，不需要重新抓取
- **t.co 短链接解析** — 自动将 t.co 短链接还原为真实 URL
- **长推文完整抓取** — 支持 X Notes 长文，不截断不丢内容
- **隐私优先** — 数据全部本地处理，不经过第三方服务器
- **桌面 App + CLI** — 图形界面或命令行，随你选

---

## 安装

### CLI Skill（Claude Code / OpenClaw 用户）

**推荐安装方式：**

```bash
npx skills add kiki123124/x2o
```

安装后重启 Claude Code / OpenClaw，说"帮我导出 X 书签"即可触发。

**直接运行（不安装 skill）：**

```bash
# Host AI 分类（无需 API key，宿主 AI 直接分类）
npx tsx https://raw.githubusercontent.com/kiki123124/x2o/main/scripts/x2o.ts \
  --cookie "<你的 X Cookie>" \
  --provider host \
  --output ~/x2o-output

# 或使用外部 AI（需要 API key）
# --provider deepseek --api-key "sk-..."
# --provider openai   --api-key "sk-..."
# --provider claude   --api-key "sk-ant-..."
# --provider ollama   --model llama3.2  （本地，不需要 api-key）
```

### 桌面 App（macOS Apple Silicon）

从 [Releases](../../releases) 下载最新的 `.dmg` 文件，拖入 Applications 即可。

> 首次打开可能提示"无法验证开发者"，前往 **系统设置 → 隐私与安全性 → 仍要打开**

### 从源码构建

```bash
git clone https://github.com/kiki123124/x2o.git
cd x2o/apps/desktop
pnpm install
pnpm tauri build
```

---

## 使用方法

### 1. 获取 Cookie

1. 打开 [x.com](https://x.com) 并登录
2. 按 `F12` 打开 DevTools → **Network** 标签
3. 刷新页面，点击任意请求
4. 找到 **Request Headers** 中的 `Cookie` 字段，完整复制

### 2. 选择 AI 分类方式

| 方式 | 说明 | 需要 API Key |
|------|------|:---:|
| **Host AI** | 宿主 AI（Claude Code / OpenClaw）直接分类 | 否 |
| Ollama | 本地模型，完全免费 | 否 |
| DeepSeek | 便宜好用，国内直连 | 是 |
| OpenAI | GPT-4o-mini，性价比高 | 是 |
| Claude | Anthropic，分类质量高 | 是 |
| Gemini | Google，免费额度大 | 是 |
| ... | 还支持 OpenRouter / Moonshot / Qwen / SiliconFlow / Groq 等 19+ 服务商 | 是 |

### 3. 开始导出

**CLI（推荐 host 模式，无需 API key）：**
```bash
npx tsx x2o.ts --cookie "..." --provider host --output ~/vault
```

**重分类（已有书签，不重新抓取）：**
```bash
npx tsx x2o.ts --input ~/x2o-output --provider host --output ~/x2o-output
```

**从 Markdown Vault 重建再分类：**
```bash
npx tsx x2o.ts --md-dir ~/x2o-output --provider host --output ~/x2o-output
```

**桌面 App：**
1. 点击 **获取书签** → 预览抓取结果
2. 确认后点击 **开始 AI 分类**
3. 完成后点击 **Obsidian 打开** 或 **打开文件夹**

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | [SolidJS](https://solidjs.com) + [Tailwind CSS](https://tailwindcss.com) |
| 后端 | [Tauri 2](https://tauri.app) + Rust |
| HTTP | Rust `reqwest`（绕过 WebKit IPC 序列化瓶颈） |
| CLI | TypeScript + Node.js |

---

## 项目结构

```
apps/desktop/
├── src/                  # SolidJS 前端
│   ├── App.tsx           # 主界面
│   ├── lib/sync.ts       # 同步管线（fetch → classify → generate）
│   └── styles.css        # 主题样式
├── src-tauri/            # Rust 后端
│   └── src/lib.rs        # HTTP 请求 / 书签解析
scripts/
└── x2o.ts                # CLI 脚本
SKILL.md                  # Claude Code Skill 定义
```

---

## 贡献

欢迎 PR 和 Issue！

---

## License

[MIT](LICENSE)

---

<p align="center">
  用 ❤️ 和 🤖 构建 by <a href="https://github.com/kiki123124">@kiki123124</a>
</p>
