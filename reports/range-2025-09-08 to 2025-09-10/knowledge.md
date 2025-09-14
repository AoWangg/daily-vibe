# 知识库 - 2025-09-08 to 2025-09-10

---

## 🎨 前端 UI 开发

### React 组件样式调整 - 钱包绑定弹窗
**现象**：  
需要将 `BindWallet.tsx` 组件的 UI 修改为匹配设计图样式。需要调整的元素包括：
- 修改弹窗标题为 "Confirm wallet binding"
- 调整描述文本内容
- 添加钱包地址显示区域
- 添加链接箭头和用户账户信息
- 修改按钮样式和布局

**根因分析**：  
通过阅读现有代码和对比设计图，发现需要：
1. 更新 Chakra UI 组件导入，添加 `CloseButton`
2. 修改 ModalHeader 部分的标题样式和布局
3. 重构 ModalBody 部分，添加钱包地址显示和用户账户信息
4. 重构 ModalFooter 部分，修改按钮样式和布局
5. 清理不必要的导入和组件，如 `LightMode` 和 `Divider`

**解决步骤**：
```bash
# 1. 确保安装必要的依赖
npm install @chakra-ui/react @chakra-ui/icons
```

```tsx
// 2. 修改 BindWallet.tsx 组件
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
  useDisclosure,
  Flex,
  HStack,
  Icon,
  Box,
  CloseButton,
} from '@chakra-ui/react'

// ... 其他导入保持不变

export default function BindWallet({ buttonText = 'Bind Wallet', size = 'md' }: BindWalletProps) {
  // ... 状态和钩子保持不变

  return (
    <>
      <Button
        onClick={handleClick}
        isLoading={loading}
        size={size}
        w="100%"
        bg="black"
        color="white"
      >
        {buttonText}
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent borderRadius="16px" px={6} py={6} maxW="400px">
          <ModalHeader p={0} mb={4} position="relative">
            <Text fontSize="xl" fontWeight="600" color="gray.800" textAlign="center">
              Confirm wallet binding
            </Text>
            <CloseButton
              position="absolute"
              right={0}
              top={0}
              onClick={onClose}
              size="md"
              color="gray.400"
            />
          </ModalHeader>
          
          <ModalBody p={0} mt={2}>
            <Text fontSize="sm" color="gray.600" mb={6} textAlign="center" lineHeight={1.5}>
              You&apos;re binding this wallet to your account. Sign a message to confirm (no gas
              fee). Switch wallets in your wallet extension if needed.
            </Text>
            
            {/* Wallet Address Section */}
            <Box mb={4}>
              <HStack spacing={3} align="center">
                <Icon as={WalletIcon} boxSize={5} color="gray.400" />
                <Box
                  bg="gray.50"
                  border="1px solid"
                  borderColor="gray.200"
                  px={3}
                  py={2}
                  borderRadius="8px"
                  flex={1}
                >
                  <Text fontFamily="mono" fontSize="sm" color="gray.800">
                    {formatAddress(address || '')}
                  </Text>
                </Box>
                {address ? <CopyButton text={address} /> : null}
              </HStack>
            </Box>
            
            {/* Linking Section */}
            <Flex align="center" justify="center" mb={4}>
              <Box w="16px" h="16px" color="gray.400">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                </svg>
              </Box>
              <Text fontSize="xs" color="gray.500" mx={3}>
                linking
              </Text>
              <Box w="16px" h="16px" color="gray.400">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                </svg>
              </Box>
            </Flex>

            {/* User Account Section */}
            <HStack spacing={3} align="center" mb={0}>
              <ImageWithFallback
                alt="User Avatar"
                src={frontierUserInfo?.picture || ''}
                w={10}
                h={10}
                borderRadius="full"
              />
              <Box>
                <Text fontSize="md" color="gray.800" fontWeight="500">
                  {frontierUserInfo?.name || 'sarahkim'}
                </Text>
                <Text fontSize="sm" color="gray.500">
                  {frontierUserInfo?.email || 'sarahkim@example.com'}
                </Text>
                {frontierUserInfo?.developer_id && (
                  <Text fontSize="sm" color="gray.400">
                    ID: {frontierUserInfo.developer_id}
                  </Text>
                )}
              </Box>
            </HStack>
          </ModalBody>
          
          <ModalFooter p={0} mt={6}>
            <HStack w="100%" spacing={3}>
              <Button 
                onClick={onClose} 
                variant="outline"
                borderRadius="full"
                flex={1}
                h="48px"
                borderColor="gray.300"
                color="gray.700"
                _hover={{ bg: 'gray.50' }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmBind}
                isLoading={loading}
                bg="gray.800"
                color="white"
                borderRadius="full"
                flex={1}
                h="48px"
                _hover={{ bg: 'gray.700' }}
              >
                Sign & bind
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}
```

**踩坑提示**：
1. 注意保持代码格式正确，避免 ESLint 错误，如：
   - 使用正确的 HTML 实体（如 `&apos;` 而不是 `'`）
   - 保持 JSX 元素的正确换行和缩进
   - 移除不必要的空白行

2. 确保正确导入和使用 Chakra UI 组件：
   - 使用 `Box` 和 `Flex` 而不是直接的 `div` 元素
   - 使用 Chakra UI 的 `CloseButton` 而不是自定义关闭按钮

3. 测试不同屏幕尺寸下的显示效果：
   - 确保 `maxW="400px"` 在移动端和桌面端都显示良好
   - 检查响应式设计是否需要额外的样式调整

**通用规则**：
1. **UI 组件开发 Checklist**：
   - [ ] 与设计图逐像素对比
   - [ ] 使用设计系统中定义的间距和颜色变量
   - [ ] 保持组件结构清晰，按功能分块
   - [ ] 使用合适的注释标记不同部分
   - [ ] 确保响应式设计
   - [ ] 测试交互状态（hover, active, loading）

2. **Chakra UI 最佳实践**：
   - 使用 `HStack` 和 `VStack` 而不是直接使用 flex
   - 使用 `Box` 和 `Flex` 而不是原生 div
   - 使用内置的 spacing 系统（如 `mb={4}` 而不是 `margin-bottom: 1rem`）
   - 使用主题中的颜色而不是硬编码颜色值
   - 使用 `useDisclosure` 管理模态框状态

3. **代码维护建议**：
   - 保持组件单一职责，避免过于复杂的组件
   - 使用 TypeScript 接口定义明确的 props 类型
   - 使用 React Hooks 管理状态
   - 保持 JSX 结构清晰易读
   - 定期清理未使用的导入和组件

---

## 📦 依赖管理

### `useCompletion` 导入路径错误
**现象**：
```
Module not found: Package path ./react is not exported from package /Users/aowang/code/story-generate/node_modules/ai
```

**根因分析**：  
在 AI SDK v5 中，`useCompletion` 的导入方式发生了变化。它不再通过 `'ai/react'` 导入，而是直接从 `'ai'` 或新的 `'@ai-sdk/react'` 包导入。

**解决步骤**：
```bash
# 安装正确的依赖
npm install @ai-sdk/react
```

```tsx
// 修改导入路径
- import { useCompletion } from 'ai/react';
+ import { useCompletion } from '@ai-sdk/react';
```

**踩坑提示**：
1. 注意查看 `ai` 包的 `package.json` 中的 `exports` 字段，确认可用的导出路径
2. 新版本 SDK 的 React 相关功能已拆分为单独的包

---

### `ai` 包 API 方法变更
**现象**：
```
Attempted import error: 'OpenAIStream' is not exported from 'ai'
Attempted import error: 'StreamingTextResponse' is not exported from 'ai'
```

**根因分析**：  
AI SDK v5 彻底重构了 API，`OpenAIStream` 和 `StreamingTextResponse` 被移除，改为使用 `streamText` 函数。

**解决步骤**：
```bash
# 安装 OpenAI 提供商包
npm install @ai-sdk/openai
```

```tsx
// 修改 API 路由代码
- import { OpenAI } from 'openai';
- import { OpenAIStream, StreamingTextResponse } from 'ai';
+ import { openai } from '@ai-sdk/openai';
+ import { streamText } from 'ai';

export async function POST(req: Request) {
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: 'You are a creative storyteller...',
    prompt: storyPrompt,
    maxOutputTokens: 800,
    temperature: 0.7,
  });
  
  return result.toTextStreamResponse();
}
```

**踩坑提示**：
1. 升级前务必查看官方迁移指南
2. 注意参数命名变化：`maxTokens` → `maxOutputTokens`

---

### `generateImage` 不存在
**现象**：
```
Attempted import error: 'generateImage' is not exported from 'ai'
```

**根因分析**：  
AI SDK v5 中没有 `generateImage` 函数，它是一个不存在的 API。

**解决步骤**：
```tsx
// 回退到原始 OpenAI 客户端实现
- import { openai } from '@ai-sdk/openai';
- import { generateImage } from 'ai';
+ import { OpenAI } from 'openai';
+
+ const openai = new OpenAI({
+   apiKey: process.env.OPENAI_API_KEY,
+ });

export async function POST(req: Request) {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: imagePrompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
    response_format: 'url',
  });
  
  const imageUrl = response.data?.[0]?.url;
  return Response.json({ imageUrl });
}
```

**踩坑提示**：
1. 不要盲目相信 IDE 的自动导入功能
2. 检查官方文档确认 API 是否存在
3. 对于图像生成等特殊功能，保持使用原始 OpenAI SDK 更可靠

---

## 🧱 构建/编译问题

### TypeScript 类型错误
**现象**：
```
Type error: Argument of type '{ model: LanguageModelV2; ... }' is not assignable to parameter of type 'CallSettings & Prompt & { model: LanguageModel; ... }'
```

**根因分析**：  
参数命名变化，`maxTokens` 在 AI SDK v5 中已更名为 `maxOutputTokens`。

**解决步骤**：
```tsx
export async function POST(req: Request) {
  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: 'You are a creative storyteller...',
    prompt: storyPrompt,
-   maxTokens: 800,
+   maxOutputTokens: 800,
    temperature: 0.7,
  });
}
```

**通用规则**：
1. 升级 SDK 后注意参数命名变化
2. 使用 TypeScript 可以帮助发现这些 API 变化
3. 保持参数命名与官方示例一致

---

### 可选链访问错误
**现象**：
```
Type error: 'response.data' is possibly 'undefined'
```

**根因分析**：  
TypeScript 严格模式下对可能为 `undefined` 的值进行属性访问会报错。

**解决步骤**：
```tsx
- const imageUrl = response.data[0]?.url;
+ const imageUrl = response.data?.[0]?.url;
```

**踩坑提示**：
1. 使用可选链操作符 `?.` 保证类型安全
2. 对数组使用可选索引访问 `?[index]`
3. 保持 TypeScript 严格模式以发现潜在问题

---

## 🧼 项目清理

### 依赖冲突问题
**现象**：
```
Critical dependency: the request of a dependency is an expression
```

**根因分析**：  
Supabase 相关依赖存在潜在兼容性问题，但不影响实际运行。

**解决步骤**：
```bash
# 清理并重新安装依赖
rm -rf node_modules package-lock.json
npm install --force
```

**通用规则**：
1. 遇到奇怪的依赖问题时，优先清理 node_modules
2. 使用 `--force` 参数强制重新安装
3. 定期清理缓存：`npm cache clean --force`

---

## 🌐 API 流式输出问题

### 流式输出未启用
**现象**：  
前端无法实现流式展示生成的故事内容

**根因分析**：
1. API端点 `/api/generate` 虽然启用了流式响应，但返回格式不符合前端处理需求
2. 前端使用了 `res.json()` 来处理响应，这是为非流式响应设计的
3. 需要使用Server-Sent Events (SSE)格式来实现流式传输

**解决步骤**：
```typescript
// 修改后的API代码
export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    
    // ...其他代码保持不变...
    
    // 请求流式完成
    const response = await openai.chat.completions.create({
      model: "qwen-plus",
      stream: true,  // 启用流式输出
      // ...其他配置保持不变...
    });

    // 创建ReadableStream处理流式响应
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              // 发送每个片段
              const data = JSON.stringify({ story: content });
              controller.enqueue(`data: ${data}\n\n`);
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    // ...错误处理保持不变...
  }
}
```

**踩坑提示**：
1. 确保API返回正确的SSE格式，包括`text/event-stream`内容类型和正确的分隔符
2. 需要处理流式响应的每个chunk并提取内容
3. 要添加适当的错误处理来捕获流式传输中的问题

---

## 🖥️ 前端展示问题

### 流式内容无法正确展示
**现象**：  
API已经启用了流式输出，但前端无法逐步展示生成的内容

**根因分析**：
1. 前端代码仍然使用 `res.json()` 来处理响应，这适用于一次性返回全部内容
2. 没有处理流式响应的逻辑来逐步更新UI
3. 没有使用适当的Markdown渲染器来展示Markdown格式的内容

**解决步骤**：
```tsx
// 修改后的前端流式处理代码
const onSubmit = async (prompt: string, language: string) => {
  // ...其他代码保持不变...

  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, language }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error("Failed to generate story");
    }

    // 处理流式响应
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let fullStoryText = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.story) {
                fullStoryText += data.story;
                setCompletion(fullStoryText);
              }
            } catch (e) {
              // 跳过格式错误的JSON
            }
          }
        }
      }
    }

    // ...后续处理保持不变...
  } catch (err) {
    // ...错误处理保持不变...
  }
};
```

**通用规则**：
1. 对于流式响应，前端需要使用ReadableStream和TextDecoder来处理
2. 应该逐步更新UI，而不是等待全部内容返回
3. 使用专门的Markdown库（如react-markdown）来渲染Markdown内容

---

## 📄 Markdown渲染问题

### Markdown内容无法正确渲染
**现象**：  
生成的Markdown内容直接作为纯文本展示，没有应用Markdown格式

**根因分析**：
1. 没有使用专门的Markdown渲染库
2. 自定义的Markdown解析函数不够完善
3. 需要安装和配置适当的Markdown渲染组件

**解决步骤**：
```bash
# 安装react-markdown库
npm install react-markdown
```

```tsx
// 使用react-markdown渲染Markdown内容
import ReactMarkdown from "react-markdown";

// ...其他代码保持不变...

{completion ? (
  <ReactMarkdown 
    components={{
      h1: ({children}) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
      h2: ({children}) => <h2 className="text-xl font-semibold mb-3 mt-6">{children}</h2>,
      h3: ({children}) => <h3 className="text-lg font-semibold mb-2 mt-4">{children}</h3>,
      p: ({children}) => <p className="mb-4 leading-relaxed">{children}</p>,
      strong: ({children}) => <strong className="font-bold">{children}</strong>,
      em: ({children}) => <em className="italic">{children}</em>,
      blockquote: ({children}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic mb-4">{children}</blockquote>,
    }}
  >
    {completion}
  </ReactMarkdown>
)}
```

**踩坑提示**：
1. 不要尝试自己实现Markdown解析器，使用成熟的库更可靠
2. 确保为不同Markdown元素配置适当的样式类
3. 使用dangerouslySetInnerHTML时要特别小心，它可能带来XSS风险

---

## 🧑‍🤝‍🧑 认证授权问题

### 未登录用户可以生成故事
**现象**：  
未登录用户可以直接生成故事，没有进行登录验证

**根因分析**：
1. 没有检查用户登录状态的逻辑
2. 故事生成功能应该限制为仅登录用户可用
3. 需要添加登录验证和引导登录的功能

**解决步骤**：
```tsx
// 添加登录状态检查
const [isLoggedIn, setIsLoggedIn] = useState(false);

useEffect(() => {
  checkLoginStatus();
}, []);

const checkLoginStatus = async () => {
  const supabase = getSupabase();
  if (!supabase) {
    setIsLoggedIn(false);
    return;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    setIsLoggedIn(!!user);
  } catch (error) {
    console.error("Error checking login status:", error);
    setIsLoggedIn(false);
  }
};

// 在生成故事时检查登录状态
const handleLogin = async () => {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    toast.error("登录失败，请重试");
  }
};
```

**通用规则**：
1. 对于需要用户身份的功能，始终进行登录状态检查
2. 提供清晰的登录引导
3. 使用适当的UI元素（如对话框）来处理需要用户输入的操作

---

## 📱 UI/UX改进

### 故事生成界面不够友好
**现象**：  
故事生成界面只有一个输入框和按钮，用户体验不够友好

**根因分析**：
1. 没有使用对话框来组织生成故事的输入
2. 缺少语言选择功能
3. 没有适当的加载状态和反馈

**解决步骤**：
```tsx
// 创建故事生成对话框组件
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Globe, Loader2 } from "lucide-react";

interface StoryGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (prompt: string, language: string) => Promise<void>;
  isLoading: boolean;
  isLoggedIn: boolean;
  onLogin: () => void;
}

export function StoryGenerationDialog({
  open,
  onOpenChange,
  onGenerate,
  isLoading,
  isLoggedIn,
  onLogin,
}: StoryGenerationDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState<"chinese" | "english">("chinese");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    if (!isLoggedIn) {
      onLogin();
      return;
    }

    await onGenerate(prompt.trim(), language);
    setPrompt("");
    onOpenChange(false);
  };

  const languageOptions = [
    { value: "chinese", label: "中文", icon: "🇨🇳" },
    { value: "english", label: "English", icon: "🇺🇸" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 对话框内容保持不变... */}
    </Dialog>
  );
}
```

**通用规则**：
1. 对于需要多个输入参数的操作，使用对话框来组织界面
2. 提供清晰的输入限制提示（如字符数限制）
3. 使用适当的加载状态和禁用状态来防止重复提交

---

## 📦 包管理最佳实践

### 如何检查包导出
**通用规则**：
```bash
# 查看包的 package.json
npm ls ai

# 查看包的导出字段
cat node_modules/ai/package.json | grep -A 10 "exports"
```

### 如何调试模块导入
**通用规则**：
```bash
# 查看文件实际路径
npm ls ai

# 检查模块导出内容
cat node_modules/ai/dist/index.d.ts
```

### 如何跟踪 SDK 变化
**通用规则**：
1. 查看官方博客：https://vercel.com/blog
2. 查阅文档：https://ai-sdk.dev/docs
3. 查看 GitHub 仓库：https://github.com/vercel/ai

### 依赖升级 checklist
1. 查看官方迁移指南
2. 检查 `package.json` 的 `exports` 字段
3. 更新 TypeScript 类型定义
4. 测试所有 API 路由
5. 清理并重新安装依赖

---

## 📦 Git 配置与使用问题

### 1. Git 提交哈希与分支信息缺失导致上下文丢失
**现象**：
- 多个请求中 `git` 字段为空或不完整，导致无法关联代码上下文
- 示例空请求：
```json
{"id":"6f1fa817-2a44-42c0-af7f-b876c0b3af12","timestamp":"2025-09-07T17:15:17.185Z","instructions":null}
```

**根因**：
- 用户未在请求中携带完整的 Git 信息（commit_hash、branch、repository_url）
- 可能为客户端配置错误或 Git 环境未正确初始化

**解决**：
```bash
# 检查当前 Git 状态
git status

# 确保有远程仓库设置
git remote -v

# 若无远程，添加远程仓库
git remote add origin <repository_url>

# 提交前确保有明确 commit
git add .
git commit -m "Initial commit"

# 获取当前 commit hash
git rev-parse HEAD

# 获取当前分支名
git rev-parse --abbrev-ref HEAD
```

**踩坑提示**：
- 初始化项目时务必设置远程仓库
- 自动化脚本应确保 Git 提交历史存在
- 若使用 CI/CD 工具，确保 `GIT_COMMIT` 和 `GIT_BRANCH` 环境变量被正确注入

**通用规则**：
✅ 每次请求应携带完整 Git 上下文信息  
✅ 项目初始化脚本应包含 Git 初始化与远程设置  
✅ 使用 `git log --oneline` 检查提交历史是否存在

---

### 2. 多个请求使用相同 commit_hash 但不同分支
**现象**：
- 多个请求中使用相同 `commit_hash`，但分支名不同：
```json
{
  "git": {
    "commit_hash": "e04aa29eb949599e31c7f6017d7c72c7022c95b1",
    "branch": "feat/20250905-weekly-update"
  }
}
```

**根因**：
- 同一 commit 被多个分支引用，可能表示分支合并或重用
- 也可能为误操作导致 commit_hash 被手动复制

**解决**：
```bash
# 查看该 commit 所属的分支
git branch --contains e04aa29eb949599e31c7f6017d7c72c7022c95b1

# 查看该 commit 的详细信息
git show e04aa29eb949599e31c7f6017d7c72c7022c95b1
```

**踩坑提示**：
- 不同分支共享相同 commit 表示分支有共同祖先或被合并过
- 若 commit_hash 被手动复制，可能导致上下文混淆

**通用规则**：
✅ commit_hash 应与分支名保持一致  
✅ 使用 `git log --graph --oneline --all` 查看所有分支历史关系  
✅ 避免手动复制 commit_hash 到不同分支

---

## 🌐 仓库 URL 格式不一致问题

### 1. 仓库 URL 包含敏感信息（如 REDACTED_EMAIL）
**现象**：
- 部分请求中 `repository_url` 包含 `[REDACTED_EMAIL]:Pond-International/pond-website.git` 格式
- 示例：
```json
"repository_url":"[REDACTED_EMAIL]:Pond-International/pond-website.git"
```

**根因**：
- 使用了 SSH 格式但嵌入了用户名（可能是测试或自动化脚本误操作）
- 或 Git 配置中 `user.email` 被错误设置为邮箱而非用户名

**解决**：
```bash
# 查看当前 Git 配置
git config --list

# 设置正确的用户名和邮箱
git config --global user.name "your-username"
git config --global user.email "your-email@example.com"

# 若使用 SSH，应使用标准格式
git remote set-url origin git@github.com:Pond-International/pond-website.git
```

**踩坑提示**：
- 不要在 URL 中硬编码邮箱或敏感信息
- 使用 SSH 时应配置好 SSH 密钥
- 使用 HTTPS 时应使用凭据管理器或 Git Credential Helper

**通用规则**：
✅ 仓库 URL 应使用标准格式：`git@github.com:<org>/<repo>.git` 或 `https://github.com/<org>/<repo>.git`  
✅ 自动化脚本应确保 Git 配置安全  
✅ 避免在 URL 中暴露敏感信息

---