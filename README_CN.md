# Daily Vibe

[English](README.md) | **中文**

Daily Vibe 是一款强大的 CLI 工具，可以分析你在 Claude Code 和 Codex CLI 中的编程会话，生成富有洞察力的日报和知识提取。通过 AI 驱动的分析，将你的开发活动转化为有意义的见解。

## ✨ 功能特色

- 📊 **日报生成**: 生成全面的开发日报摘要
- 🧠 **知识提取**: 从编程会话中提取问题、解决方案和最佳实践
- 🔒 **数据脱敏**: 自动脱敏敏感信息（API 密钥、密码等）
- 🔄 **分块分析**: 通过并行处理处理大数据集以提高性能
- 🌐 **多 LLM 支持**: 兼容 OpenAI、Anthropic Claude 和任何 OpenAI 兼容的 API
- 📁 **多数据源支持**: 支持 Claude Code、Codex CLI 和 VS Code 扩展
- 🌍 **时区支持**: 具有时区感知的精确时间过滤

## 🚀 快速开始

### 安装

```bash
# 通过 npm 全局安装
npm install -g daily-vibe

# 或通过 yarn 全局安装
yarn global add daily-vibe

# 或通过 pnpm 全局安装
pnpm add -g daily-vibe
```

### 验证安装

```bash
# 检查是否正确安装
daily-vibe --version

# 获取帮助
daily-vibe --help
```

### 基本使用

1. **配置你的 LLM 提供商：**
```bash
# OpenAI 配置
daily-vibe config set --provider openai --api-key sk-你的API密钥

# Anthropic Claude 配置
daily-vibe config set --provider anthropic --api-key sk-ant-你的API密钥

# 自定义 OpenAI 兼容 API（如阿里云灵积）
daily-vibe config set --provider generic --base-url https://dashscope.aliyuncs.com/compatible-mode/v1 --api-key sk-你的API密钥
```

2. **分析今日会话：**
```bash
daily-vibe analyze today --out ./reports
```

3. **分析日期范围：**
```bash
daily-vibe analyze range --from 2025-01-01 --to 2025-01-07 --out ./reports
```

## 📖 命令参考

### 🔧 配置

#### 设置 LLM 配置
```bash
daily-vibe config set [选项]

选项:
  -p, --provider <提供商>      LLM 提供商 (openai|anthropic|generic)
  -k, --api-key <密钥>        提供商的 API 密钥
  -u, --base-url <网址>       OpenAI 兼容 API 的基础 URL
  -m, --model <模型>          要使用的模型名称
  -s, --show                  显示当前配置
```

**示例：**
```bash
# 配置 OpenAI
daily-vibe config set --provider openai --api-key sk-proj-abc123... --model gpt-4

# 配置 Anthropic
daily-vibe config set --provider anthropic --api-key sk-ant-api03-abc123...

# 配置阿里云灵积
daily-vibe config set --provider generic \
  --base-url https://dashscope.aliyuncs.com/compatible-mode/v1 \
  --api-key sk-abc123... \
  --model qwen-turbo

# 显示当前配置
daily-vibe config set --show
```

### 📊 分析

#### 分析今日会话
```bash
daily-vibe analyze today [选项]

选项:
  -o, --out <目录>            报告输出目录
  -j, --json                  以 JSON 格式输出结果
  -p, --provider <提供商>     覆盖 LLM 提供商
  -m, --model <模型>         覆盖模型名称
  --no-redact                 禁用内容脱敏
```

**示例：**
```bash
# 基本分析
daily-vibe analyze today

# 保存报告到目录
daily-vibe analyze today --out ./reports

# 获取 JSON 输出
daily-vibe analyze today --json

# 禁用脱敏用于调试
daily-vibe analyze today --no-redact --out ./debug-reports
```

#### 分析日期范围
```bash
daily-vibe analyze range [选项]

选项:
  -f, --from <日期>           开始日期 (YYYY-MM-DD)
  -t, --to <日期>             结束日期 (YYYY-MM-DD)
  -o, --out <目录>            报告输出目录
  -j, --json                  以 JSON 格式输出结果
  -p, --provider <提供商>     覆盖 LLM 提供商
  -m, --model <模型>         覆盖模型名称
  --no-redact                 禁用内容脱敏
```

**示例：**
```bash
# 分析上周
daily-vibe analyze range --from 2025-01-01 --to 2025-01-07 --out ./reports

# 使用自定义日期格式分析
daily-vibe analyze range --from "2025-01-01" --to "today" --out ./reports

# 使用不同模型进行分析
daily-vibe analyze range --from yesterday --to today --model gpt-4-turbo --out ./reports
```

### 📁 数据源

#### 扫描可用数据源
```bash
daily-vibe sources scan
```

此命令将显示：
- Claude Code 项目文件 (`~/.claude/projects/**/*.jsonl`)
- Codex CLI 会话文件 (`~/.codex/sessions/**/*.jsonl`)
- Codex CLI 历史文件 (`~/.codex/history/**/*.jsonl`)
- VS Code Codex 扩展数据
- SpecStory 历史文件 (`**/.specstory/history/**`)

### 🔒 数据脱敏

#### 测试脱敏规则
```bash
daily-vibe redact test [文本]

选项:
  -f, --file <文件>           测试文件的脱敏
```

**示例：**
```bash
# 用文本测试
daily-vibe redact test "我的 API 密钥是 sk-proj-abc123xyz"

# 用文件测试
daily-vibe redact test --file ./敏感文件.txt
```

## 📄 报告结构

运行分析时，Daily Vibe 会生成三种类型的文件：

### 📋 日报 (`daily.md`)
- **概览**: 会话数量、事件、识别的问题
- **关键产出**: 主要成就和交付物
- **测试结果**: 成功/失败统计
- **待办事项**: 待处理任务和优先级

### 🧠 知识库 (`knowledge.md`)
- **构建/编译问题**: TypeScript 错误、依赖问题
- **工具配置**: ESLint、测试设置、环境问题
- **代码实现**: 设计模式、最佳实践
- **问题-解决方案对**: 按技术领域分类

### 📊 原始数据 (`data.json`)
- JSON 格式的完整分析结果
- 带时间戳的会话详情
- 事件级信息
- 统计信息和元数据

## ⚙️ 配置

Daily Vibe 使用 cosmiconfig 进行配置管理。配置会自动从以下位置加载：

- `package.json` (`dailyVibe` 属性)
- `.dailyviberc.json`
- `.dailyviberc.js`
- `dailyvibe.config.js`

### 配置文件示例 (`.dailyviberc.json`)

```json
{
  "llm": {
    "provider": "openai",
    "apiKey": "sk-proj-你的API密钥",
    "model": "gpt-4",
    "baseUrl": "https://api.openai.com/v1"
  },
  "timezone": "Asia/Shanghai",
  "outputDir": "./reports",
  "redact": {
    "enabled": true,
    "patterns": [
      "sk-[a-zA-Z0-9]{20,}",
      "ghp_[a-zA-Z0-9]{36}",
      "[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}"
    ]
  }
}
```

## 🔒 安全与隐私

Daily Vibe 包含内置数据脱敏功能以保护敏感信息：

- **API 密钥**: OpenAI、GitHub、AWS 等
- **令牌**: JWT 令牌、访问令牌
- **URL**: 内部 URL、数据库连接
- **IP 地址**: IPv4 和 IPv6 地址
- **电子邮件地址**: 个人和工作邮箱
- **文件路径**: 可能包含用户名的系统路径

你可以在配置文件中自定义脱敏模式，或使用 `--no-redact` 完全禁用脱敏。

## 🧩 支持的数据源

### Claude Code
- 项目会话文件: `~/.claude/projects/**/*.jsonl`
- 所有对话历史和工具使用记录

### Codex CLI
- 活动会话: `~/.codex/sessions/**/*.jsonl`
- 对话历史: `~/.codex/history/**/*.jsonl`

### SpecStory
- 历史文件: `**/.specstory/history/**/*.{md,jsonl}`
- Markdown 对话日志

### VS Code 扩展
- VS Code 全局存储中的 Codex/ChatGPT 扩展数据
- 平台特定路径 (macOS、Linux、Windows)

## 🎯 使用场景

- **每日站会**: 生成全面的开发摘要
- **知识管理**: 构建可搜索的解决方案数据库
- **代码评审准备**: 识别关键变更和决策
- **学习跟踪**: 监控技能发展和问题解决模式
- **团队分享**: 记录最佳实践和常见陷阱
- **项目文档**: 自动生成开发日志

## 🛠️ 开发

如果你想为 Daily Vibe 贡献代码或从源码运行：

### 前置要求
- Node.js >= 18.0.0
- pnpm（推荐）或 npm

### 从源码设置
```bash
git clone https://github.com/AoWangg/daily-vibe.git
cd daily-vibe
pnpm install
pnpm run build

# 本地开发链接
npm link
```

### 测试
```bash
pnpm test
pnpm run lint
```

## 🔄 更新

保持 Daily Vibe 为最新版本：

```bash
# 更新到最新版本
npm update -g daily-vibe

# 检查当前版本
daily-vibe --version
```

## 🗑️ 卸载

移除 Daily Vibe：

```bash
# 全局卸载
npm uninstall -g daily-vibe

# 或使用 yarn
yarn global remove daily-vibe

# 或使用 pnpm
pnpm remove -g daily-vibe
```

## 📝 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。对于重大更改，请先开启 issue 讨论你想要更改的内容。

## 🐛 问题反馈

如果你遇到任何问题或有功能请求，请在 [GitHub Issues](https://github.com/AoWangg/daily-vibe/issues) 中提交。

## 🙏 致谢

- 基于 [oclif](https://oclif.io/) 构建 - 开放式 CLI 框架
- 由 [OpenAI](https://openai.com/) 和 [Anthropic](https://anthropic.com/) API 驱动
- 支持 [Claude Code](https://claude.ai/code) 和 [Codex CLI](https://github.com/microsoft/vscode-codex) 会话