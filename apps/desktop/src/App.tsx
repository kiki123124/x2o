import { createSignal, Show, For, createMemo } from "solid-js";
import { fetchOnly, classifyAndGenerate, type SyncResult, type SyncConfig, type Bookmark, type ClassifiedBookmark } from "./lib/sync";

type Page = "home" | "source" | "ai" | "fetching" | "preview" | "classifying" | "done";
const PREVIEW_RENDER_LIMIT = 300;
const BUILD_MARKER = "rv3-rust-fetch-20260303-1";

const ALL_PROVIDERS = [
  { id: "claude",      name: "Claude",       org: "Anthropic",    placeholder: "sk-ant-...",  color: "#d97706", baseUrl: "https://api.anthropic.com",                            icon: "/icons/claude-color.svg" },
  { id: "openai",      name: "OpenAI",       org: "OpenAI",       placeholder: "sk-...",      color: "#10a37f", baseUrl: "https://api.openai.com/v1",                            icon: "/icons/openai.svg" },
  { id: "deepseek",    name: "DeepSeek",     org: "DeepSeek",     placeholder: "sk-...",      color: "#4f6df5", baseUrl: "https://api.deepseek.com/v1",                          icon: "/icons/deepseek-color.svg" },
  { id: "gemini",      name: "Gemini",       org: "Google",       placeholder: "AIza...",     color: "#4285f4", baseUrl: "https://generativelanguage.googleapis.com/v1beta",      icon: "/icons/gemini-color.svg" },
  { id: "ollama",      name: "Ollama",       org: "Local",        placeholder: "",            color: "#64748b", baseUrl: "http://localhost:11434/v1",                             icon: "/icons/ollama.svg" },
  { id: "openrouter",  name: "OpenRouter",   org: "OpenRouter",   placeholder: "sk-or-...",   color: "#6366f1", baseUrl: "https://openrouter.ai/api/v1",                         icon: "/icons/openrouter.svg" },
  { id: "moonshot",    name: "Moonshot",     org: "Kimi",         placeholder: "sk-...",      color: "#0ea5e9", baseUrl: "https://api.moonshot.cn/v1",                            icon: "/icons/moonshot.svg" },
  { id: "qwen",        name: "Qwen",         org: "Alibaba",      placeholder: "sk-...",      color: "#f97316", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",     icon: "/icons/qwen-color.svg" },
  { id: "zhipu",       name: "Zhipu GLM",    org: "Zhipu AI",     placeholder: "",            color: "#2563eb", baseUrl: "https://open.bigmodel.cn/api/paas/v4",                  icon: "/icons/chatglm-color.svg" },
  { id: "siliconflow", name: "SiliconFlow",  org: "SiliconFlow",  placeholder: "sk-...",      color: "#8b5cf6", baseUrl: "https://api.siliconflow.cn/v1",                        icon: "/icons/siliconcloud-color.svg" },
  { id: "groq",        name: "Groq",         org: "Groq",         placeholder: "gsk_...",     color: "#f43f5e", baseUrl: "https://api.groq.com/openai/v1",                       icon: "/icons/groq.svg" },
  { id: "mistral",     name: "Mistral",      org: "Mistral AI",   placeholder: "",            color: "#ff7000", baseUrl: "https://api.mistral.ai/v1",                            icon: "/icons/mistral-color.svg" },
  { id: "together",    name: "Together AI",  org: "Together",     placeholder: "",            color: "#06b6d4", baseUrl: "https://api.together.xyz/v1",                          icon: "/icons/together-color.svg" },
  { id: "fireworks",   name: "Fireworks",    org: "Fireworks AI", placeholder: "",            color: "#ef4444", baseUrl: "https://api.fireworks.ai/inference/v1",                 icon: "/icons/fireworks-color.svg" },
  { id: "xai",         name: "Grok",         org: "xAI",          placeholder: "xai-...",     color: "#171717", baseUrl: "https://api.x.ai/v1",                                  icon: "/icons/grok.svg" },
  { id: "cohere",      name: "Cohere",       org: "Cohere",       placeholder: "",            color: "#39d353", baseUrl: "https://api.cohere.com/v1",                            icon: "/icons/cohere-color.svg" },
  { id: "deepinfra",   name: "DeepInfra",    org: "DeepInfra",    placeholder: "",            color: "#1e40af", baseUrl: "https://api.deepinfra.com/v1/openai",                  icon: "/icons/deepinfra-color.svg" },
  { id: "perplexity",  name: "Perplexity",   org: "Perplexity",   placeholder: "pplx-...",    color: "#22c55e", baseUrl: "https://api.perplexity.ai",                            icon: "/icons/perplexity-color.svg" },
];

export default function App() {
  const [page, setPage] = createSignal<Page>("home");
  const [provider, setProvider] = createSignal("claude");
  const [apiKey, setApiKey] = createSignal("");
  const [baseUrl, setBaseUrl] = createSignal("");
  const [model, setModel] = createSignal("");
  const [inputPath, setInputPath] = createSignal("");
  const [cookie, setCookie] = createSignal("");
  const [limitInput, setLimitInput] = createSignal("800");
  const [outputDir, setOutputDir] = createSignal("~/x2o-output");
  const [error, setError] = createSignal("");
  const [fetchedBookmarks, setFetchedBookmarks] = createSignal<Bookmark[]>([]);
  const [result, setResult] = createSignal<SyncResult | null>(null);
  const [progressDetail, setProgressDetail] = createSignal("");
  const [progressPercent, setProgressPercent] = createSignal(0);
  const [progressCurrent, setProgressCurrent] = createSignal<number | null>(null);
  const [progressTotal, setProgressTotal] = createSignal<number | null>(null);
  const [progressStep, setProgressStep] = createSignal(0);
  const [drawerOpen, setDrawerOpen] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [customName, setCustomName] = createSignal("");

  const currentProvider = createMemo(() => {
    if (provider() === "custom") return { id: "custom", name: customName() || "自定义", org: "Custom", placeholder: "sk-...", color: "#6b7280", baseUrl: "", icon: "" };
    return ALL_PROVIDERS.find((p) => p.id === provider()) ?? ALL_PROVIDERS[0];
  });

  const filteredProviders = createMemo(() => {
    const q = searchQuery().toLowerCase();
    if (!q) return ALL_PROVIDERS;
    return ALL_PROVIDERS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.org.toLowerCase().includes(q)
    );
  });

  const visibleFetchedBookmarks = createMemo(() => fetchedBookmarks().slice(0, PREVIEW_RENDER_LIMIT));

  const canFetch = () => !!(inputPath() || cookie());
  const canClassify = () => {
    if (provider() !== "ollama" && !apiKey()) return false;
    if (provider() === "custom" && !baseUrl()) return false;
    return true;
  };

  const getConfig = (): SyncConfig => ({
    limit: Math.max(1, Number.parseInt(limitInput() || "800", 10) || 800),
    provider: provider(), apiKey: apiKey(), baseUrl: baseUrl() || undefined,
    model: model() || undefined, inputPath: inputPath() || undefined,
    cookie: cookie() || undefined, outputDir: outputDir(),
  });

  const applyProgress = (p: { detail: string; percent?: number; current?: number; total?: number }) => {
    setProgressDetail(p.detail);
    if (typeof p.percent === "number") setProgressPercent(Math.max(0, Math.min(100, p.percent)));
    setProgressCurrent(typeof p.current === "number" ? p.current : null);
    setProgressTotal(typeof p.total === "number" ? p.total : null);
  };

  const selectProvider = (id: string) => {
    setProvider(id); setDrawerOpen(false); setSearchQuery("");
    const p = ALL_PROVIDERS.find((x) => x.id === id);
    if (p) setBaseUrl(p.baseUrl); else setBaseUrl("");
  };

  const pickJsonFile = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const s = await open({ filters: [{ name: "JSON", extensions: ["json"] }], title: "选择书签 JSON 文件" });
      if (s) setInputPath(s as string);
    } catch {}
  };

  const pickInputDir = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const s = await open({ directory: true, title: "选择输出目录（将自动读取 bookmarks.json）" });
      if (s) setInputPath(s as string);
    } catch {}
  };

  const pickOutputDir = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const s = await open({ directory: true, title: "选择输出目录" });
      if (s) setOutputDir(s as string);
    } catch {}
  };

  const shellOpen = async (uri: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_target", { target: uri });
    } catch (e) {
      setError(`打开失败：${String(e)}`);
    }
  };

  const openInObsidian = async (outputPath: string) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_in_obsidian", { path: outputPath });
    } catch (e) {
      setError(`Obsidian 打开失败：${String(e)}`);
    }
  };

  const handleFetch = async () => {
    setError(""); setPage("fetching"); setProgressPercent(0); setProgressCurrent(null); setProgressTotal(null); setProgressDetail("正在获取书签...");
    try {
      const bm = await fetchOnly(getConfig(), applyProgress);
      setFetchedBookmarks(bm); setPage("preview");
    } catch (err) { setError(String(err)); setPage("source"); }
  };

  const handleClassify = async () => {
    setError(""); setPage("classifying"); setProgressStep(2); setProgressPercent(0); setProgressCurrent(null); setProgressTotal(null); setProgressDetail("正在用 AI 分类...");
    try {
      const sourceBookmarks = fetchedBookmarks();
      const res = await classifyAndGenerate(sourceBookmarks, getConfig(), (p) => {
        setProgressStep(p.step); applyProgress(p);
      });
      setFetchedBookmarks([]);
      setResult(res); setPage("done");
    } catch (err) { setError(String(err)); setPage("preview"); }
  };

  // Sidebar nav items
  const navItems = createMemo(() => {
    const p = page();
    const configPages: Page[] = ["source", "ai"];
    const isConfig = configPages.includes(p);
    return [
      { id: "home" as Page, label: "首页", icon: "⌂", active: p === "home" },
      { id: "source" as Page, label: "数据源", icon: "◉", active: p === "source" },
      { id: "ai" as Page, label: "AI 模型", icon: "◈", active: p === "ai" },
      { id: "preview" as Page, label: "书签", icon: "☰", active: p === "preview" || p === "fetching", disabled: fetchedBookmarks().length === 0 && p !== "fetching" },
      { id: "done" as Page, label: "结果", icon: "✓", active: p === "done" || p === "classifying", disabled: !result() && p !== "classifying" },
    ];
  });

  return (
    <div class="h-screen flex" style={{ background: "var(--bg)" }}>
      {/* === SIDEBAR === */}
      <div class="w-48 h-full flex flex-col shrink-0" style={{ background: "var(--sidebar)", "border-right": "1px solid var(--border)" }}>
        {/* Drag region + logo (pt-7 for macOS traffic lights) */}
        <div class="pt-7 h-16 flex items-center px-5 gap-2 shrink-0" data-tauri-drag-region>
          <img src="/logo.jpg" class="w-6 h-6 rounded-lg" />
          <span class="text-[12px] font-semibold tracking-tight">x2o</span>
        </div>

        {/* Nav */}
        <nav class="flex-1 px-3 py-2 space-y-0.5">
          <For each={navItems()}>
            {(item) => (
              <button
                class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] transition-all"
                style={{
                  background: item.active ? "var(--sidebar-active)" : "transparent",
                  color: item.active ? "var(--accent)" : item.disabled ? "var(--text-tertiary)" : "var(--text-secondary)",
                  "font-weight": item.active ? "600" : "400",
                  cursor: item.disabled ? "default" : "pointer",
                  opacity: item.disabled ? "0.5" : "1",
                }}
                disabled={item.disabled}
                onClick={() => !item.disabled && setPage(item.id)}
              >
                <span class="text-[14px] w-5 text-center">{item.icon}</span>
                {item.label}
              </button>
            )}
          </For>
        </nav>

        {/* Output dir at bottom */}
        <div class="px-4 py-3 border-t" style={{ "border-color": "var(--border)" }}>
          <p class="text-[10px] mb-1.5" style={{ color: "var(--text-tertiary)" }}>输出目录</p>
          <div class="flex gap-1">
            <input type="text" value={outputDir()} onInput={(e) => setOutputDir(e.currentTarget.value)}
              class="flex-1 min-w-0 px-2 py-1 rounded-lg text-[10px] border outline-none"
              style={{ background: "var(--bg)", color: "var(--text)", "border-color": "var(--border)" }} />
            <button class="px-1.5 rounded-lg text-[10px] border"
              style={{ background: "var(--bg)", color: "var(--text-tertiary)", "border-color": "var(--border)" }}
              onClick={pickOutputDir}>...</button>
          </div>
          <p class="text-[9px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>
            build: {BUILD_MARKER}
          </p>
        </div>
      </div>

      {/* === MAIN CONTENT === */}
      <div class="flex-1 h-full flex flex-col overflow-hidden">
        {/* Top drag region */}
        <div class="h-12 shrink-0" data-tauri-drag-region />

        {/* Content */}
        <div class="flex-1 overflow-y-auto px-8 pb-6">

          {/* HOME */}
          <Show when={page() === "home"}>
            <div class="animate-fade-in-scale flex flex-col items-center justify-center h-full -mt-8">
              <img src="/logo.jpg" class="animate-bounce-in w-14 h-14 rounded-2xl mb-5" />
              <h1 class="text-[24px] font-semibold mb-2 tracking-tight">x2o</h1>
              <p class="text-[13px] text-center mb-8 max-w-[320px] leading-relaxed"
                style={{ color: "var(--text-secondary)" }}>
                X 书签导出 → AI 智能分类 → Obsidian 知识库
              </p>
              <div class="flex gap-8 mb-8 stagger-children">
                <For each={[
                  ["📥", "导入", "Cookie 或 JSON"],
                  ["🤖", "分类", "20+ AI 模型"],
                  ["📚", "生成", "Obsidian Vault"],
                ]}>
                  {([icon, t, d]) => (
                    <div class="animate-fade-in text-center">
                      <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-[20px] mx-auto mb-2"
                        style={{ background: "var(--accent-soft)" }}>
                        {icon}
                      </div>
                      <p class="text-[12px] font-medium">{t}</p>
                      <p class="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{d}</p>
                    </div>
                  )}
                </For>
              </div>
              <button class="px-6 py-2 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] hover-lift"
                style={{ background: "var(--accent)", color: "#fff" }}
                onClick={() => setPage("source")}>
                开始使用 →
              </button>
            </div>
          </Show>

          {/* SOURCE */}
          <Show when={page() === "source"}>
            <div class="animate-fade-in-right max-w-lg">
              <h2 class="text-[18px] font-semibold mb-1">数据源</h2>
              <p class="text-[12px] mb-5" style={{ color: "var(--text-secondary)" }}>选择书签来源，Cookie 抓取或 JSON 导入</p>

              <Card>
                <FieldLabel>JSON 文件 / 输出目录</FieldLabel>
                <div class="flex gap-2">
                  <div class="flex-1"><Field value={inputPath()} onInput={setInputPath} placeholder="选择 bookmarks.json 或选择输出目录（自动识别）" /></div>
                  <Btn onClick={pickJsonFile} secondary>选文件</Btn>
                  <Btn onClick={pickInputDir} secondary>选文件夹</Btn>
                </div>
                <p class="text-[10px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                  💡 支持重分类：选择上一次的输出目录（里面有 bookmarks.json）即可。
                </p>

                <div class="flex items-center gap-3 my-4">
                  <div class="flex-1 h-px" style={{ background: "var(--border)" }} />
                  <span class="text-[11px]" style={{ color: "var(--text-tertiary)" }}>或</span>
                  <div class="flex-1 h-px" style={{ background: "var(--border)" }} />
                </div>

                <FieldLabel>X Cookie</FieldLabel>
                <textarea value={cookie()} onInput={(e) => setCookie(e.currentTarget.value)}
                  placeholder="从浏览器 DevTools 复制 Cookie（F12 → Network → Cookie 头）"
                  class="w-full px-3 py-2 rounded-xl text-[12px] outline-none border resize-none h-20"
                  style={{ background: "var(--bg)", color: "var(--text)", "border-color": "var(--border)" }} />

                <FieldLabel class="mt-3">最多处理条数（防卡死）</FieldLabel>
                <Field value={limitInput()} onInput={setLimitInput} placeholder="默认 800，建议先用 300-1000" />
              </Card>

              <Show when={error()}>
                <div class="mt-3 px-4 py-2.5 rounded-xl text-[12px] animate-fade-in"
                  style={{ background: "var(--error-soft)", color: "var(--error)" }}>{error()}</div>
              </Show>

              <div class="flex gap-3 mt-5">
                <Btn onClick={() => setPage("ai")} disabled={!canFetch()}>
                  下一步：AI 模型 →
                </Btn>
                <Btn onClick={handleFetch} disabled={!canFetch()} secondary>
                  直接获取书签
                </Btn>
              </div>
            </div>
          </Show>

          {/* AI MODEL */}
          <Show when={page() === "ai"}>
            <div class="animate-fade-in-right max-w-lg">
              <h2 class="text-[18px] font-semibold mb-1">AI 模型</h2>
              <p class="text-[12px] mb-5" style={{ color: "var(--text-secondary)" }}>选择用于书签分类的 AI 提供商</p>

              <Card>
                <FieldLabel>提供商</FieldLabel>
                <button class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] border transition-all hover-lift"
                  style={{ background: "var(--bg)", color: "var(--text)", "border-color": "var(--border)" }}
                  onClick={() => setDrawerOpen(true)}>
                  <span class="flex items-center gap-2">
                    <ProviderIcon icon={currentProvider().icon} name={currentProvider().name} color={currentProvider().color} size={20} />
                    <span class="font-medium">{currentProvider().name}</span>
                    <span class="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{currentProvider().org}</span>
                  </span>
                  <span style={{ color: "var(--text-tertiary)" }}>▾</span>
                </button>

                <Show when={provider() !== "ollama"}>
                  <FieldLabel class="mt-3">API Key</FieldLabel>
                  <Field value={apiKey()} onInput={setApiKey} placeholder={currentProvider().placeholder} type="password" />
                </Show>

                <Show when={provider() === "custom"}>
                  <FieldLabel class="mt-3">服务商名称</FieldLabel>
                  <Field value={customName()} onInput={setCustomName} placeholder="例如：我的中转站" />
                </Show>

                <FieldLabel class="mt-3">API 地址</FieldLabel>
                <Field value={baseUrl()} onInput={setBaseUrl}
                  placeholder={provider() === "custom" ? "https://your-api.com/v1（必填）" : currentProvider().baseUrl} />

                <FieldLabel class="mt-3">模型（留空用默认）</FieldLabel>
                <Field value={model()} onInput={setModel} placeholder="留空使用默认模型" />
              </Card>

              <div class="flex gap-3 mt-5">
                <Btn onClick={handleFetch} disabled={!canFetch() || !canClassify()}>
                  获取书签
                </Btn>
                <Btn onClick={() => setPage("source")} secondary>
                  ← 返回数据源
                </Btn>
              </div>
            </div>
          </Show>

          {/* FETCHING */}
          <Show when={page() === "fetching"}>
            <div class="animate-fade-in-scale flex flex-col items-center justify-center h-full -mt-8">
              <div class="w-10 h-10 mb-5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ "border-color": "var(--accent)", "border-top-color": "transparent" }} />
              <p class="text-[15px] font-medium mb-2">正在获取书签</p>
              <p class="text-[12px] animate-pulse" style={{ color: "var(--text-tertiary)" }}>
                {progressDetail() || "连接中..."}
              </p>
              <Show when={progressTotal() && progressCurrent()}>
                <p class="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                  {progressCurrent()} / {progressTotal()}
                </p>
              </Show>
              <div class="w-56 h-2 rounded-full mt-4" style={{ background: "var(--bg-secondary)" }}>
                <div class="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent()}%`, background: "var(--accent)" }} />
              </div>
              <p class="text-[11px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>{progressPercent()}%</p>
            </div>
          </Show>

          {/* PREVIEW */}
          <Show when={page() === "preview"}>
            <div class="animate-fade-in-right">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h2 class="text-[18px] font-semibold">书签预览</h2>
                  <p class="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    共 {fetchedBookmarks().length} 条书签，确认后点击"开始分类"
                  </p>
                  <Show when={fetchedBookmarks().length > PREVIEW_RENDER_LIMIT}>
                    <p class="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                      为保证流畅，仅展示前 {PREVIEW_RENDER_LIMIT} 条
                    </p>
                  </Show>
                </div>
                <Btn onClick={handleClassify} disabled={!canClassify()}>
                  开始 AI 分类
                </Btn>
              </div>

              <Show when={error()}>
                <div class="mb-3 px-4 py-2.5 rounded-xl text-[12px] animate-fade-in"
                  style={{ background: "var(--error-soft)", color: "var(--error)" }}>{error()}</div>
              </Show>

              <div class="space-y-2 stagger-children">
                <For each={visibleFetchedBookmarks()}>
                  {(bm) => <BookmarkCard bm={bm} expanded={expandedId() === bm.id}
                    onToggle={() => setExpandedId(expandedId() === bm.id ? null : bm.id)}
                    onOpenUrl={(url) => shellOpen(url)} />}
                </For>
              </div>
            </div>
          </Show>

          {/* CLASSIFYING */}
          <Show when={page() === "classifying"}>
            <div class="animate-fade-in-scale flex flex-col items-center justify-center h-full -mt-8">
              <div class="w-10 h-10 mb-5 border-2 border-t-transparent rounded-full animate-spin"
                style={{ "border-color": "var(--accent)", "border-top-color": "transparent" }} />
              <div class="w-full max-w-xs space-y-3">
                <For each={[
                  { s: 2, label: "AI 分类", sub: "分析内容并归类" },
                  { s: 3, label: "生成知识库", sub: "创建 Markdown 文件" },
                ]}>
                  {(item) => {
                    const done = () => progressStep() > item.s;
                    const active = () => progressStep() === item.s;
                    return (
                      <div class="flex items-center gap-3">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 transition-all"
                          style={{
                            background: done() ? "var(--success)" : active() ? "var(--accent)" : "var(--bg-secondary)",
                            color: done() || active() ? "#fff" : "var(--text-tertiary)",
                          }}>
                          {done() ? "✓" : item.s - 1}
                        </div>
                        <div>
                          <p class="text-[13px] font-medium" style={{ color: active() ? "var(--text)" : "var(--text-secondary)" }}>{item.label}</p>
                          <Show when={active()}>
                            <p class="text-[11px] animate-pulse" style={{ color: "var(--text-tertiary)" }}>{progressDetail() || item.sub}</p>
                          </Show>
                        </div>
                      </div>
                    );
                  }}
                </For>
              </div>
              <div class="w-64 h-2 rounded-full mt-5" style={{ background: "var(--bg-secondary)" }}>
                <div class="h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent()}%`, background: "var(--accent)" }} />
              </div>
              <p class="text-[11px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>
                {progressPercent()}%
                <Show when={progressTotal() && progressCurrent()}>
                  {" · "}{progressCurrent()} / {progressTotal()}
                </Show>
              </p>
            </div>
          </Show>

          {/* DONE */}
          <Show when={page() === "done" && result()}>
            <div class="animate-fade-in-right">
              <Show when={error()}>
                <div class="mb-3 px-4 py-2.5 rounded-xl text-[12px] animate-fade-in"
                  style={{ background: "var(--error-soft)", color: "var(--error)" }}>{error()}</div>
              </Show>
              <div class="flex items-start justify-between mb-5">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center animate-bounce-in"
                    style={{ background: "var(--success-soft)" }}>
                    <span class="text-[18px]" style={{ color: "var(--success)" }}>✓</span>
                  </div>
                  <div>
                    <h2 class="text-[18px] font-semibold">同步完成</h2>
                    <p class="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      {result()!.bookmarkCount} 条 → {result()!.filesCreated} 个文件 → {result()!.categories.length} 个分类
                    </p>
                    <p class="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                      结果页仅展示前 {result()!.previewItems.length} 条，全部内容已写入导出目录
                    </p>
                  </div>
                </div>
                <div class="flex gap-2">
                  <Btn onClick={() => openInObsidian(result()!.outputDir)}>
                    Obsidian 打开
                  </Btn>
                  <Btn onClick={() => shellOpen(result()!.outputDir)} secondary>
                    打开文件夹
                  </Btn>
                </div>
              </div>

              {/* Categories */}
              <div class="flex flex-wrap gap-1.5 mb-5">
                <For each={result()!.categories}>
                  {(cat) => (
                    <span class="text-[11px] px-2.5 py-1 rounded-full animate-fade-in"
                      style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{cat}</span>
                  )}
                </For>
              </div>

              {/* Classified bookmarks */}
              <div class="space-y-2 stagger-children">
                <For each={result()!.previewItems}>
                  {(item: ClassifiedBookmark) => (
                    <div class="animate-fade-in rounded-2xl hover-lift cursor-pointer"
                      style={{ background: "var(--card)", "box-shadow": "var(--card-shadow)" }}
                      onClick={() => setExpandedId(expandedId() === item.bookmark.id ? null : item.bookmark.id)}>
                      <div class="px-4 py-3">
                        <div class="flex items-start gap-3">
                          <div class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                            {item.bookmark.authorName.charAt(0).toUpperCase()}
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-0.5">
                              <span class="text-[12px] font-medium truncate">{item.bookmark.authorName}</span>
                              <span class="text-[10px]" style={{ color: "var(--text-tertiary)" }}>@{item.bookmark.authorHandle}</span>
                              <span class="text-[9px] px-1.5 py-0.5 rounded-full ml-auto shrink-0"
                                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{item.category}</span>
                            </div>
                            <p class="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.summary}</p>
                            <Show when={expandedId() === item.bookmark.id}>
                              <div class="mt-2 pt-2 border-t animate-fade-in" style={{ "border-color": "var(--border)" }}>
                                <p class="text-[11px] leading-relaxed whitespace-pre-wrap mb-2" style={{ color: "var(--text)" }}>
                                  {item.bookmark.text}
                                </p>
                                <div class="flex items-center gap-3">
                                  <Show when={item.bookmark.metrics}>
                                    <div class="flex gap-3 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                                      <span>♥ {item.bookmark.metrics!.likes}</span>
                                      <span>↻ {item.bookmark.metrics!.retweets}</span>
                                      <span>💬 {item.bookmark.metrics!.replies}</span>
                                    </div>
                                  </Show>
                                  <a class="text-[10px] underline ml-auto" style={{ color: "var(--accent)" }}
                                    href={item.bookmark.url}
                                    onClick={(e) => { e.stopPropagation(); shellOpen(item.bookmark.url); }}>
                                    在 X 上查看
                                  </a>
                                </div>
                                <div class="flex flex-wrap gap-1 mt-1.5">
                                  <For each={item.tags}>
                                    {(tag) => <span class="text-[9px] px-1.5 py-0.5 rounded-full"
                                      style={{ background: "var(--bg-secondary)", color: "var(--text-tertiary)" }}>{tag}</span>}
                                  </For>
                                </div>
                              </div>
                            </Show>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <div class="flex gap-2 mt-5">
                <Btn onClick={() => { setPage("source"); setResult(null); setFetchedBookmarks([]); setExpandedId(null); }} secondary>
                  再次同步
                </Btn>
                <Btn onClick={() => { setPage("home"); setResult(null); setFetchedBookmarks([]); setExpandedId(null); }} secondary>
                  返回首页
                </Btn>
              </div>
            </div>
          </Show>
        </div>
      </div>

      {/* === PROVIDER DRAWER === */}
      <Show when={drawerOpen()}>
        <div class="fixed inset-0 z-50" style={{ background: "var(--overlay)" }}
          onClick={() => setDrawerOpen(false)}>
          <div class="absolute bottom-0 left-0 right-0 rounded-t-3xl animate-slide-up"
            style={{ background: "var(--bg)", "max-height": "70vh" }}
            onClick={(e) => e.stopPropagation()}>
            <div class="flex justify-center pt-3 pb-2">
              <div class="w-8 h-1 rounded-full" style={{ background: "var(--border)" }} />
            </div>
            <div class="px-6 pb-2">
              <h3 class="text-[15px] font-semibold mb-3">选择 AI 提供商</h3>
              <input type="text" value={searchQuery()} onInput={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="搜索..."
                class="w-full px-3 py-2 rounded-xl text-[12px] outline-none border mb-2"
                style={{ background: "var(--bg-secondary)", color: "var(--text)", "border-color": "var(--border)" }} />
            </div>
            <div class="overflow-y-auto px-6 pb-4" style={{ "max-height": "calc(70vh - 130px)" }}>
              <div class="grid grid-cols-2 gap-1">
                <For each={filteredProviders()}>
                  {(p) => (
                    <button class="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all active:scale-[0.97]"
                      style={{ background: provider() === p.id ? "var(--accent-soft)" : "transparent" }}
                      onClick={() => selectProvider(p.id)}>
                      <ProviderIcon icon={p.icon} name={p.name} color={p.color} size={24} />
                      <div class="min-w-0">
                        <p class="text-[12px] font-medium truncate" style={{ color: provider() === p.id ? "var(--accent)" : "var(--text)" }}>{p.name}</p>
                        <p class="text-[9px] truncate" style={{ color: "var(--text-tertiary)" }}>{p.baseUrl}</p>
                      </div>
                    </button>
                  )}
                </For>
              </div>
              <div class="mt-2 pt-2 border-t" style={{ "border-color": "var(--border)" }}>
                <button class="flex items-center gap-2 px-3 py-2 rounded-xl transition-all active:scale-[0.97]"
                  style={{ background: provider() === "custom" ? "var(--accent-soft)" : "transparent" }}
                  onClick={() => { setProvider("custom"); setDrawerOpen(false); setSearchQuery(""); setBaseUrl(""); }}>
                  <div class="w-6 h-6 rounded-lg flex items-center justify-center text-[12px]"
                    style={{ background: "var(--bg-secondary)", color: "var(--text-tertiary)" }}>+</div>
                  <div>
                    <p class="text-[12px] font-medium" style={{ color: provider() === "custom" ? "var(--accent)" : "var(--text)" }}>自定义</p>
                    <p class="text-[9px]" style={{ color: "var(--text-tertiary)" }}>OpenAI 兼容 API</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

// === Reusable Components ===

function BookmarkCard(props: { bm: Bookmark; expanded: boolean; onToggle: () => void; onOpenUrl: (url: string) => void }) {
  return (
    <div class="animate-fade-in rounded-2xl hover-lift cursor-pointer"
      style={{ background: "var(--card)", "box-shadow": "var(--card-shadow)" }}
      onClick={props.onToggle}>
      <div class="px-4 py-3">
        <div class="flex items-start gap-3">
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            {props.bm.authorName.charAt(0).toUpperCase()}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[12px] font-medium truncate">{props.bm.authorName}</span>
              <span class="text-[10px]" style={{ color: "var(--text-tertiary)" }}>@{props.bm.authorHandle}</span>
            </div>
            <Show when={!props.expanded}>
              <p class="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {props.bm.text.slice(0, 140)}{props.bm.text.length > 140 ? "..." : ""}
              </p>
            </Show>
            <Show when={props.expanded}>
              <p class="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text)" }}>{props.bm.text}</p>
              <div class="flex items-center gap-3 mt-2">
                <Show when={props.bm.metrics}>
                  <div class="flex gap-3 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                    <span>♥ {props.bm.metrics!.likes}</span>
                    <span>↻ {props.bm.metrics!.retweets}</span>
                    <span>💬 {props.bm.metrics!.replies}</span>
                  </div>
                </Show>
                <Show when={props.bm.media.length > 0}>
                  <span class="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{props.bm.media.length} 附件</span>
                </Show>
                <a class="text-[10px] underline ml-auto" style={{ color: "var(--accent)" }}
                  href={props.bm.url}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); props.onOpenUrl(props.bm.url); }}>
                  在 X 上查看
                </a>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProviderIcon(props: { icon?: string; name: string; color: string; size?: number }) {
  const s = () => props.size ?? 24;
  return (
    <Show when={props.icon} fallback={
      <div class="rounded-lg flex items-center justify-center font-bold shrink-0"
        style={{ width: `${s()}px`, height: `${s()}px`, background: props.color, color: "#fff", "font-size": `${Math.round(s() * 0.42)}px` }}>
        {props.name.charAt(0).toUpperCase()}
      </div>
    }>
      <img src={props.icon} class="shrink-0" style={{ width: `${s()}px`, height: `${s()}px` }} />
    </Show>
  );
}

function Btn(props: { children: any; onClick: () => void; disabled?: boolean; secondary?: boolean }) {
  return (
    <button
      class="px-4 py-2 rounded-xl text-[12px] font-medium transition-all active:scale-[0.97]"
      style={{
        background: props.secondary ? "var(--bg-secondary)" : props.disabled ? "var(--bg-tertiary)" : "var(--accent)",
        color: props.secondary ? "var(--text-secondary)" : props.disabled ? "var(--text-tertiary)" : "#fff",
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? "0.6" : "1",
      }}
      disabled={props.disabled}
      onClick={props.onClick}>
      {props.children}
    </button>
  );
}

function SectionLabel(props: { children: any }) {
  return <p class="text-[10px] font-medium tracking-wide uppercase mt-4 mb-1.5 px-1" style={{ color: "var(--text-tertiary)" }}>{props.children}</p>;
}

function Card(props: { children: any; class?: string }) {
  return <div class={`p-4 rounded-2xl ${props.class ?? ""}`} style={{ background: "var(--card)", "box-shadow": "var(--card-shadow)" }}>{props.children}</div>;
}

function FieldLabel(props: { children: any; class?: string }) {
  return <label class={`block text-[11px] font-medium mb-1 ${props.class ?? ""}`} style={{ color: "var(--text-secondary)" }}>{props.children}</label>;
}

function Field(props: { value: string; onInput: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={props.type ?? "text"} value={props.value} onInput={(e) => props.onInput(e.currentTarget.value)}
      placeholder={props.placeholder}
      class="w-full px-3 py-2 rounded-xl text-[12px] outline-none border"
      style={{ background: "var(--bg)", color: "var(--text)", "border-color": "var(--border)" }} />
  );
}
