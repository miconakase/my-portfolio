// Collections the API exposes. `required` fields must be non-empty strings on create/update;
// `slug: true` collections get a URL slug generated from the title.
export const COLLECTIONS = {
  music: { required: ['title'], slug: true },
  projects: { required: ['title'], slug: true },
  timeline: { required: ['title', 'date', 'type'] },
  skills: { required: ['name', 'group'] },
}

// hasOwn so names like "constructor" or "toString" aren't treated as collections
export const collectionConfig = (name) => (Object.hasOwn(COLLECTIONS, name) ? COLLECTIONS[name] : null)

// Returns an error message for a body that would break the site, or null if it's fine
export function invalidFields(config, data) {
  const missing = config.required.filter((field) => typeof data[field] !== 'string' || !data[field].trim())
  if (missing.length) return `Missing: ${missing.join(', ')}`
  if (data.order !== undefined && !Number.isFinite(data.order)) return 'order must be a number'
  return null
}
