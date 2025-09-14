import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import OpenAI from 'openai'

import { LLMConfig } from '../utils/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface LLMClient {
  extractKnowledge(input: string, date: string): Promise<string>
  summarizeDaily(input: string, date: string): Promise<string>
}

export class OpenAILLMClient implements LLMClient {
  private client: OpenAI

  constructor(config: LLMConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      baseURL: config.baseUrl
    })
  }

  async extractKnowledge(input: string, date: string): Promise<string> {
    const template = await this.loadTemplate('knowledge.md')
    const prompt = template.replace('{sessions}', input).replace('{date}', date)

    const completion = await this.client.chat.completions.create({
      messages: [{ content: prompt, role: 'user' }],
      model: 'gpt-4o-mini'
    })

    return completion.choices[0]?.message?.content || ''
  }

  async summarizeDaily(input: string, date: string): Promise<string> {
    const template = await this.loadTemplate('daily.md')
    const prompt = template.replace('{sessions}', input).replace('{date}', date)

    const completion = await this.client.chat.completions.create({
      messages: [{ content: prompt, role: 'user' }],
      model: 'gpt-4o-mini'
    })

    return completion.choices[0]?.message?.content || ''
  }

  private async loadTemplate(filename: string): Promise<string> {
    const templatePath = path.join(__dirname, '..', 'prompts', filename)
    return fs.promises.readFile(templatePath, 'utf8')
  }
}

export class AnthropicLLMClient implements LLMClient {
  private client: Anthropic

  constructor(config: LLMConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY
    })
  }

  async extractKnowledge(input: string, date: string): Promise<string> {
    const template = await this.loadTemplate('knowledge.md')
    const prompt = template.replace('{sessions}', input).replace('{date}', date)

    const completion = await this.client.messages.create({
      /* eslint-disable-next-line camelcase */
      max_tokens: 4096,
      messages: [{ content: prompt, role: 'user' }],
      model: 'claude-3-haiku-20240307'
    })

    return completion.content[0]?.type === 'text' ? completion.content[0].text : ''
  }

  async summarizeDaily(input: string, date: string): Promise<string> {
    const template = await this.loadTemplate('daily.md')
    const prompt = template.replace('{sessions}', input).replace('{date}', date)

    const completion = await this.client.messages.create({
      /* eslint-disable-next-line camelcase */
      max_tokens: 4096,
      messages: [{ content: prompt, role: 'user' }],
      model: 'claude-3-haiku-20240307'
    })

    return completion.content[0]?.type === 'text' ? completion.content[0].text : ''
  }

  private async loadTemplate(filename: string): Promise<string> {
    const templatePath = path.join(__dirname, '..', 'prompts', filename)
    return fs.promises.readFile(templatePath, 'utf8')
  }
}

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

  async extractKnowledge(input: string, date: string): Promise<string> {
    const template = await this.loadTemplate('knowledge.md')
    const prompt = template.replace('{sessions}', input).replace('{date}', date)

    const completion = await this.client.chat.completions.create({
      messages: [{ content: prompt, role: 'user' }],
      model: this.config.model || 'gpt-3.5-turbo'
    })

    return completion.choices[0]?.message?.content || ''
  }

  async summarizeDaily(input: string, date: string): Promise<string> {
    const template = await this.loadTemplate('daily.md')
    const prompt = template.replace('{sessions}', input).replace('{date}', date)

    const completion = await this.client.chat.completions.create({
      messages: [{ content: prompt, role: 'user' }],
      model: this.config.model || 'gpt-3.5-turbo'
    })

    return completion.choices[0]?.message?.content || ''
  }

  private async loadTemplate(filename: string): Promise<string> {
    const templatePath = path.join(__dirname, '..', 'prompts', filename)
    return fs.promises.readFile(templatePath, 'utf8')
  }
}

export function createLLMClient(config: LLMConfig): LLMClient {
  switch (config.provider) {
    case 'anthropic': {
      return new AnthropicLLMClient(config)
    }

    case 'generic': {
      return new GenericOpenAIClient(config)
    }

    case 'openai': {
      return new OpenAILLMClient(config)
    }

    default: {
      throw new Error(`Unsupported LLM provider: ${config.provider}`)
    }
  }
}