import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { expensesApi } from '../../services/api'
import type { Expense, ExpenseCategory } from '../../types'

const ALL_CATEGORIES: ExpenseCategory[] = ['CLEANING', 'SUPPLIES', 'OTHER', 'UTILITIES', 'SALARIES', 'MAINTENANCE']
const RECEPTIONIST_CATEGORIES: ExpenseCategory[] = ['CLEANING', 'SUPPLIES', 'OTHER']

const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  CLEANING: 'Cleaning',
  SUPPLIES: 'Supplies',
  OTHER: 'Other',
  UTILITIES: 'Utilities',
  SALARIES: 'Salaries',
  MAINTENANCE: 'Maintenance',
}

function toISO(d: Date): string {
  return d.toISOString().split('T')[0]
}

interface Props {
  onClose: () => void
  onCreated: (expense: Expense) => void
}

export default function AddExpenseModal({ onClose, onCreated }: Props) {
  const { user } = useAuth()
  const isReceptionist = user?.role === 'RECEPTIONIST'
  const allowedCategories = isReceptionist ? RECEPTIONIST_CATEGORIES : ALL_CATEGORIES

  const [category, setCategory] = useState<ExpenseCategory>(allowedCategories[0])
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(toISO(new Date()))
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) {
      setError('Amount must be greater than 0.')
      return
    }
    setError('')
    setSaving(true)
    try {
      const expense = await expensesApi.create({
        category,
        amount: Number(amount),
        expense_date: expenseDate,
        description: description || undefined,
      })
      onCreated(expense)
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to save expense.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-slate-800">Add Expense</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {allowedCategories.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (VND)</label>
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
            <label className="block text-xs font-semibold text-slate-600 mb-1">Date</label>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Detergent and mop refill"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 text-sm font-medium py-2 rounded-lg hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
              {saving ? 'Saving…' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
