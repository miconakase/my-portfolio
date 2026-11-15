// Mico's portfolio as compact plain text for Mokusei AI's system prompt. Kept short on
// purpose: Groq's free tier allows 8,000 tokens a minute across every visitor.
import { buildJourney, buildSkills } from '../../src/lib/content.js'
import { EMAIL, SOCIALS } from '../../src/constants/profile.js'

// Joins the non-empty parts with a separator
const join = (parts, sep = ' · ') => parts.filter(Boolean).join(sep)

// Drops a trailing period so joined sentences don't end up with ".."
const clause = (text) => text?.trim().replace(/\.+$/, '')

const PROFILE = `Mico Nakase, Full Stack & Generative AI Developer and music producer from San Pedro, Laguna, Philippines.
Junior AI Engineer at Prosperna Philippines, and Producer & External Vice President at Truchorus Performance Company.
Enjoys building things that look good and work well: clean code by day, producing music by night.`

function project(p) {
  return join(
    [
      `- ${join([p.title, p.year, p.role])}`,
      clause(p.desc),
      p.tags?.length && `Built with: ${p.tags.join(', ')}`,
      p.outcome && `Outcome: ${clause(p.outcome)}`,
      p.live && `Live: ${p.live}`,
      p.github && `Code: ${p.github}`,
    ],
    '. ',
  )
}

export function buildPortfolio({ projects, music, timeline, skills }) {
  const journey = buildJourney(timeline)
  const { party, box } = buildSkills(skills)

  return [
    '## Profile',
    PROFILE,
    '',
    '## Projects (numbered as in the terminal\'s "projects" list)',
    ...projects.map((p, i) => project(p).replace('- ', `${i + 1}. `)),
    '',
    '## Music (numbered as in the terminal\'s "music" list)',
    ...music.map((t, i) => `${i + 1}. ${join([t.title, t.genre, t.year, t.award])}${t.desc ? `. ${t.desc}` : ''}`),
    '',
    '## Journey (newest first)',
    ...journey.map((e) => `- ${join([e.title, e.subtitle, e.date])}`),
    '',
    '## Skills',
    ...(party.length ? [`Core stack: ${party.map((t) => t.name).join(', ')}`] : []),
    ...box.map((g) => `${g.title}: ${g.stored.map((t) => t.name).join(', ')}`),
    '',
    '## Contact',
    `Email: ${EMAIL}`,
    ...SOCIALS.map(([name, href]) => `${name}: ${href}`),
    'Website: https://www.miconakase.xyz',
    'CV: https://www.miconakase.xyz/Nakase_Mico_CV.pdf',
  ].join('\n')
}
