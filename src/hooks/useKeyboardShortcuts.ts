import { useEffect, useEffectEvent } from 'react'

export type Shortcut = {
  run: () => void
  /** Keep firing while the key is held down. Off by default. */
  repeat?: boolean
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Global keyboard shortcuts, keyed by `KeyboardEvent.code`.
 * Keys typed into form fields and combinations with Ctrl, Cmd or Alt are left
 * alone, so browser shortcuts such as zoom and save keep working.
 */
export function useKeyboardShortcuts(shortcuts: Record<string, Shortcut>) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) {
      return
    }
    const shortcut = shortcuts[event.code]
    if (!shortcut) {
      return
    }
    event.preventDefault()
    if (event.repeat && !shortcut.repeat) {
      return
    }
    shortcut.run()
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])
}
