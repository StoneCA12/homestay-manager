import { useState, type ReactNode } from 'react'
import { Menu, House } from 'lucide-react'
import Sidebar from './Sidebar'
import SearchBar from '@/components/search/SearchBar'
import FloatingActionButton from '@/components/ui/FloatingActionButton'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export default function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <div className="hidden shrink-0 print:hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — always visible, menu+branding hidden on desktop */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
          {/* Mobile only: menu button */}
          <Button
            variant="outline"
            size="icon"
            aria-label="Mở menu"
            onClick={() => setMobileOpen(true)}
            className="shrink-0 lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>

          {/* Mobile only: branding */}
          <div className="flex shrink-0 items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <House className="h-4 w-4" />
            </div>
            <span className="font-semibold">Homestay</span>
          </div>

          {/* Search bar — flex-1 on mobile, fixed width right-aligned on desktop */}
          <div className="min-w-0 flex-1 lg:ml-auto lg:w-80 lg:flex-none">
            <SearchBar />
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <FloatingActionButton />
    </div>
  )
}
