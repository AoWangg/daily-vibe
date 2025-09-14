import { loadConfig } from '../utils/config.js'
import { AppConfig } from '../utils/types.js'

export interface RedactionResult {
  matches: Array<{
    match: string
    pattern: string
    replacement: string
  }>
  original: string
  redacted: string
}

export class RedactionEngine {
  private enabled: boolean
  private patterns: RegExp[]
  private patternStrings: string[]

  constructor(config: AppConfig['redact']) {
    this.enabled = config?.enabled ?? true
    this.patternStrings = config?.patterns || []
    this.patterns = this.patternStrings.map(pattern => {
      try {
        return new RegExp(pattern, 'gi')
      } catch {
        // Invalid regex, skip
        return null
      }
    }).filter(Boolean) as RegExp[]
  }

  static async fromConfig(): Promise<RedactionEngine> {
    const config = await loadConfig()
    return new RedactionEngine(config.redact)
  }

  redact(text: string): RedactionResult {
    if (!this.enabled || !text || typeof text !== 'string') {
      return {
        matches: [],
        original: text || '',
        redacted: text || ''
      }
    }

    let redacted = text
    const matches: RedactionResult['matches'] = []

    for (let i = 0; i < this.patterns.length; i++) {
      const pattern = this.patterns[i]
      const patternString = this.patternStrings[i]

      // Use exec in a loop instead of matchAll for better compatibility
      let match: null | RegExpExecArray
      pattern.lastIndex = 0 // Reset regex state
      
      while ((match = pattern.exec(text)) !== null) {
        const matchedText = match[0]
        const replacement = this.generateReplacement(matchedText, patternString)
        
        matches.push({
          match: matchedText,
          pattern: patternString,
          replacement
        })
        
        // Replace in redacted text (replace first occurrence)
        redacted = redacted.replace(matchedText, replacement)
        
        // Break if not global to avoid infinite loop
        if (!pattern.global) break
      }
    }

    return {
      matches,
      original: text,
      redacted
    }
  }

  redactMultiple(texts: string[]): RedactionResult[] {
    return texts.map(text => this.redact(text))
  }

  test(testString: string): RedactionResult {
    return this.redact(testString)
  }

  private generateReplacement(originalText: string, pattern: string): string {
    // Generate contextual replacements based on pattern type
    if (pattern.includes('sk-') || pattern.includes('Bearer')) {
      return '[REDACTED_API_KEY]'
    }
    
    if (pattern.includes('@') || pattern.includes('email')) {
      return '[REDACTED_EMAIL]'
    }
    
    if (pattern.includes(String.raw`\d`) && (pattern.includes('-') || pattern.includes('phone'))) {
      return '[REDACTED_PHONE]'
    }
    
    if (pattern.includes('ghp_')) {
      return '[REDACTED_GITHUB_TOKEN]'
    }
    
    if (pattern.includes(String.raw`\b\d{3}-\d{2}-\d{4}`)) {
      return '[REDACTED_SSN]'
    }

    // For generic patterns, generate asterisks with some context
    if (originalText.length <= 4) {
      return '***'
    }

 if (originalText.length <= 8) {
      return originalText.slice(0, 2) + '***'
    }
 
      return originalText.slice(0, 2) + '***' + originalText.slice(-2)
    
  }
}

// Convenience functions
export async function redactText(text: string): Promise<string> {
  const engine = await RedactionEngine.fromConfig()
  return engine.redact(text).redacted
}

export async function testRedaction(testString: string): Promise<RedactionResult> {
  const engine = await RedactionEngine.fromConfig()
  return engine.test(testString)
}