// POST /api/login { password }  sets the admin session cookie
import { checkPassword, sessionCookie } from './_lib/auth.js'
import { getDb } from './_lib/db.js'
import { handle, methodNotAllowed } from './_lib/http.js'

// Failed attempts are logged in Mongo (auto-deleted after WINDOW) so the limit holds
// across serverless instances. The global cap stops guesses spread over many IPs.
const WINDOW_MS = 15 * 60 * 1000
const MAX_PER_IP = 10
const MAX_TOTAL = 50

export default handle(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST'])

  const attempts = (await getDb()).collection('login_attempts')
  await attempts.createIndex({ at: 1 }, { expireAfterSeconds: WINDOW_MS / 1000 })
  const ip = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || 'unknown'
  const since = new Date(Date.now() - WINDOW_MS)
  const [fromIp, total] = await Promise.all([
    attempts.countDocuments({ ip, at: { $gte: since } }),
    attempts.countDocuments({ at: { $gte: since } }),
  ])
  if (fromIp >= MAX_PER_IP || total >= MAX_TOTAL) {
    return res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes.' })
  }

  if (!checkPassword(req.body?.password)) {
    await attempts.insertOne({ ip, at: new Date() })
    // Slow down password guessing
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return res.status(401).json({ error: 'Wrong password' })
  }
  res.setHeader('Set-Cookie', sessionCookie())
  res.status(200).json({ admin: true })
})
