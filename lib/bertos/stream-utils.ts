export async function readAIStream(
  response: Response,
  onChunk: (text: string) => void,
  onDone?: () => void
): Promise<void> {
  if (!response.body) throw new Error('Response body is not readable')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue

      const dataStr = trimmed.slice(6)
      if (dataStr === '[DONE]') {
        onDone?.()
        return
      }

      try {
        const parsed = JSON.parse(dataStr)
        if (parsed.text) onChunk(parsed.text)
      } catch {
        // malformed SSE line — skip
      }
    }
  }

  onDone?.()
}

/** Consume a stream and return the full accumulated text. */
export async function readAIStreamFull(response: Response): Promise<string> {
  let result = ''
  await readAIStream(response, chunk => { result += chunk })
  return result
}
