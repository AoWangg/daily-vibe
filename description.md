# 工具定位与命令设计

CLI 名称示例：`daily-vibe`

核心子命令：

* `daily-vibe analyze today [--out <dir>] [--provider openai|anthropic|generic] [--model <name>]`

  * 聚合**当天**的 Claude Code & Codex 会话，产出两段 Markdown：

    1. **日报**（What I did today）
    2. **知识**（遇到的问题 & 解决方法）
* `daily-ai analyze range --from 2025-09-01 --to 2025-09-13`

  * 做任意时间窗复盘。
* `daily-ai sources scan`

  * 列出本机可发现的数据源（含解析到的会话文件路径，方便你快速验证）。
* `daily-ai config set --provider <p> --base-url <url> --api-key <key> [--model <name>]`

  * 运行时可切换供应商/模型（OpenAI/Anthropic/任意 OpenAI 兼容端点）。
* `daily-ai redact test`

  * 基于自定义敏感词/正则进行本地脱敏演练（例如 token、邮箱、手机号）。

输出：

* 控制台渲染（彩色摘要）
* 同步写入：`reports/YYYY-MM-DD/daily.md` 与 `reports/YYYY-MM-DD/knowledge.md`
* 可选 `--json` 导出结构化摘要（便于二次用在 Notion、Obsidian）

# 技术栈与“starter”

* **基座**：`oclif` TypeScript CLI 模板（成熟、插件化、友好发布到 npm）

* 关键依赖：

  * 文件发现：`fast-glob`
  * JSONL 流式解析：`readline` / `split2`
  * 时间处理：`dayjs` + `timezone`
  * 配置：`cosmiconfig`（默认读取 `~/.daily-ai/config.{json,yml}`，同时支持 env 覆盖）
  * 终端体验：`chalk`、`ora`
  * LLM SDK：

    * OpenAI 官方 `openai`（支持自定义 `baseURL`，可连 OpenRouter、vLLM 等）
    * Anthropic 官方 `@anthropic-ai/sdk`
    * 统一封装一个 `LLMClient` 接口，便于切换
* 构建与发布：`tsup`（产出单文件可执行）、`npm publish`

# 目录结构建议

```
/src
  /commands
    analyze/today.ts
    analyze/range.ts
    sources/scan.ts
    config/set.ts
  /core
    llm.ts            // 统一 LLM 适配层（OpenAI/Anthropic/generic）
    pipeline.ts       // 聚合→解析→切片→提示词→汇总
    redact.ts         // 脱敏
  /sources
    claude-code.ts    // 解析 ~/.claude/** & .specstory/**
    codex-cli.ts      // 解析 ~/.codex/** (sessions/history)
    codex-ide.ts      // 解析 VS Code globalStorage（若存在）
  /prompts
    daily.md          // 日报提示词模板
    knowledge.md      // 知识卡提示词模板
  /utils/fs.ts
```

# 数据流与算法（当天分析）

1. **发现会话文件**（今日 00:00–24:00，按本地时区 Asia/Taipei 切片）

   * Claude Code：扫描 `~/.claude/projects/**/**/*.jsonl`；若项目目录存在 `.specstory/history/**`，一并纳入。([Hacker News][2])
   * Codex CLI：扫描 `~/.codex/sessions/**/*.jsonl` 与 `~/.codex/history/**/*.jsonl`（两者之一，社区反馈皆有）；配置文件常见在 `~/.codex/config.toml|json`。([GitHub][3])
   * Codex VS Code 扩展（若使用）：尝试读取 `~/Library/Application Support/Code/User/globalStorage/<publisher>.<ext-id>/` 下扩展自有文件；若无，则放弃（VS Code 的 `globalStorage`/`workspaceStorage` 机制本身可确定位置，但 **并非所有扩展**都落盘聊天历史）。([Stack Overflow][4])
2. **解析格式**

   * JSONL 按行读取，每行一个 event/message。抽取字段：`timestamp`、`role`（user/assistant/tool）、`content`、`project`、`sessionId`、`toolRuns`（命令执行、返回码）、`fileDiffs` 等。
   * 若为 Markdown/纯文本（如 `.specstory/history/*.md`），按分隔符或标题切块。
3. **切片与归一化**

   * 按会话聚合；仅保留今日事件；去重（同一消息可能被扩展与 CLI 同时落盘）。
   * 轻度启发式抽取“问题—解决”对：

     * 正则识别错误类模式（`error|exception|traceback|npm ERR!|TypeError|ValueError|panic|stack` 等）；
     * 匹配随后 assistant 的“修复步骤 / 代码 diff / 命令序列”。
4. **提示词模板**（可在 `/prompts` 内自定义）

   * 日报（中文示例）：

     ```
     你是资深研发 TL。根据以下按时间排序的工作片段，生成当日【开发日报】：
     - 概览：做了哪些任务/模块，涉及哪些文件/提交
     - 关键产出：功能/脚手架/脚本/PR（如有链接则列出）
     - 运行/测试：跑过哪些命令，成功与失败
     - 待办与阻塞：下一步计划与风险
     要求：Markdown，≤ 300 行，使用二级/三级标题与清单。
     ```
   * 知识（中文示例）：

     ```
     你是“问题知识库”整理助手。请从片段中提炼【问题—原因—解决】三元组：
     - 每条包含：现象（含报错片段）、根因（定位思路）、解决步骤（含命令/代码）、踩坑提示
     - 可泛化为规则或 checklist 的，给出通用做法
     输出：Markdown，按主题分组，代码用 fenced code block。
     ```
5. **LLM 调用与多模型**

   * `--provider openai --base-url https://... --api-key ... --model gpt-4.1`
   * `--provider anthropic --api-key ... --model claude-3.7`
   * `--provider generic`（OpenAI 兼容端点，如本地 vLLM/LM Studio/OpenRouter），全靠 `baseURL` 与 `apiKey`。
6. **落盘与去敏**

   * 写入 `reports/<date>/daily.md`、`knowledge.md`；可先用 `redact` 规则（邮箱、token、手机号等）替换为 `***`。

# 关键实现片段（简化版）

**读取 JSONL 并按当天过滤**

```ts
// src/utils/fs.ts
import fs from 'node:fs';
import readline from 'node:readline';

export async function* readJsonl(file: string) {
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    try { yield JSON.parse(s); } catch {}
  }
}
```

```ts
// src/sources/claude-code.ts
import { readJsonl } from '../utils/fs';
import dayjs from 'dayjs';

export async function collectClaudeCodeEvents({ dayStart, dayEnd }: { dayStart: Date; dayEnd: Date }) {
  // 1) 枚举 ~/.claude/projects/**/**/*.jsonl 与 .specstory/history/**
  // 2) 对每个文件：for await (const ev of readJsonl(file)) { if (ts ∈ [dayStart, dayEnd]) 收集 }
  // 3) 归一化字段：role/content/ts/project/session
  return { events: [], filesScanned: [] };
}
```

**统一 LLM 适配**

```ts
// src/core/llm.ts
export interface LLMClient {
  summarizeDaily(input: string): Promise<string>;
  extractKnowledge(input: string): Promise<string>;
}
// 提供 OpenAIClient / AnthropicClient / GenericOpenAIClient 三个实现
```

# 配置与运行

* CLI 配置优先级：`flags` > `env` > `~/.daily-ai/config.yml`
* `daily-ai config set --provider openai --base-url https://api.openai.com/v1 --api-key sk-...`
* 运行：`daily-ai analyze today --out ./reports`

# 安全与隐私

* **本地优先**：所有解析在本地进行，只在调用 LLM 时传输最小化上下文（可选 `--offline` 仅做启发式摘要，不出网）。
* **脱敏**：内置 `sensitivePatterns`（参考 Codex 社区配置）并允许你扩展自定义规则。([GitHub][3])

---

# 本地聊天/会话历史：获取与解析（你关心的重点）

> 结论：两边都能在**本地**找到会话记录（多为 JSONL），可直接解析**当天**内容。

### Claude Code

* 常见位置与形态：

  * macOS：`~/.claude/projects/<project-hash>/<session-id>.jsonl`（按项目分组，JSONL） ([Reddit][5])
  * 有人总结：macOS 安装后会在用户目录 `~/.claude` 保存会话，按项目组织、JSONL 格式（第三方工具说明）。([Hacker News][2])
  * 若你结合了 **SpecStory** 工作流：项目目录下 `.specstory/history/` 也会保存对话/过程（Markdown/JSONL）。([GitHub][6])
* 其他与桌面端相关的参考（用于定位配置/日志，不一定包含会话本体）：

  * Claude Desktop 的 MCP 配置：`~/Library/Application Support/Claude/claude_desktop_config.json`；日志：`~/Library/Logs/Claude`。([Model Context Protocol][7])
  * Claude Code 企业策略设置的系统路径（仅管理员/托管场景）：macOS `/Library/Application Support/ClaudeCode/managed-settings.json`。([Anthropic][8])

**解析建议**：按行读取 JSONL，识别 `timestamp/role/content` 字段；根据文件名或 event 内部的 `sessionId/project` 做聚合；以本地时区（Asia/Taipei）过滤当天 00:00–24:00。

### OpenAI Codex（CLI 与 VS Code 扩展）

* **Codex CLI**

  * 配置常见在：`~/.codex/config.toml`（或 `config.json`）([GitHub][9])
  * 会话日志：社区与文章提到 **JSONL** 形式保存在 `~/.codex/sessions/`（亦有历史在 `~/.codex/history/` 的反馈）。([DEV Community][10])
* **Codex VS Code 扩展**

  * 扩展自己的存储通常在 VS Code 的 `globalStorage` 目录：
    macOS `~/Library/Application Support/Code/User/globalStorage/`（每个扩展一个子目录）；但是否**真正落盘聊天历史**由扩展实现决定，社区有“本地历史未显示/未持久化”的讨论与已知问题。([Stack Overflow][4])
  * 扩展市场/帮助页（确认扩展 Id/形态）：OpenAI Codex（VS Code 扩展），以及官方 IDE 入口。([Visual Studio Marketplace][11])

**解析建议**：优先读 `~/.codex/sessions/**.jsonl` / `~/.codex/history/**.jsonl`；若找不到，再尝试对应扩展的 `globalStorage` 子目录（但不要依赖 VS Code 的全局 SQLite `state.vscdb`，那是扩展状态，不保证保存聊天全文）。([mattreduce][12])

---

# 你可以立即做的三步

1. **用 oclif 生成骨架**

我已经生成了

（`oclif` TS 模板是现成 starter，满足“基于现有 starter 开发”的要求。） ([Oclif][1])

2. **实现 `sources scan`**

   * 枚举并打印这些路径是否存在、匹配的文件数（便于验证环境）：

     * `~/.claude/projects/**/**/*.jsonl`、`**/.specstory/history/**`
     * `~/.codex/sessions/**.jsonl`、`~/.codex/history/**.jsonl`
     * `~/Library/Application Support/Code/User/globalStorage/**openai*codex*/*`（尽量不解析 SQLite）

3. **跑一次 `analyze today`**

   * 使用 `--provider openai --base-url <你的端点> --api-key <密钥>` 进行 LLM 总结；或 `--provider anthropic` 直连 Claude 模型。

---

[1]: https://oclif.github.io/docs/introduction/?utm_source=chatgpt.com "Introduction | oclif: The Open CLI Framework"
[2]: https://news.ycombinator.com/item?id=44459376 "Show HN: Claude Code History Viewer for macOS | Hacker News"
[3]: https://github.com/openai/codex/issues/2080 "Add Chat Session Management: chat list, chat resume or --restore-session · Issue #2080 · openai/codex · GitHub"
[4]: https://stackoverflow.com/questions/63335358/where-do-vscode-extensions-store-their-data-files?utm_source=chatgpt.com "Where do VSCode extensions store their data files?"
[5]: https://www.reddit.com/r/ClaudeAI/comments/1lragx6/how_to_preserve_claude_code_conversation_history/ "How to preserve Claude Code conversation history after moving project folder? : r/ClaudeAI"
[6]: https://github.com/anthropics/claude-code/issues/209?utm_source=chatgpt.com "Markdown Conversation History Tracking Feature Request"
[7]: https://modelcontextprotocol.io/quickstart/user?utm_source=chatgpt.com "Connect to Local MCP Servers"
[8]: https://docs.anthropic.com/en/docs/claude-code/settings?utm_source=chatgpt.com "Claude Code settings"
[9]: https://github.com/openai/codex?utm_source=chatgpt.com "openai/codex: Lightweight coding agent that runs in your ..."
[10]: https://dev.to/shinshin86/no-resume-in-codex-cli-so-i-built-one-quickly-continue-with-codex-history-list-50be?utm_source=chatgpt.com "No “resume” in Codex CLI, so I built one: quickly “continue” ..."
[11]: https://marketplace.visualstudio.com/items?itemName=openai.chatgpt&utm_source=chatgpt.com "Codex – OpenAI's coding agent"
[12]: https://mattreduce.com/posts/vscode-global-state/?utm_source=chatgpt.com "Exploring VS Code's Global State - mattreduce"
