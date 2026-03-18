---
name: x2o
description: |
  Export X (Twitter) bookmarks, classify them with AI, and generate an Obsidian knowledge vault.

  USE FOR:
  - Exporting X/Twitter bookmarks to local files
  - AI-powered bookmark classification and summarization
  - Generating Obsidian-compatible markdown knowledge bases
  - Batch processing bookmarks from JSON exports
  - Resolving t.co short URLs to real URLs
  - Fetching full content from X Notes (long-form tweets)
  - Reclassifying existing markdown vaults with a different AI

  TRIGGERS:
  - "导出书签", "export bookmarks", "X 书签", "x2o", "书签分类"
  - "twitter bookmarks", "obsidian vault from bookmarks"
  - "classify my bookmarks", "organize bookmarks"
version: 0.5.0
---

# x2o — X Bookmark Export + AI Classification

Export X (Twitter) bookmarks → AI classify → Obsidian knowledge vault. All local, no third-party servers.

### What's New (v0.5.0)
- **Host AI classification**: use `--provider host` — no API key needed, the host AI (Claude Code / OpenClaw) classifies bookmarks directly
- Standalone reclassify: pick existing output folder, reclassify with different AI
- t.co short URLs automatically resolved to real URLs
- X Notes (long-form tweets) full content extraction

## Usage

### Host AI Classification (no API key needed)

The host AI (Claude Code, OpenClaw, etc.) can classify bookmarks directly — no external API key required:

```bash
npx tsx ~/.claude/skills/x2o/scripts/x2o.ts \
  --cookie "<X cookie string>" \
  --provider host \
  --output ~/x2o-output \
  --limit 100
```

This fetches bookmarks and saves `bookmarks.json`. The host AI then reads the bookmarks, classifies them, and generates the Obsidian vault.

### External AI Provider (with API key)

```bash
npx tsx ~/.claude/skills/x2o/scripts/x2o.ts \
  --cookie "<X cookie string>" \
  --provider openai \
  --api-key "sk-..." \
  --output ~/x2o-output \
  --limit 100

# Other providers:
# --provider claude  --api-key "sk-ant-..."
# --provider deepseek --api-key "sk-..."
# --provider gemini  --api-key "..."
# --provider ollama  --model llama3.2   (local, no api-key needed)
```

### Re-classify existing bookmarks (skip fetching):

```bash
npx tsx ~/.claude/skills/x2o/scripts/x2o.ts \
  --input ~/x2o-output \
  --provider host \
  --output ~/x2o-output
```

### Rebuild from Markdown vault and re-classify:

```bash
npx tsx ~/.claude/skills/x2o/scripts/x2o.ts \
  --md-dir ~/x2o-output \
  --provider host \
  --output ~/x2o-output
```

## Parameters

| Flag | Required | Description |
|------|----------|-------------|
| `--cookie` | Yes* | X browser cookie (must contain `ct0`) |
| `--input` | Yes* | Path to existing bookmarks JSON or output folder (alternative to cookie) |
| `--reclassify` | No | Alias of `--input` |
| `--md-dir` | No | Path to a Markdown vault folder |
| `--provider` | No | AI provider: `host` (no API key), `openai`, `claude`, `deepseek`, `gemini`, `ollama`, `groq`, `moonshot`, `qwen`, `zhipu`, `siliconflow`, `mistral`, `together`, `fireworks`, `xai`, `openrouter`, `cohere`, `deepinfra`, `perplexity` |
| `--api-key` | No** | API key for the chosen provider |
| `--output` | No | Output directory (default: `~/x2o-output`) |
| `--limit` | No | Max bookmarks to fetch (default: 800) |
| `--model` | No | Override default model for the provider |
| `--base-url` | No | Override API base URL |
| `--fetch-only` | No | Only fetch bookmarks, skip classification |

\* One of `--cookie` or `--input` is required
\** Not required for `host` (uses host AI) or `ollama` (local)

## Workflow for Claude

When user wants to export bookmarks:

1. Ask for their X cookie (guide them: F12 → Network → find any request → copy Cookie header)
2. **Default to `--provider host`** — no API key needed, you classify the bookmarks yourself
3. If user provides an API key, use the corresponding external provider instead
4. Run the script with appropriate parameters
5. **For host mode**: after the script saves `bookmarks.json`, read the file, classify each bookmark into categories (AI, Design, Crypto, Business, Career, Finance, Life, Tech, Media, News, etc.), and generate Obsidian vault markdown files
6. Report results: how many bookmarks fetched, categories found, files generated
7. Optionally open the output in Obsidian: `open "obsidian://open?path=<output-dir>"`

## Supported AI Providers (19+)

**Host AI** (no API key), OpenAI, Claude, DeepSeek, Gemini, Ollama, OpenRouter, Moonshot, Qwen, Zhipu GLM, SiliconFlow, Groq, Mistral, Together AI, Fireworks, Grok (xAI), Cohere, DeepInfra, Perplexity

## Source

GitHub: https://github.com/kiki123124/x2o
