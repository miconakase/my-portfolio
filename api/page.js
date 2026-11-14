// GET /  (rewritten here by vercel.json) the site's HTML with the portfolio content already
// in it, so search engines, link previews and AI crawlers that don't run JavaScript still
// see names, projects and skills. React replaces this markup as soon as the app starts.
//
// The built page is published as /app.html (see scripts/finish-build.mjs) so it doesn't
// shadow this route. If anything here fails, visitors are sent to that plain page instead.
import { getDb } from './_lib/db.js'
import { COLLECTIONS } from './_lib/collections.js'
import { handle, methodNotAllowed } from './_lib/http.js'
import { buildJourney, buildSkills } from '../src/lib/content.js'

const SHELL = '/app.html'

const escape = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// Joins the non-empty parts with a separator, escaped
const join = (parts, sep = ' · ') => parts.filter(Boolean).map(escape).join(sep)

const link = (href, label) => `<a href="${escape(href)}">${escape(label)}</a>`

function renderContent({ projects, music, timeline, skills }) {
  const journey = buildJourney(timeline)
  const { party, box } = buildSkills(skills)

  const projectList = projects
    .map(
      (p) => `<article>
<h3>${escape(p.title)}</h3>
${p.year || p.role ? `<p>${join([p.year, p.role])}</p>` : ''}
${p.longDesc || p.desc ? `<p>${escape(p.longDesc || p.desc)}</p>` : ''}
${p.tags?.length ? `<p>Built with: ${join(p.tags, ', ')}</p>` : ''}
${p.outcome ? `<p>${escape(p.outcome)}</p>` : ''}
${p.live || p.github ? `<p>${[p.live && link(p.live, 'Live demo'), p.github && link(p.github, 'Source code')].filter(Boolean).join(' · ')}</p>` : ''}
</article>`,
    )
    .join('\n')

  const musicList = music.map((t) => `<li><strong>${escape(t.title)}</strong> ${join([t.genre, t.year, t.award])}</li>`).join('\n')
  const journeyList = journey.map((e) => `<li><strong>${escape(e.title)}</strong> ${join([e.subtitle, e.date])}</li>`).join('\n')
  const skillGroups = [
    party.length && `<p>Core stack: ${join(party.map((t) => t.name), ', ')}</p>`,
    ...box.map((g) => `<p>${escape(g.title)}: ${join(g.stored.map((t) => t.name), ', ')}</p>`),
  ]
    .filter(Boolean)
    .join('\n')

  return `<main class="prerender">
<h1>Mico Nakase</h1>
<p>Full Stack &amp; Gen AI developer and music producer from Laguna, Philippines. Junior AI Engineer at Prosperna, building AI-powered tools by day and producing music by night.</p>
<section><h2>Projects</h2>
${projectList}
</section>
<section><h2>Music</h2><ul>
${musicList}
</ul></section>
<section><h2>Journey</h2><ul>
${journeyList}
</ul></section>
<section><h2>Skills</h2>
${skillGroups}
</section>
<section><h2>Contact</h2>
<p>${link('mailto:miconakaseyt@gmail.com', 'miconakaseyt@gmail.com')} · ${link('/Nakase_Mico_CV.pdf', 'CV (PDF)')}</p>
</section>
</main>`
}

export default handle(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return methodNotAllowed(res, ['GET', 'HEAD'])

  try {
    const shellRes = await fetch(`https://${req.headers.host}${SHELL}`)
    if (!shellRes.ok) throw new Error(`shell ${shellRes.status}`)
    const shell = await shellRes.text()

    const db = await getDb()
    const entries = await Promise.all(
      Object.keys(COLLECTIONS).map(async (name) => [name, await db.collection(name).find().sort({ order: 1 }).toArray()]),
    )
    const html = shell.replace('<div id="root"></div>', `<div id="root">${renderContent(Object.fromEntries(entries))}</div>`)

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    // Same freshness as /api/content: admin edits show up within about a minute
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400')
    res.status(200).send(html)
  } catch (err) {
    console.error('page render failed:', err)
    res.setHeader('Cache-Control', 'no-store')
    res.redirect(307, SHELL)
  }
})
