# 知识库 - 2025-09-13

## 🐛 构建/编译问题

### TypeScript 类型错误
**现象**：
```
error TS2304: Cannot find name 'RequestInit'
```

**根因**：缺少 DOM types 声明

**解决**：
```bash
npm install @types/node --save-dev
# 或在 tsconfig.json 添加
{
  "compilerOptions": {
    "lib": ["dom", "es2020"]
  }
}
```

**踩坑提示**：Node.js 环境下需要明确引入 DOM types

---

## 🔧 工具配置问题

### ESLint 配置冲突
**现象**：
在实现 fs.ts 文件时出现了多个 ESLint 错误，包括：
1. Import order 不一致
2. readline.createInterface 参数顺序问题
3. 使用 'utf-8' 而不是 'utf8' 编码
4. 缺少空行

**根因**：代码风格不符合项目 ESLint 配置要求

**解决**：
1. 统一调整 import 顺序：
```ts
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { glob } from 'fast-glob'
```

2. 修复 readline.createInterface 参数顺序：
```ts
const rl = readline.createInterface({ 
  crlfDelay: Infinity,
  input: fs.createReadStream(file)
})
```

3. 修复文件编码问题：
```ts
await fs.promises.writeFile(filePath, content, 'utf8')
```

4. 在 expandTilde 函数中添加空行：
```ts
export function expandTilde(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2))
  }

  return filePath
}
```

**通用规则**：
1. 保持 import 顺序一致：node 内置模块 -> 第三方库 -> 本地文件
2. 按照项目 ESLint 规则格式化代码
3. 在函数逻辑分支间添加空行以提高可读性
4. 使用 'utf8' 而不是 'utf-8' 作为编码参数

---

## 📦 依赖管理

### 版本兼容性问题
**现象**：
在添加 dayjs 时提示"Already up to date"，但实际上缺少 timezone 插件

**根因**：dayjs 的 timezone 插件需要单独导入

**解决**：
```ts
import dayjs, { Dayjs } from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)
```

**踩坑提示**：某些库的功能可能需要额外导入插件，不能仅依赖主模块

---

## 📁 文件结构问题

### 文件结构不符合预期
**现象**：
项目初始结构包含示例的 hello 命令，但不符合需求文档中定义的命令结构

**根因**：项目初始化时使用了默认的 oclif 模板

**解决**：
1. 删除示例文件：
```bash
rm -rf src/commands/hello test/commands/hello
```

2. 创建符合需求的目录结构：
```bash
mkdir -p src/commands/analyze src/commands/config src/commands/sources src/core src/sources src/prompts src/utils
```

**通用规则**：根据需求文档初始化项目结构，删除不必要的示例代码

---

## 📝 代码实现问题

### LLM 客户端实现问题
**现象**：
在 GenericOpenAIClient 中引用了未定义的 config 变量

**根因**：在类方法中直接使用了构造函数参数，而不是类属性

**解决**：
1. 在类中添加 config 属性
2. 在构造函数中保存 config
3. 在方法中使用 this.config 替代原始的 config 参数

```ts
export class GenericOpenAIClient implements LLMClient {
  private client: OpenAI
  private config: LLMConfig

  constructor(config: LLMConfig) {
    this.config = config
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl
    })
  }

  // 在方法中使用 this.config.model 替代原始的 config 参数
}
```

**踩坑提示**：在类中使用构造函数参数时，需要明确将其保存为类属性才能在方法中访问

---

## 🧠 设计决策问题

### LLM 客户端接口设计
**现象**：
需要支持多个 LLM 提供商（OpenAI、Anthropic、通用提供商）

**根因**：需求要求支持多个 LLM 提供商，需要统一接口

**解决**：
1. 定义 LLMClient 接口：
```ts
export interface LLMClient {
  summarizeDaily(input: string, date: string): Promise<string>
  extractKnowledge(input: string, date: string): Promise<string>
}
```

2. 实现具体的客户端类：
```ts
export class OpenAILLMClient implements LLMClient { /*...*/ }
export class AnthropicLLMClient implements LLMClient { /*...*/ }
export class GenericOpenAIClient implements LLMClient { /*...*/ }
```

3. 使用配置创建相应的客户端实例

**通用规则**：
1. 对于多个提供者，先定义统一接口
2. 为每个提供者实现接口
3. 使用工厂模式根据配置创建实例

---

## 🧪 测试问题

### 单元测试缺失
**现象**：
项目中没有实现单元测试，尽管测试框架已经配置

**根因**：项目实现过程中尚未到达测试阶段

**解决**：
1. 为每个模块创建测试文件：
```bash
mkdir -p test/utils test/core test/sources test/commands
```

2. 为每个功能实现单元测试，例如：
```ts
// test/utils/fs.test.ts
import { test } from '@oclif/test'
import { readJsonl, findFiles } from '../../src/utils/fs.js'

describe('fs utils', () => {
  test.it('reads JSONL file', async () => {
    // 测试 readJsonl 功能
  })
})
```

**踩坑提示**：尽早编写单元测试以确保代码质量

---

## 🛠️ 工程实践

### 代码实现与需求文档同步
**现象**：
需要确保实现的代码符合原始需求文档描述

**根因**：需求文档中详细描述了命令结构、目录结构和功能要求

**解决**：
1. 严格遵循需求文档中的目录结构要求
2. 实现所有需求文档中定义的命令
3. 使用需求文档中指定的技术栈（oclif, fast-glob, dayjs 等）

**通用规则**：实现过程中定期检查需求文档，确保所有要求都被满足

---

## 🧹 代码规范问题

### 代码风格问题
**现象**：
初始实现的代码需要调整以符合 ESLint 要求

**根因**：代码编写时需要同时关注功能实现和代码风格

**解决**：
1. 在编辑器中集成 ESLint 插件
2. 在保存时自动格式化代码
3. 使用 Prettier 保持代码风格统一

**踩坑提示**：尽早配置代码规范工具，保持代码风格一致性

---

## 📐 图结构检索问题（新增）

### 子图提取器实现
**现象**：
需要从知识图谱中提取相关子图用于特定查询

**根因**：需要实现一个支持多种扩展策略的子图提取机制

**解决**：
```python
class SubgraphExtractor:
    """子图提取器"""
    
    def __init__(self, knowledge_graph: nx.MultiDiGraph):
        self.kg = knowledge_graph
        logger.info("初始化子图提取器")
    
    def extract_subgraph(self, seed_nodes: List[str], 
                        expansion_strategy: str = 'bfs',
                        max_nodes: int = 50,
                        hop_limit: int = 2) -> nx.MultiDiGraph:
        if expansion_strategy == 'bfs':
            subgraph_nodes = self._bfs_expansion(seed_nodes, max_nodes, hop_limit)
        elif expansion_strategy == 'dfs':
            subgraph_nodes = self._dfs_expansion(seed_nodes, max_nodes, hop_limit)
        elif expansion_strategy == 'similarity':
            subgraph_nodes = self._similarity_expansion(seed_nodes, max_nodes)
        else:
            logger.warning(f"未知的扩展策略: {expansion_strategy}, 使用BFS")
            subgraph_nodes = self._bfs_expansion(seed_nodes, max_nodes, hop_limit)
        
        return self.kg.subgraph(subgraph_nodes).copy()
    
    def _bfs_expansion(self, seed_nodes: List[str], max_nodes: int, hop_limit: int) -> Set[str]:
        from collections import deque
        
        visited = set()
        queue = deque()
        
        # 初始化队列
        for seed in seed_nodes:
            if seed in self.kg.nodes():
                queue.append((seed, 0))  # (节点, 跳数)
                visited.add(seed)
        
        result_nodes = set(visited)
        
        while queue and len(result_nodes) < max_nodes:
            current_node, hops = queue.popleft()
            
            if hops >= hop_limit:
                continue
            
            # 探索邻居
            for neighbor in self.kg.neighbors(current_node):
                if neighbor not in visited and len(result_nodes) < max_nodes:
                    visited.add(neighbor)
                    result_nodes.add(neighbor)
                    queue.append((neighbor, hops + 1))
        
        return result_nodes
```

**通用规则**：
1. 对于图结构检索，通常需要定义种子节点和扩展策略
2. 实现多种扩展算法（BFS、DFS）以适应不同场景
3. 设置合理的限制条件（最大节点数、跳数限制）防止过度扩展
4. 记录详细的日志以便调试和分析

**踩坑提示**：
1. 注意检查种子节点是否存在于图中
2. 不同扩展策略可能导致完全不同的子图结果
3. 子图提取可能影响性能，建议对大型图做性能测试
4. 扩展策略可以扩展为插件式架构，便于未来添加新策略

---