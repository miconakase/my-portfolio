import { useEffect, useRef, useState } from 'react'
import { complete, MOKUSEI_BANNER, runCommand } from '../lib/terminal'
import { askMokusei } from '../services/chatService'
import { useModal } from '../hooks/useModal'

const WELCOME = [
  { text: 'MICO OS v1.0 — portfolio terminal', tone: 'accent' },
  { text: 'Type "help" to see what you can do, or "mokusei" to chat with Mokusei AI.', tone: 'muted' },
  { text: '' },
]

const TONES = {
  accent: 'text-(--color-yellow)',
  error: 'text-[#ff7a5c]',
  muted: 'text-[#9a968a]',
  input: 'text-white',
  ai: 'border-l-2 border-(--color-yellow) pl-3',
}

const BLANK = { text: '' }
const CHAT_EXIT = ['/exit', 'exit', '/quit', 'quit']

const WINDOW_BUTTON =
  'flex items-center justify-center w-7 h-7 border-2 border-[#111] bg-white text-black font-pixel text-[10px] cursor-pointer'

// Opens with ~ or Ctrl/Cmd+K (or the navbar button). `ctx` gives commands the
// content and the actions they can trigger on the page.
export default function Terminal({ open, onOpen, onClose, ctx }) {
  const [lines, setLines] = useState(WELCOME)
  const [input, setInput] = useState('')
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1) // -1 = typing a new line
  // null in the shell; the conversation so far while chatting with Mokusei AI
  const [chat, setChat] = useState(null)
  const [thinking, setThinking] = useState(false)
  const [minimized, setMinimized] = useState(false) // closed, but waiting in the dock
  const [maximized, setMaximized] = useState(false)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)
  const prompt = chat ? 'mokusei>' : '>'

  // Global shortcuts: ~ (outside form fields) and Ctrl/Cmd+K toggle, Esc closes
  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target.closest?.('input, textarea, select, [contenteditable]')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) {
          setMinimized(false)
          onClose()
        } else onOpen()
      } else if (!open && !typing && (e.key === '`' || e.key === '~')) {
        e.preventDefault()
        onOpen()
      } else if (open && e.key === 'Escape') {
        setMinimized(false)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpen, onClose])

  // Esc is handled by the shortcut listener above
  const dialogRef = useRef(null)
  useModal(dialogRef, onClose, { active: open, escape: false })

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [lines, open, thinking])

  // ✕, Esc and commands that jump to the page close for real; ▁ keeps a button in the dock
  const close = () => {
    setMinimized(false)
    onClose()
  }
  const minimize = () => {
    setMinimized(true)
    onClose()
  }

  if (!open) {
    if (!minimized) return null
    // Sits above the music player, which spans the bottom on smaller screens
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label="Restore terminal"
        className="fixed right-4 bottom-[88px] xl:bottom-4 z-[1002] flex items-center gap-2 px-3 py-2 bg-[#111] text-[#ece8d9] border-[3px] border-[#111] shadow-[4px_4px_0_0_var(--color-yellow)] font-pixel text-[10px] uppercase cursor-pointer animate-slide-up"
      >
        <span className="pokeball text-[14px]" aria-hidden="true" />
        {chat ? '~/mokusei' : 'terminal'}
        {thinking && <span className="w-2 h-2 bg-(--color-yellow) animate-dot-pulse" aria-hidden="true" />}
      </button>
    )
  }

  const ask = async (question, conversation) => {
    setThinking(true)
    try {
      const reply = await askMokusei(question, conversation)
      setLines((l) => [...l, { text: reply, tone: 'ai' }, BLANK])
      setChat([...conversation, { role: 'user', content: question }, { role: 'assistant', content: reply }])
    } catch (err) {
      setLines((l) => [...l, { text: err.message, tone: 'error' }, BLANK])
    } finally {
      setThinking(false)
    }
  }

  // Inside a chat everything goes to Mokusei AI, apart from the slash commands
  const sendToChat = (value, echo) => {
    const command = value.toLowerCase()
    if (CHAT_EXIT.includes(command)) {
      setChat(null)
      setLines((l) => [...l, echo, { text: 'Back to MICO OS.', tone: 'muted' }, BLANK])
    } else if (command === '/clear') {
      setChat([])
      setLines([...MOKUSEI_BANNER, BLANK])
    } else {
      setLines((l) => [...l, echo])
      ask(value, chat)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    if (thinking) return
    const value = input.trim()
    setInput('')
    setHistoryIndex(-1)
    const echo = { text: `${prompt} ${input}`, tone: 'input' }
    if (!value) {
      setLines((l) => [...l, echo])
      return
    }
    setHistory((h) => [...h, value])
    if (chat) return sendToChat(value, echo)

    const result = runCommand(value, ctx)
    if (result.clear) setLines([])
    else setLines((l) => [...l, echo, ...result.lines, BLANK])
    if (result.chat) {
      setChat([])
      if (result.ask) ask(result.ask, [])
    }
    if (result.action) {
      close()
      // Let the overlay unmount first so scrolling targets the page
      requestAnimationFrame(result.action)
    }
  }

  const onInputKey = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const completed = !chat && complete(input)
      if (completed) setInput(completed)
    } else if (e.key === 'ArrowUp' && history.length) {
      e.preventDefault()
      const next = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(next)
      setInput(history[next])
    } else if (e.key === 'ArrowDown' && historyIndex !== -1) {
      e.preventDefault()
      const next = historyIndex + 1
      setHistoryIndex(next < history.length ? next : -1)
      setInput(next < history.length ? history[next] : '')
    }
  }

  return (
    <div
      className={`fixed inset-0 z-[1002] bg-black/60 flex items-center justify-center animate-menu-fade ${maximized ? '' : 'p-4'}`}
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Terminal"
        className={`flex flex-col bg-[#111] text-[#ece8d9] border-[3px] border-[#111] ${
          maximized ? 'w-full h-full' : 'w-[min(780px,100%)] h-[min(540px,75vh)] shadow-[6px_6px_0_0_var(--color-yellow)]'
        }`}
        onClick={(e) => {
          e.stopPropagation()
          inputRef.current?.focus()
        }}
      >
        <div
          className="flex items-center justify-between gap-3 px-3 py-2 bg-(--color-yellow) text-(--color-on-accent) border-b-[3px] border-[#111] select-none"
          onDoubleClick={(e) => !e.target.closest('button') && setMaximized((m) => !m)}
        >
          <span className="flex items-center gap-2 font-pixel text-[10px] uppercase">
            <span className="pokeball text-[14px]" aria-hidden="true" />
            mico@portfolio: ~{chat && '/mokusei'}
          </span>
          <div className="flex gap-1.5">
            <button type="button" onClick={minimize} aria-label="Minimize terminal" title="Minimize" className={WINDOW_BUTTON}>
              <span className="w-2.5 h-[3px] mt-2 bg-current" aria-hidden="true" />
            </button>
            {/* Phones already get a near-full-screen terminal */}
            <button
              type="button"
              onClick={() => setMaximized((m) => !m)}
              aria-label={maximized ? 'Restore terminal size' : 'Maximize terminal'}
              title={maximized ? 'Restore' : 'Full screen'}
              className={`${WINDOW_BUTTON} max-sm:hidden`}
            >
              <span className={`border-2 border-t-[3px] border-current ${maximized ? 'w-2 h-2' : 'w-3 h-3'}`} aria-hidden="true" />
            </button>
            <button type="button" onClick={close} aria-label="Close terminal" title="Close" className={WINDOW_BUTTON}>
              ✕
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[14px] leading-[1.6]" aria-live="polite">
          {lines.map((line, i) =>
            line.href ? (
              <a
                key={i}
                href={line.href}
                target={line.href.startsWith('mailto:') ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="block whitespace-pre-wrap break-words text-[#7fb2ff] underline underline-offset-2"
              >
                {line.text}
              </a>
            ) : (
              <div key={i} className={`whitespace-pre-wrap break-words min-h-[1.6em] ${TONES[line.tone] ?? ''}`}>
                {line.text}
              </div>
            ),
          )}

          {thinking && (
            <div className={TONES.muted}>
              Mokusei AI is thinking<span className="animate-dot-pulse">...</span>
            </div>
          )}

          <form onSubmit={submit} className="flex items-center gap-2">
            <span className={chat ? 'text-(--color-yellow)' : 'text-(--color-green)'} aria-hidden="true">
              {prompt}
            </span>
            <input
              ref={inputRef}
              data-autofocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKey}
              readOnly={thinking}
              placeholder={chat ? 'Ask about Mico…' : undefined}
              aria-label={chat ? 'Message Mokusei AI' : 'Command'}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-white font-mono text-[14px] caret-(--color-yellow)"
            />
          </form>
        </div>
      </div>
    </div>
  )
}
