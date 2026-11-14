// GET  /api/:collection  list items, sorted by `order` (public)
// POST /api/:collection  create an item (admin)
import crypto from 'node:crypto'
import { getDb } from './_lib/db.js'
import { requireAdmin } from './_lib/auth.js'
import { collectionConfig, invalidFields } from './_lib/collections.js'
import { cleanBody, handle, methodNotAllowed } from './_lib/http.js'
import { slugify } from '../src/lib/slugify.js'

// Slug from the title, with -2, -3… added if it's taken. Titles with no a-z/0-9
// characters (e.g. "日本語") get a short random one so the page still has a URL.
async function uniqueSlug(col, title) {
  const base = slugify(title) || `item-${crypto.randomBytes(3).toString('hex')}`
  const taken = new Set(
    (await col.find({ slug: { $regex: `^${base}(-\\d+)?$` } }, { projection: { slug: 1 } }).toArray()).map((d) => d.slug),
  )
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  return slug
}

export default handle(async (req, res) => {
  const name = req.query.collection
  const config = collectionConfig(name)
  if (!config) return res.status(404).json({ error: 'Unknown collection' })
  const col = (await getDb()).collection(name)

  if (req.method === 'GET') {
    const items = await col.find().sort({ order: 1 }).toArray()
    // CDN keeps it for 30s, then serves stale while refreshing in the background
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300')
    return res.status(200).json(items)
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return
    const data = cleanBody(req.body)
    if (!data) return res.status(400).json({ error: 'Expected a JSON object' })
    const invalid = invalidFields(config, data)
    if (invalid) return res.status(400).json({ error: invalid })

    if (config.slug) {
      // Unique index makes a same-moment duplicate fail (409) instead of silently sharing a URL.
      // If old data already breaks it, carry on without one rather than blocking saves.
      await col.createIndex({ slug: 1 }, { unique: true }).catch((err) => console.error('slug index:', err.message))
      if (typeof data.slug !== 'string' || !data.slug) data.slug = await uniqueSlug(col, data.title)
    }
    if (data.order === undefined) {
      const last = await col.find().sort({ order: -1 }).limit(1).next()
      data.order = (last?.order ?? -1) + 1
    }
    const now = new Date()
    const item = { ...data, createdAt: now, updatedAt: now }
    const { insertedId } = await col.insertOne(item)
    return res.status(201).json({ ...item, _id: insertedId })
  }

  methodNotAllowed(res, ['GET', 'POST'])
})
