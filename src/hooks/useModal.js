import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select, [tabindex]:not([tabindex="-1"])'

// Shared popup behavior: locks page scroll, closes on Escape, keeps Tab inside the
// popup and hands focus back to whatever was focused before it opened.
// Focus starts on the [data-autofocus] element, else the first focusable one.
export function useModal(ref, onClose, { active = true, escape = true } = {}) {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    const node = ref.current
    if (!active || !node) return
    const previous = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ;(node.querySelector('[data-autofocus]') ?? node.querySelector(FOCUSABLE))?.focus()

    const onKey = (e) => {
      if (escape && e.key === 'Escape') closeRef.current()
      // Skip Tabs the popup already handled itself (e.g. terminal tab-completion)
      if (e.key !== 'Tab' || e.defaultPrevented) return
      const items = [...node.querySelectorAll(FOCUSABLE)]
      const first = items[0]
      const last = items.at(-1)
      if (!first) return e.preventDefault()
      if (!node.contains(document.activeElement)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      previous?.focus?.({ preventScroll: true })
    }
  }, [ref, active, escape])
}
