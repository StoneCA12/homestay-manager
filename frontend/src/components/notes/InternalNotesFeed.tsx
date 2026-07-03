import { useEffect, useState } from 'react'
import { notesApi } from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import type { InternalNote, NoteCategory, NoteEntityType, UserRole } from '../../types'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<NoteCategory, string> = {
  RECEPTION:    'Lễ tân',
  HOUSEKEEPING: 'Dọn phòng',
  MAINTENANCE:  'Bảo trì',
  OWNER:        'Chủ nhà',
}

const CATEGORY_COLORS: Record<NoteCategory, string> = {
  RECEPTION:    'bg-blue-50 border-blue-200 text-blue-800',
  HOUSEKEEPING: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  MAINTENANCE:  'bg-orange-50 border-orange-200 text-orange-800',
  OWNER:        'bg-purple-50 border-purple-200 text-purple-800',
}

const CATEGORY_BADGE: Record<NoteCategory, string> = {
  RECEPTION:    'bg-blue-100 text-blue-700',
  HOUSEKEEPING: 'bg-emerald-100 text-emerald-700',
  MAINTENANCE:  'bg-orange-100 text-orange-700',
  OWNER:        'bg-purple-100 text-purple-700',
}

function formatTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('vi-VN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface Props {
  entityType: NoteEntityType
  entityId: number
  userRole: UserRole
  /** Categories to show in the add-note form. Defaults to all allowed for the role. */
  allowedCategories?: NoteCategory[]
  compact?: boolean
}

const ALL_CATEGORIES: NoteCategory[] = ['RECEPTION', 'HOUSEKEEPING', 'MAINTENANCE', 'OWNER']
const NON_OWNER_CATEGORIES: NoteCategory[] = ['RECEPTION', 'HOUSEKEEPING', 'MAINTENANCE']

export default function InternalNotesFeed({ entityType, entityId, userRole, allowedCategories, compact }: Props) {
  const { showToast } = useToast()
  const [notes, setNotes] = useState<InternalNote[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<NoteCategory | 'ALL'>('ALL')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<NoteCategory>('RECEPTION')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const roleAllowed = userRole === 'OWNER' ? ALL_CATEGORIES : NON_OWNER_CATEGORIES
  const writeable = (allowedCategories ?? ALL_CATEGORIES).filter(c => roleAllowed.includes(c))

  useEffect(() => {
    notesApi.list(entityType, entityId)
      .then(setNotes)
      .catch(() => showToast('Không thể tải ghi chú.', 'error'))
      .finally(() => setLoading(false))
  }, [entityType, entityId, showToast])

  const displayed = activeFilter === 'ALL' ? notes : notes.filter((n) => n.category === activeFilter)

  const categoriesWithNotes = Array.from(new Set(notes.map((n) => n.category))) as NoteCategory[]

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    setError('')
    try {
      const note = await notesApi.create({ entity_type: entityType, entity_id: entityId, category, content: content.trim() })
      setNotes((prev) => [note, ...prev])
      setContent('')
    } catch (e: any) {
      setError(e.response?.data?.detail ?? 'Lỗi thêm ghi chú')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await notesApi.delete(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      setConfirmDeleteId(null)
    } catch {
      // leave the confirm state so the user can retry
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className={cn('space-y-3', compact && 'space-y-2')}>
      {/* Category filter tabs */}
      {categoriesWithNotes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveFilter('ALL')}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
              activeFilter === 'ALL'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            Tất cả ({notes.length})
          </button>
          {categoriesWithNotes.map((cat) => {
            const count = notes.filter((n) => n.category === cat).length
            return (
              <button
                key={cat}
                onClick={() => setActiveFilter(cat)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
                  activeFilter === cat
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            )
          })}
        </div>
      )}

      {/* Notes list */}
      {loading ? (
        <p className="py-2 text-xs text-muted-foreground">Đang tải...</p>
      ) : displayed.length === 0 ? (
        <p className="py-1 text-xs text-muted-foreground italic">Chưa có ghi chú nào</p>
      ) : (
        <div className="space-y-2">
          {displayed.map((n) => (
            <div key={n.id} className={cn('rounded-lg border px-3 py-2.5', CATEGORY_COLORS[n.category])}>
              <div className="flex items-start justify-between gap-2">
                <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold', CATEGORY_BADGE[n.category])}>
                  {CATEGORY_LABELS[n.category]}
                </span>
                <span className="whitespace-nowrap text-xs opacity-70">{formatTs(n.created_at)}</span>
              </div>
              <p className={cn('mt-1.5 text-sm leading-snug', compact && 'text-xs')}>{n.content}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                {n.author_name ? (
                  <p className="text-xs opacity-60">— {n.author_name}</p>
                ) : <span />}
                {entityType === 'ROOM' && (
                  confirmDeleteId === n.id ? (
                    <span className="flex items-center gap-1.5 text-xs">
                      Xóa ghi chú này?
                      <button
                        onClick={() => handleDelete(n.id)}
                        disabled={deletingId === n.id}
                        className="font-semibold text-red-600 hover:underline disabled:opacity-50"
                      >
                        {deletingId === n.id ? 'Đang xóa…' : 'Xóa'}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground hover:underline">
                        Hủy
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(n.id)}
                      className="text-xs text-muted-foreground opacity-60 hover:opacity-100 hover:text-red-600"
                    >
                      Xóa
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add note form */}
      <div className="rounded-lg border border-dashed border-border p-2.5 space-y-2">
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as NoteCategory)}
            className="rounded border border-input bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {writeable.map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>
        <textarea
          value={content}
          onChange={(e) => { setContent(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit() }}
          placeholder="Thêm ghi chú nội bộ (Ctrl+Enter để lưu)..."
          rows={2}
          className="w-full resize-none rounded border border-input bg-transparent px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? 'Đang lưu…' : 'Thêm ghi chú'}
        </button>
      </div>
    </div>
  )
}
