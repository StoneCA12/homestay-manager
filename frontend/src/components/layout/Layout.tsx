import type { ReactNode } from 'react'
import Sidebar from './Sidebar'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <div className="print:hidden"><Sidebar /></div>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
