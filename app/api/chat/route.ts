import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { routePrompt } from '@/lib/bertos/router'
import type { Message, AIModel } from '@/lib/bertos/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? '',
})

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { messages, model, sessionId } = await req.json() as {
    messages: Message[]
    model: AIModel
    sessionId: string
  }

  const lastMessage = messages[messages.length - 1]
  const routerDecision = routePrompt(lastMessage?.content ?? '', model)
  const primaryModel = routerDecision.primary

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      send({ type: 'router', decision: routerDecision })

      try {
        if (primaryModel === 'claude' || (model === 'auto' && routerDecision.primary === 'claude')) {
          await streamClaude(messages, send)
        } else if (primaryModel === 'codex') {
          await streamCodex(messages, send)
        } else if (primaryModel === 'gemini') {
          await streamGemini(messages, send)
        } else {
          await streamClaude(messages, send)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        if (errorMsg.includes('API key') || errorMsg.includes('authentication') || errorMsg.includes('401')) {
          await streamDemo(lastMessage?.content ?? '', primaryModel, send)
        } else {
          send({ type: 'error', message: errorMsg })
        }
      }

      send({ type: 'done' })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

async function streamClaude(
  messages: Message[],
  send: (data: object) => void
) {
  const apiMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const systemMsg = messages.find(m => m.role === 'system')

  const stream = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4096,
    system: systemMsg?.content ?? 'You are BertOS, an advanced AI assistant running inside the BertOS AI operating system. You are helpful, precise, and capable.',
    messages: apiMessages,
    stream: true,
  })

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      send({ type: 'chunk', content: event.delta.text })
    }
    if (event.type === 'message_delta' && event.usage) {
      send({ type: 'usage', tokens: event.usage.output_tokens })
    }
  }
}

async function streamCodex(messages: Message[], send: (data: object) => void) {
  await streamDemo(messages[messages.length - 1]?.content ?? '', 'codex', send)
}

async function streamGemini(messages: Message[], send: (data: object) => void) {
  await streamDemo(messages[messages.length - 1]?.content ?? '', 'gemini', send)
}

async function streamDemo(prompt: string, model: AIModel, send: (data: object) => void) {
  const responses: Record<AIModel, string[]> = {
    codex: [
      `Here's my implementation for your request:\n\n\`\`\`typescript\n// Optimized solution\nfunction solution(input: string): string {\n  // Process the input efficiently\n  return input\n    .trim()\n    .split('\\n')\n    .map(line => line.trim())\n    .filter(Boolean)\n    .join('\\n');\n}\n\`\`\`\n\nThis approach uses:\n- **O(n) time complexity** - single pass through the data\n- **Functional patterns** - clean, composable transformations\n- **TypeScript strict mode** - full type safety\n\nWould you like me to add error handling or optimize further?`,
      `I've analyzed your code and found the issue. Here's the fix:\n\n\`\`\`javascript\n// Before (broken)\nconst result = data.map(item => item.value)\n\n// After (fixed)\nconst result = data?.map(item => item?.value ?? null) ?? []\n\`\`\`\n\nThe problem was **optional chaining** — when \`data\` is null, \`.map()\` throws. The fix adds null guards throughout the chain.\n\n**Root cause**: The API sometimes returns \`null\` instead of an empty array when no results are found. Consider validating at the API boundary too.`,
    ],
    gemini: [
      `**Research Summary**\n\nBased on my analysis:\n\n## Key Findings\n\n1. **Primary insight**: The topic has multiple dimensions worth exploring\n2. **Supporting evidence**: Research indicates strong correlation between the variables\n3. **Counterarguments**: Some studies suggest alternative interpretations\n\n## Recommendations\n\n- Start with the most established approach\n- Document your assumptions clearly\n- Iterate based on feedback\n\nWould you like me to dive deeper into any specific aspect?`,
      `**Creative Brainstorm**\n\nHere are 7 ideas for your project:\n\n1. **Dynamic adaptation** — System adjusts based on user behavior patterns\n2. **Federated approach** — Distribute processing across multiple nodes\n3. **Hybrid model** — Combine rule-based and ML approaches for reliability\n4. **Progressive enhancement** — Start simple, add complexity incrementally\n5. **Event-driven architecture** — Decouple components via message queues\n6. **Edge computing** — Push logic closer to the data source\n7. **Composable modules** — Build small, reusable units that compose\n\nWhich direction resonates most with your constraints?`,
    ],
    claude: [
      `I'd be happy to help with that. Let me think through this carefully.\n\n## Analysis\n\nYour question touches on several important concepts:\n\n**Core principle**: The fundamental approach here is to break the problem into smaller, manageable pieces.\n\n**Key considerations**:\n- What are the constraints we're working within?\n- What does success look like?\n- What tradeoffs are acceptable?\n\n## My Recommendation\n\nBased on what you've shared, I'd suggest starting with the simplest viable approach and iterating. This gives you:\n\n1. **Fast feedback** — you'll learn what works quickly\n2. **Lower risk** — smaller scope means easier course correction\n3. **Momentum** — early wins build confidence\n\nWhat aspect would you like to explore first?`,
    ],
    auto: [
      `I've processed your request and here's my comprehensive response:\n\nBertOS has intelligently routed this to me based on the task type. Here's what I found:\n\n## Response\n\nYour prompt demonstrates thoughtful consideration of the problem space. Here are my thoughts:\n\n**Immediate answer**: The direct approach works well for straightforward cases.\n\n**Nuanced perspective**: However, consider edge cases that might change the calculus.\n\n**Action plan**:\n1. Define the scope clearly\n2. Identify the critical path\n3. Execute incrementally\n4. Measure and adjust\n\nI'm ready to go deeper on any aspect — just let me know.`,
    ],
  }

  const modelResponses = responses[model] ?? responses.claude
  const response = modelResponses[Math.floor(Math.random() * modelResponses.length)]

  const words = response.split(' ')
  for (const word of words) {
    send({ type: 'chunk', content: word + ' ' })
    await sleep(15 + Math.random() * 25)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
