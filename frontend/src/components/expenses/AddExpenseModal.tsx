import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { expensesApi } from '../../services/api'
import type { Expense, ExpenseCategory } from '../../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const ALL_CATEGORIES: ExpenseCategory[] = ['CLEANING', 'SUPPLIES', 'OTHER', 'UTILITIES', 'SALARIES', 'MAINTENANCE']
const RECEPTIONIST_CATEGORIES: ExpenseCategory[] = ['CLEANING', 'SUPPLIES', 'OTHER']

const SELECT_CLASS =
  'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

interface Props {
  onClose: () => void
  onSaved: (expense: Expense) => void
  editingExpense?: Expense
}

export default function AddExpenseModal({ onClose, onSaved, editingExpense }: Props) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isReceptionist = user?.role === 'RECEPTIONIST'
  const allowedCategories = isReceptionist ? RECEPTIONIST_CATEGORIES : ALL_CATEGORIES
  const isEdit = !!editingExpense

  const [category, setCategory] = useState<ExpenseCategory>(
    editingExpense?.category ?? allowedCategories[0]
  )
  const [amount, setAmount] = useState(editingExpense ? String(editingExpense.amount) : '')
  const [expenseDate, setExpenseDate] = useState(editingExpense?.expense_date ?? toISO(new Date()))
  const [description, setDescription] = useState(editingExpense?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      setError(t('addExpense.errorAmount'))
      return
    }
    setError('')
    setSaving(true)
    try {
      let expense: Expense
      if (isEdit && editingExpense) {
        expense = await expensesApi.update(editingExpense.id, {
          category,
          amount: Number(amount),
          expense_date: expenseDate,
          description: description || undefined,
        })
      } else {
        expense = await expensesApi.create({
          category,
          amount: Number(amount),
          expense_date: expenseDate,
          description: description || undefined,
        })
      }
      onSaved(expense)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? t('addExpense.errorSave'))
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEdit ? t('addExpense.titleEdit') : t('addExpense.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="space-y-1">
            <Label className="text-xs">{t('addExpense.category')}</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={SELECT_CLASS}>
              {allowedCategories.map((c) => (
                <option key={c} value={c}>{t(`expenseCategory.${c}` as any)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t('addExpense.amount')}</Label>
            <Input type="number" min="1" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-9" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t('addExpense.date')}</Label>
            <Input type="date" required value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="h-9" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">{t('addExpense.description')}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('addExpense.descriptionPlaceholder')} className="h-9" />
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" size="lg" className="flex-1" disabled={saving}>
              {saving ? t('addExpense.submitting') : isEdit ? t('addExpense.submitEdit') : t('addExpense.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
