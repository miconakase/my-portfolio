// Mokusei AI, the terminal's portfolio assistant (see api/chat.js). `history` is the
// conversation so far as [{ role: 'user' | 'assistant', content }]. The reply streams in:
// `onText` gets everything received so far, and the full raw reply is returned at the end.
// Throws with a message that's fine to show the visitor.
export async function askMokusei(message, history, onText) {
  let res
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    })
  } catch {
    throw new Error("Couldn't reach Mokusei AI. Check your connection and try again.")
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error ?? 'Mokusei AI is unavailable right now.')
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return text
      text += value
      onText?.(text)
    }
  } catch {
    throw new Error('The connection dropped mid-answer. Try asking again.')
  }
}
