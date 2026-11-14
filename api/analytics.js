// GET /api/analytics?days=7  visitor stats from Vercel Web Analytics (admin only)
// Needs VERCEL_TOKEN; VERCEL_PROJECT_ID defaults to the project name, VERCEL_TEAM_ID is the
// team id ("team_…") or slug the project lives under.
import { requireAdmin } from './_lib/auth.js'
import { handle, methodNotAllowed } from './_lib/http.js'

const API = 'https://api.vercel.com/v1/query/web-analytics/visits'
const MAX_DAYS = 30 // Hobby plan keeps one month of data

async function query(endpoint, params) {
  const team = process.env.VERCEL_TEAM_ID
  const search = new URLSearchParams({ projectId: process.env.VERCEL_PROJECT_ID || 'my-portfolio', ...params })
  if (team) search.set(team.startsWith('team_') ? 'teamId' : 'slug', team)

  const res = await fetch(`${API}/${endpoint}?${search}`, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data.error?.message || `Vercel API error (${res.status})`)
    err.status = res.status
    throw err
  }
  return data.data
}

export default handle(async (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET'])
  if (!requireAdmin(req, res)) return
  if (!process.env.VERCEL_TOKEN) return res.status(503).json({ error: 'VERCEL_TOKEN is not set' })

  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), MAX_DAYS)
  const until = new Date()
  const since = new Date(until.getTime() - (days - 1) * 86_400_000)
  const range = { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) }
  const top = (by) => query('aggregate', { ...range, by, limit: '5' })

  try {
    const [totals, daily, pages, referrers, countries, devices] = await Promise.all([
      query('count', range),
      query('aggregate', { ...range, by: 'day' }),
      top('requestPath'),
      top('referrerHostname'),
      top('country'),
      top('deviceType'),
    ])
    // Vercel skips days with no visits; fill them with zeros so the chart has one bar per day
    const byDay = new Map(daily.map((row) => [row.timestamp.slice(0, 10), row]))
    const filled = Array.from({ length: days }, (_, i) => {
      const day = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10)
      return byDay.get(day) ?? { timestamp: `${day}T00:00:00.000Z`, visitors: 0, pageviews: 0 }
    })

    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ days, totals, daily: filled, pages, referrers, countries, devices })
  } catch (err) {
    if (!err.status) throw err
    // 502 rather than Vercel's own status, so a bad token isn't mistaken for an expired admin session
    res.status(502).json({ error: err.message })
  }
})
