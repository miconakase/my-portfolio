// Commands for the terminal overlay. Each one gets the arguments and a context
// (content + actions from App) and returns the lines to print; it can also set
// `action` to run once the terminal closes (scrolling, opening a project...), or `chat` to
// switch the terminal into a Mokusei AI conversation.
import { calcLevel } from '../hooks/useDuration'
import { EMAIL, SOCIALS } from '../constants/profile'

const SECTIONS = ['home', 'about', 'works', 'timeline', 'skills', 'contact']

const text = (value, tone) => ({ text: value, tone })
const link = (label, href) => ({ text: label, href })
const error = (value) => text(value, 'error')
// A question the visitor can click to ask Mokusei AI
const suggest = (question) => ({ text: `  › ${question}`, suggest: question })

// Printed when a Mokusei AI chat starts (and again on /clear)
export const MOKUSEI_BANNER = [
  text('MOKUSEI AI · portfolio assistant', 'accent'),
  text("Ask me anything about Mico's projects, skills, music or journey. Try:", 'muted'),
  suggest("What's Mico's strongest project?"),
  suggest('Ano ang mga kanta ni Mico?'),
  suggest('How can I work with Mico?'),
  text('/clear starts over · /exit goes back to the shell', 'muted'),
]

// A project by its list number or slug
function findProject(projects, query) {
  const index = Number(query)
  if (Number.isInteger(index) && index >= 1) return projects[index - 1]
  return projects.find((p) => p.slug === query)
}

// A track's index by its list number or (part of) its title; -1 if none
function findTrack(music, query) {
  const index = Number(query)
  if (Number.isInteger(index) && index >= 1 && index <= music.length) return index - 1
  const q = query.toLowerCase()
  return music.findIndex((t) => t.title.toLowerCase().includes(q))
}

const COMMANDS = {
  help: {
    desc: 'List the commands',
    run: () => [
      text('Available commands:', 'accent'),
      ...Object.entries(COMMANDS)
        .filter(([, c]) => !c.hidden)
        .map(([name, c]) => text(`  ${(name + (c.usage ? ' ' + c.usage : '')).padEnd(20)}${c.desc}`)),
      text(''),
      text('Tip: ↑/↓ for history, Tab to complete, Esc to close.', 'muted'),
    ],
  },
  whoami: {
    desc: 'Who is Mico?',
    run: () => [
      text('Mico Nakase', 'accent'),
      text('Full Stack & Gen AI developer from San Pedro, Laguna, PH.'),
      text('Junior AI Engineer at Prosperna. Builds web apps by day, produces music by night.'),
    ],
  },
  mokusei: {
    usage: '[question]',
    desc: 'Chat with Mokusei AI',
    run: (args) => ({ lines: MOKUSEI_BANNER, chat: true, ask: args.join(' ') }),
  },
  ls: {
    desc: 'List the sections',
    run: () => [text(SECTIONS.map((s) => s + '/').join('  '))],
  },
  cd: {
    usage: '<section>',
    desc: 'Jump to a section',
    run: ([section], ctx) => {
      const id = section?.replace(/\/$/, '')
      if (!id || id === '~' || id === '..') return { lines: [], action: () => ctx.goTo('home') }
      if (!SECTIONS.includes(id)) return [error(`cd: no such section: ${section}`), text(`Try: ${SECTIONS.join(', ')}`, 'muted')]
      return { lines: [], action: () => ctx.goTo(id) }
    },
  },
  projects: {
    desc: 'List my projects',
    run: (_, { content }) => {
      if (!content.projects.length) return [text('No projects loaded yet.', 'muted')]
      return [
        ...content.projects.map((p, i) =>
          text(`  ${String(i + 1).padStart(2)}. ${p.title}${p.year ? ` (${p.year})` : ''}${p.desc ? ` — ${p.desc}` : ''}`),
        ),
        text(''),
        text('Type "open <number>" to see one.', 'muted'),
      ]
    },
  },
  open: {
    usage: '<number|id>',
    desc: 'Open a project page',
    run: ([query], ctx) => {
      if (!query) return [error('open: which project? e.g. "open 1"')]
      const project = findProject(ctx.content.projects, query)
      if (!project) return [error(`open: no project "${query}". Type "projects" to see the list.`)]
      return { lines: [text(`Opening ${project.title}...`)], action: () => ctx.openWork(project) }
    },
  },
  music: {
    desc: 'List my tracks',
    run: (_, ctx) => {
      if (!ctx.content.music.length) return [text('No tracks loaded yet.', 'muted')]
      return {
        lines: [
          ...ctx.content.music.map((t, i) =>
            text(`  ${String(i + 1).padStart(2)}. ♪ ${t.title}${t.genre ? ` · ${t.genre}` : ''}${t.year ? ` · ${t.year}` : ''}${t.award ? `  🏆 ${t.award}` : ''}`),
          ),
          text(''),
          text('Type "play <number>" to play one, or "listen" to go to the music tab.', 'muted'),
        ],
      }
    },
  },
  play: {
    usage: '<number|title>',
    desc: 'Play one of my tracks',
    run: (args, ctx) => {
      const query = args.join(' ')
      if (!query) return [error('play: which track? e.g. "play 1". Type "music" for the list.')]
      const index = findTrack(ctx.content.music, query)
      if (index === -1) return [error(`play: no track "${query}". Type "music" to see the list.`)]
      const track = ctx.content.music[index]
      if (!track.audio) {
        return { lines: [text(`${track.title} isn't playable yet. Opening the music tab...`, 'muted')], action: () => ctx.showMusic() }
      }
      return { lines: [text(`♪ Playing ${track.title}...`)], action: () => ctx.playTrack(index) }
    },
  },
  listen: {
    desc: 'Go to the music tab',
    run: (_, ctx) => ({ lines: [], action: () => ctx.showMusic() }),
  },
  skills: {
    desc: 'Show my party and PC box',
    run: (_, { content }) => {
      const { party, box } = content.skills
      if (!party.length && !box.length) return [text('No skills loaded yet.', 'muted')]
      const lv = (s) => (s.startDate ? ` Lv.${calcLevel(s.startDate)}` : '')
      return [
        text('PARTY', 'accent'),
        ...party.map((s) => text(`  ● ${s.name}${lv(s)}${s.category ? ` · ${s.category}` : ''}`)),
        ...box.flatMap((group) => [
          text(''),
          text(group.title.toUpperCase(), 'accent'),
          text('  ' + group.stored.map((s) => s.name).join(', ')),
        ]),
      ]
    },
  },
  journey: {
    desc: 'My timeline, newest first',
    run: (_, { content }) => {
      if (!content.journey.length) return [text('No timeline loaded yet.', 'muted')]
      return content.journey
        .filter((e) => !e.minor)
        .map((e) => text(`  ${e.current ? '▶' : '·'} ${e.date.padEnd(22)}${e.title}${e.subtitle ? ` @ ${e.subtitle}` : ''}`))
    },
  },
  socials: {
    desc: 'Where to find me',
    run: () => SOCIALS.map(([name, href]) => link(`  ${name.padEnd(11)}${href.replace('https://', '')}`, href)),
  },
  contact: {
    desc: 'How to reach me',
    run: () => [link(`  email      ${EMAIL}`, `mailto:${EMAIL}`), text(''), text('Type "cd contact" for the message form.', 'muted')],
  },
  theme: {
    usage: '[light|dark]',
    desc: 'Switch light/dark mode',
    run: ([mode], ctx) => {
      if (mode && mode !== 'light' && mode !== 'dark') return [error('theme: use "light" or "dark"')]
      const target = mode ?? (ctx.theme === 'dark' ? 'light' : 'dark')
      if (target === ctx.theme) return [text(`Already in ${target} mode.`, 'muted')]
      ctx.toggleTheme()
      return [text(`Switched to ${target} mode.`)]
    },
  },
  clear: {
    desc: 'Clear the screen',
    run: () => ({ lines: [], clear: true }),
  },
  exit: {
    desc: 'Close the terminal',
    run: () => ({ lines: [], action: () => {} }),
  },

  // Easter eggs, left out of "help"
  sudo: { hidden: true, run: () => [error('Nice try. This incident will be reported to Professor Oak.')] },
  pokeball: { hidden: true, run: () => [text('You threw a Poké Ball... Gotcha! MICO was caught!', 'accent')] },
  hello: { hidden: true, run: () => [text('Hey there, trainer! 👋')] },
  rm: { hidden: true, run: () => [error("rm: permission denied. Let's not delete my portfolio.")] },
}

// Aliases so the obvious guesses work too
const ALIASES = {
  about: 'whoami',
  '?': 'help',
  timeline: 'journey',
  email: 'contact',
  tracks: 'music',
  quit: 'exit',
  cls: 'clear',
  hi: 'hello',
  ai: 'mokusei',
  chat: 'mokusei',
}

export const COMMAND_NAMES = Object.keys(COMMANDS).filter((name) => !COMMANDS[name].hidden)

// Mokusei AI runs a command by ending its reply with a tag like [[open 2]] (see api/chat.js)
const MOKUSEI_ACTIONS = ['open', 'play', 'listen', 'cd', 'theme']

// What the visitor sees of a reply, even half-streamed: no action tag (or the start of
// one) and no markdown, which the terminal can't render
export function visibleReply(raw) {
  return raw
    .replace(/\[\[[\s\S]*$|\[$/, '')
    .replace(/\*\*|__|`/g, '')
    .trim()
}

// The command a finished reply asks for, if it's one Mokusei AI may run
export function replyAction(raw) {
  const command = raw.match(/\[\[([^\]]+)\]\]/)?.[1].trim()
  return command && MOKUSEI_ACTIONS.includes(command.split(/\s+/)[0].toLowerCase()) ? command : null
}

// Runs one input line; always returns { lines, action?, clear?, chat?, ask? }
export function runCommand(input, ctx) {
  const [rawName, ...args] = input.trim().split(/\s+/)
  const name = ALIASES[rawName.toLowerCase()] ?? rawName.toLowerCase()
  const command = COMMANDS[name]
  if (!command) return { lines: [error(`command not found: ${rawName}. Type "help" for the list.`)] }
  const result = command.run(args, ctx)
  return Array.isArray(result) ? { lines: result } : result
}

// Tab completion: the command name, or a section for "cd"
export function complete(input) {
  const parts = input.trimStart().split(/\s+/)
  if (parts.length === 1) {
    const matches = COMMAND_NAMES.filter((n) => n.startsWith(parts[0].toLowerCase()))
    return matches.length === 1 ? matches[0] + ' ' : null
  }
  if (parts.length === 2 && parts[0] === 'cd') {
    const matches = SECTIONS.filter((s) => s.startsWith(parts[1]))
    return matches.length === 1 ? `cd ${matches[0]}` : null
  }
  return null
}
