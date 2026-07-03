import { useEffect, useRef } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function PrintFrame({ title, onClose, children }: Props) {
  const areaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'print-frame-override'
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #print-frame-portal { display: block !important; }
        #print-frame-portal .no-print { display: none !important; }
        #print-frame-portal { position: fixed; top: 0; left: 0; width: 100%; background: white; }
      }
    `
    document.head.appendChild(style)
    return () => document.getElementById('print-frame-override')?.remove()
  }, [])

  const handlePrint = () => window.print()

  return (
    // z-[60]: must sit above the booking detail Dialog (z-50) it's opened from. Radix
    // Dialog renders via a Portal appended to the end of <body>, so at equal z-index
    // the still-open Dialog paints on top of this inline-rendered overlay and eats
    // its clicks even though nothing looks wrong in the JSX tree.
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div id="print-frame-portal" className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Toolbar — hidden on print */}
        <div className="no-print flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-slate-700">{title}</p>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              🖨️ In ngay
            </button>
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Print content */}
        <div ref={areaRef} className="p-6 font-sans text-sm text-slate-800 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  )
}
