import { useEffect, useRef, useState } from 'react'
import { Undo2, X } from 'lucide-react'

export interface UndoAction {
  label: string
  onUndo: () => Promise<void>
}

interface Props {
  action: UndoAction
  onDismiss: () => void
  durationMs?: number
}

export default function UndoToast({ action, onDismiss, durationMs = 8000 }: Props) {
  const [progress, setProgress] = useState(100)
  const [undoing, setUndoing] = useState(false)
  const startRef = useRef(Date.now())
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const pct = Math.max(0, 100 - (elapsed / durationMs) * 100)
      setProgress(pct)
      if (pct > 0) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        onDismiss()
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [durationMs, onDismiss])

  const handleUndo = async () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setUndoing(true)
    try {
      await action.onUndo()
    } finally {
      onDismiss()
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 min-w-[280px] max-w-sm rounded-2xl border bg-card shadow-xl overflow-hidden">
      {/* Progress bar */}
      <div
        className="h-0.5 bg-primary transition-none"
        style={{ width: `${progress}%` }}
      />
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1 text-sm text-foreground">{action.label}</span>
        <button
          onClick={handleUndo}
          disabled={undoing}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-60"
        >
          <Undo2 className="h-3.5 w-3.5" />
          {undoing ? '...' : 'Hoàn tác'}
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
