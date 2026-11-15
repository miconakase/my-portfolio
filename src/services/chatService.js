// Mokusei AI, the terminal's portfolio assistant (see api/chat.js). `history` is the
// conversation so far as [{ role: 'user' | 'assistant', content }]. Throws with a message
// that's fine to show the visitor.
export async function askMokusei(message, history) {
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
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.reply) throw new Error(data.error ?? 'Mokusei AI is unavailable right now.')
  return data.reply
}
