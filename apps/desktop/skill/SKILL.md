---
name: x2o
description: |
  Export X (Twitter) bookmarks, classify them with AI, and generate an Obsidian knowledge vault.

  USE FOR:
  - Exporting X/Twitter bookmarks to local files
  - AI-powered bookmark classification and summarization
  - Generating Obsidian-compatible markdown knowledge bases
  - Batch processing bookmarks from JSON exports

  TRIGGERS:
  - "导出书签", "export bookmarks", "X 书签", "x2o", "书签分类"
  - "twitter bookmarks", "obsidian vault from bookmarks"
  - "classify my bookmarks", "organize bookmarks"
version: 0.2.0
---

# x2o — X Bookmark Export + AI Classification

Export X (Twitter) bookmarks → AI classify → Obsidian knowledge vault. All local, no third-party servers.

## Usage

Run the CLI script via `npx tsx`:

```bash
npx tsx ~/.claude/skills/x2o/scripts/x2o.ts \
  --cookie "<X cookie string>" \
  --provider deepseek \
  --api-key "sk-..." \
  --output ~/x2o-output \
  --limit 100
```

### From existing JSON file (skip fetching):

```bash
npx tsx ~/.claude/skills/x2o/scripts/x2o.ts \
  --input bookmarks.json \
  --provider openai \
  --api-key "sk-..." \
  --output ~/x2o-output
```

## Parameters

| Flag | Required | Description |
|------|----------|-------------|
| `--cookie` | Yes* | X browser cookie (must contain `ct0`) |
| `--input` | Yes* | Path to existing bookmarks JSON (alternative to cookie) |
| `--provider` | Yes | AI provider: `openai`, `claude`, `deepseek`, `gemini`, `ollama`, `groq`, `moonshot`, `qwen`, `zhipu`, `siliconflow`, `mistral`, `together`, `fireworks`, `xai`, `openrouter`, `cohere`, `deepinfra`, `perplexity` |
| `--api-key` | Yes** | API key for the chosen provider |
| `--output` | No | Output directory (default: `~/x2o-output`) |
| `--limit` | No | Max bookmarks to fetch (default: 800) |
| `--model` | No | Override default model for the provider |
| `--base-url` | No | Override API base URL |
| `--fetch-only` | No | Only fetch bookmarks, skip classification |

\* One of `--cookie` or `--input` is required
\** Not required for `ollama` (local)

## Workflow for Claude

When user wants to export bookmarks:

1. Ask for their X cookie (guide them: F12 → Network → find any request → copy Cookie header)
2. Ask which AI provider they want to use + API key
3. Run the script with appropriate parameters
4. Report results: how many bookmarks fetched, categories found, files generated
5. Optionally open the output in Obsidian: `open "obsidian://open?path=<output-dir>"`

## Supported AI Providers (18+)

OpenAI, Claude, DeepSeek, Gemini, Ollama, OpenRouter, Moonshot, Qwen, Zhipu GLM, SiliconFlow, Groq, Mistral, Together AI, Fireworks, Grok (xAI), Cohere, DeepInfra, Perplexity

## Source

GitHub: https://github.com/kiki123124/x2o
