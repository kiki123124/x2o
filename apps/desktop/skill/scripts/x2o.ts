#!/usr/bin/env npx tsx
/**
 * x2o CLI — Export X bookmarks + AI classify + Obsidian vault
 * Usage: npx tsx x2o.ts --cookie "..." --provider deepseek --api-key "sk-..." --output ~/vault
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ─── CLI Args ───────────────────────────────────────────────────

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    }
  }
  return args;
}

const args = parseArgs();
const COOKIE = args["cookie"] || "";
const INPUT_PATH = args["input"] || "";
const PROVIDER = args["provider"] || "openai";
const API_KEY = args["api-key"] || "";
const MODEL = args["model"] || "";
const BASE_URL = args["base-url"] || "";
const OUTPUT_DIR = (args["output"] || "~/x2o-output").replace(/^~/, os.homedir());
const LIMIT = parseInt(args["limit"] || "800", 10);
const FETCH_ONLY = args["fetch-only"] === "true";

if (!COOKIE && !INPUT_PATH) {
  console.error("❌ 需要 --cookie 或 --input 参数");
  process.exit(1);
}
if (!FETCH_ONLY && PROVIDER !== "ollama" && !API_KEY) {
  console.error("❌ 需要 --api-key 参数（ollama 除外）");
  process.exit(1);
}

// ─── Types ──────────────────────────────────────────────────────

interface Bookmark {
  id: string; text: string; authorName: string; authorHandle: string;
  createdAt: string; url: string;
  media: { type: string; url: string; altText?: string }[];
  metrics: { likes: number; retweets: number; replies: number };
}

interface ClassifiedBookmark {
  bookmark: Bookmark; category: string; subcategory?: string;
  tags: string[]; summary: string;
}

// ─── Constants ──────────────────────────────────────────────────

const BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const QUERY_ID = "-LGfdImKeQz0xS_jjUwzlA";

const FEATURES = {
  graphql_timeline_v2_bookmark_timeline: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_media_download_video_enabled: false,
  responsive_web_enhance_cards_enabled: false,
};

const PROVIDER_DEFAULTS: Record<string, { apiFormat: string; baseUrl: string; model: string }> = {
  claude: { apiFormat: "anthropic", baseUrl: "https://api.anthropic.com", model: "claude-sonnet-4-5-20250514" },
  openai: { apiFormat: "openai", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  ollama: { apiFormat: "openai", baseUrl: "http://localhost:11434/v1", model: "llama3.2" },
  deepseek: { apiFormat: "openai", baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  gemini: { apiFormat: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.0-flash" },
  moonshot: { apiFormat: "openai", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  qwen: { apiFormat: "openai", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-turbo" },
  zhipu: { apiFormat: "openai", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  groq: { apiFormat: "openai", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  mistral: { apiFormat: "openai", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest" },
  together: { apiFormat: "openai", baseUrl: "https://api.together.xyz/v1", model: "meta-llama/Llama-3-8b-chat-hf" },
  xai: { apiFormat: "openai", baseUrl: "https://api.x.ai/v1", model: "grok-2-latest" },
  openrouter: { apiFormat: "openai", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3-8b-instruct" },
  siliconflow: { apiFormat: "openai", baseUrl: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-7B-Instruct" },
  fireworks: { apiFormat: "openai", baseUrl: "https://api.fireworks.ai/inference/v1", model: "accounts/fireworks/models/llama-v3p1-8b-instruct" },
  cohere: { apiFormat: "cohere", baseUrl: "https://api.cohere.com/v1", model: "command-r" },
  deepinfra: { apiFormat: "openai", baseUrl: "https://api.deepinfra.com/v1/openai", model: "meta-llama/Meta-Llama-3-8B-Instruct" },
  perplexity: { apiFormat: "openai", baseUrl: "https://api.perplexity.ai", model: "llama-3.1-sonar-small-128k-online" },
  custom: { apiFormat: "openai", baseUrl: "", model: "gpt-3.5-turbo" },
};

const CLASSIFICATION_PROMPT = `You are a bookmark classifier. Given a list of tweets/posts, classify each one into a category and subcategory, assign relevant tags, and write a brief summary.

Respond in JSON format:
{
  "items": [
    {
      "id": "tweet_id",
      "category": "Main Category",
      "subcategory": "Sub Category (optional)",
      "tags": ["tag1", "tag2"],
      "summary": "One sentence summary"
    }
  ],
  "categories": ["Category1", "Category2"]
}

Categories should be broad topics like: Tech, AI/ML, Design, Business, Life, Science, Programming, Crypto, etc.
Keep categories concise and reusable. Aim for 5-15 total categories.
Respond with summaries in Chinese.

Tweets to classify:
`;

// ─── Fetch Bookmarks ────────────────────────────────────────────

async function fetchBookmarks(cookie: string, limit: number): Promise<Bookmark[]> {
  const csrfMatch = cookie.match(/ct0=([^;]+)/);
  if (!csrfMatch) throw new Error("Cookie 中缺少 ct0（CSRF token）");
  const csrfToken = csrfMatch[1];

  const bookmarks: Bookmark[] = [];
  let cursor: string | undefined;

  while (bookmarks.length < limit) {
    const variables: Record<string, unknown> = {
      count: Math.min(20, limit - bookmarks.length),
      includePromotedContent: false,
    };
    if (cursor) variables.cursor = cursor;

    const params = new URLSearchParams({
      variables: JSON.stringify(variables),
      features: JSON.stringify(FEATURES),
    });

    const url = `https://x.com/i/api/graphql/${QUERY_ID}/Bookmarks?${params}`;
    const res = await fetch(url, {
      headers: {
        authorization: `Bearer ${BEARER_TOKEN}`,
        cookie,
        "x-csrf-token": csrfToken,
        "x-twitter-active-user": "yes",
        "x-twitter-auth-type": "OAuth2Session",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`X API 错误 ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();
    const { items, nextCursor } = parseBookmarkResponse(json);
    bookmarks.push(...items);
    console.log(`📥 已获取 ${bookmarks.length}/${limit} 条书签`);

    if (!nextCursor || items.length === 0) break;
    cursor = nextCursor;
  }

  return bookmarks;
}

function parseBookmarkResponse(json: any): { items: Bookmark[]; nextCursor?: string } {
  const timeline =
    json?.data?.bookmark_timeline_v2?.timeline?.instructions ??
    json?.data?.search_by_raw_query?.bookmarks_search_timeline?.timeline?.instructions;
  if (!timeline) return { items: [] };

  const addEntries = timeline.find((i: any) => i.type === "TimelineAddEntries");
  const entries = addEntries?.entries ?? [];
  const items: Bookmark[] = [];
  let nextCursor: string | undefined;

  for (const entry of entries) {
    const entryId = entry.entryId ?? "";
    if (entryId.startsWith("tweet-")) {
      let result = entry?.content?.itemContent?.tweet_results?.result;
      if (!result) continue;
      if (result.__typename === "TweetWithVisibilityResults") result = result.tweet;
      const legacy = result?.legacy;
      if (!legacy) continue;

      const userResult = result?.core?.user_results?.result;
      const userCore = userResult?.core ?? {};
      const userLegacy = userResult?.legacy ?? {};
      const screenName = userCore.screen_name ?? userLegacy.screen_name ?? "";
      const name = userCore.name ?? userLegacy.name ?? "";
      const restId = result.rest_id ?? "";
      if (!restId) continue;

      const media = (legacy.extended_entities?.media ?? []).map((m: any) => ({
        type: m.type === "video" ? "video" : m.type === "animated_gif" ? "gif" : "photo",
        url: m.media_url_https ?? "",
        altText: m.ext_alt_text ?? undefined,
      }));

      items.push({
        id: restId,
        text: legacy.full_text ?? "",
        authorName: name,
        authorHandle: screenName,
        createdAt: legacy.created_at ?? "",
        url: screenName ? `https://x.com/${screenName}/status/${restId}` : `https://x.com/i/status/${restId}`,
        media,
        metrics: { likes: legacy.favorite_count ?? 0, retweets: legacy.retweet_count ?? 0, replies: legacy.reply_count ?? 0 },
      });
    } else if (entryId.startsWith("cursor-bottom-")) {
      nextCursor = entry?.content?.value ?? "";
    }
  }
  return { items, nextCursor };
}

// ─── AI Classification ──────────────────────────────────────────

async function callAi(apiFormat: string, baseUrl: string, apiKey: string, model: string, prompt: string): Promise<string> {
  const base = baseUrl.replace(/\/$/, "");

  if (apiFormat === "anthropic") {
    const res = await fetch(`${base}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`AI API 错误 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    return json?.content?.[0]?.text ?? "";
  }

  if (apiFormat === "gemini") {
    const endpoint = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } }),
    });
    if (!res.ok) throw new Error(`AI API 错误 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }

  if (apiFormat === "cohere") {
    const res = await fetch(`${base}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw new Error(`AI API 错误 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    return json?.message?.content?.[0]?.text ?? "";
  }

  // OpenAI-compatible (default)
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.2 }),
  });
  if (!res.ok) throw new Error(`AI API 错误 ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

async function classifyBookmarks(bookmarks: Bookmark[]): Promise<{ items: ClassifiedBookmark[]; categories: string[] }> {
  const defaults = PROVIDER_DEFAULTS[PROVIDER] ?? PROVIDER_DEFAULTS.custom;
  const apiFormat = defaults.apiFormat;
  const baseUrl = BASE_URL || defaults.baseUrl;
  const model = MODEL || defaults.model;
  const batchSize = 20;

  const allItems: ClassifiedBookmark[] = [];
  const allCategories = new Set<string>();

  for (let i = 0; i < bookmarks.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(bookmarks.length / batchSize);
    console.log(`🤖 AI 分类中：第 ${batchIndex}/${totalBatches} 批`);

    const batch = bookmarks.slice(i, i + batchSize);
    const tweetsText = batch.map((b) => `[ID: ${b.id}] @${b.authorHandle}: ${b.text.slice(0, 500)}`).join("\n\n");
    const prompt = CLASSIFICATION_PROMPT + tweetsText;

    const text = await callAi(apiFormat, baseUrl, API_KEY, model, prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`AI 返回无法解析为 JSON（批次 ${batchIndex}）`);

    const parsed = JSON.parse(jsonMatch[0]);
    const bookmarkMap = new Map(batch.map((b) => [b.id, b]));

    for (const item of parsed.items ?? []) {
      const bookmark = bookmarkMap.get(item.id);
      if (!bookmark) continue;
      allItems.push({ bookmark, category: item.category, subcategory: item.subcategory, tags: item.tags ?? [], summary: item.summary ?? "" });
      allCategories.add(item.category);
    }
    for (const cat of parsed.categories ?? []) allCategories.add(cat);
  }

  return { items: allItems, categories: [...allCategories] };
}

// ─── Vault Generation ───────────────────────────────────────────

function sanitizePath(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

function renderBookmarkMd(item: ClassifiedBookmark): string {
  const b = item.bookmark;
  const lines = [
    "---",
    `title: "${b.text.slice(0, 60).replace(/"/g, '\\"')}"`,
    `author: "@${b.authorHandle}"`,
    `category: "${item.category}"`,
    item.subcategory ? `subcategory: "${item.subcategory}"` : null,
    `tags: [${item.tags.map((t) => `"${t}"`).join(", ")}]`,
    `url: "${b.url}"`,
    `date: "${b.createdAt}"`,
    "---",
    "",
    `# @${b.authorHandle}: ${b.text.slice(0, 80)}`,
    "",
    `> ${item.summary}`,
    "",
    b.text,
    "",
    `---`,
    `🔗 [原文链接](${b.url})`,
    `❤️ ${b.metrics.likes}  🔁 ${b.metrics.retweets}  💬 ${b.metrics.replies}`,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

function generateVault(items: ClassifiedBookmark[], outputDir: string): number {
  fs.mkdirSync(outputDir, { recursive: true });

  const byCategory = new Map<string, ClassifiedBookmark[]>();
  for (const item of items) {
    if (!byCategory.has(item.category)) byCategory.set(item.category, []);
    byCategory.get(item.category)!.push(item);
  }

  let filesCreated = 0;

  for (const [category, categoryItems] of byCategory) {
    const catDir = path.join(outputDir, sanitizePath(category));
    fs.mkdirSync(catDir, { recursive: true });

    for (const item of categoryItems) {
      const filename = `${item.bookmark.authorHandle || "unknown"}-${item.bookmark.id}.md`;
      fs.writeFileSync(path.join(catDir, filename), renderBookmarkMd(item));
      filesCreated++;
    }

    // Category index
    const indexLines = [
      "---", `title: "${category}"`, `type: category-index`, "---", "",
      `# ${category}`, "", `${categoryItems.length} bookmarks.`, "",
      ...categoryItems.map((it) => `- [[${it.bookmark.authorHandle}-${it.bookmark.id}|@${it.bookmark.authorHandle}: ${it.bookmark.text.slice(0, 60)}]]`),
    ];
    fs.writeFileSync(path.join(catDir, "_index.md"), indexLines.join("\n"));
    filesCreated++;
  }

  // Root index
  const rootLines = [
    "---", `title: "x2o"`, `type: vault-index`, "---", "",
    "# x2o", "",
    `${items.length} bookmarks across ${byCategory.size} categories.`, "",
    ...[...byCategory].map(([cat, items]) => `- **[[${sanitizePath(cat)}/_index|${cat}]]** (${items.length})`),
  ];
  fs.writeFileSync(path.join(outputDir, "_index.md"), rootLines.join("\n"));
  filesCreated++;

  return filesCreated;
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log("🏛️  x2o CLI\n");

  // Step 1: Get bookmarks
  let bookmarks: Bookmark[];

  if (INPUT_PATH) {
    console.log(`📂 从文件加载：${INPUT_PATH}`);
    const raw = fs.readFileSync(INPUT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed.bookmarks ?? [];
    bookmarks = arr.slice(0, LIMIT);
    console.log(`📥 加载了 ${bookmarks.length} 条书签`);
  } else {
    console.log(`🌐 从 X 拉取书签（上限 ${LIMIT}）`);
    bookmarks = await fetchBookmarks(COOKIE, LIMIT);
  }

  console.log(`\n✅ 共 ${bookmarks.length} 条书签\n`);

  if (FETCH_ONLY) {
    const outFile = path.join(OUTPUT_DIR, "bookmarks.json");
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(bookmarks, null, 2));
    console.log(`💾 已保存到 ${outFile}`);
    return;
  }

  // Step 2: AI Classification
  console.log(`🤖 使用 ${PROVIDER} 进行 AI 分类...`);
  const { items, categories } = await classifyBookmarks(bookmarks);
  console.log(`\n✅ 分类完成：${items.length} 条 → ${categories.length} 个分类\n`);

  // Step 3: Generate Vault
  console.log(`📚 生成 Obsidian 知识库 → ${OUTPUT_DIR}`);
  const filesCreated = generateVault(items, OUTPUT_DIR);
  console.log(`\n🎉 完成！生成了 ${filesCreated} 个文件`);
  console.log(`📂 输出目录：${OUTPUT_DIR}`);
  console.log(`💡 用 Obsidian 打开：obsidian://open?path=${encodeURIComponent(OUTPUT_DIR)}`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message || err}`);
  process.exit(1);
});
