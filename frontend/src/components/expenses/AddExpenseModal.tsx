import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../contexts/AuthContext'
import { expensesApi } from '../../services/api'
import type { Expense, ExpenseCategory } from '../../types'

const ALL_CATEGORIES: ExpenseCategory[] = ['CLEANING', 'SUPPLIES', 'OTHER', 'UTILITIES', 'SALARIES', 'MAINTENANCE']
const RECEPTIONIST_CATEGORIES: ExpenseCategory[] = ['CLEANING', 'SUPPLIES', 'OTHER']

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? t('addExpense.titleEdit') : t('addExpense.title')}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('addExpense.category')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {allowedCategories.map((c) => (
                <option key={c} value={c}>{t(`expenseCategory.${c}` as any)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('addExpense.amount')}</label>
            <input
              type="number"
              min="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('addExpense.date')}</label>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('addExpense.description')}</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('addExpense.descriptionPlaceholder')}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
            >
              {saving ? t('addExpense.submitting') : isEdit ? t('addExpense.submitEdit') : t('addExpense.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
