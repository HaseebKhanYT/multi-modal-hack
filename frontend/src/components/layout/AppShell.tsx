import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppShell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-column">
        <TopBar />
        <main className="main-scroll">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
