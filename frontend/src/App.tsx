import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { DashboardProvider } from './context/DashboardProvider'
import { ActivityViewPage } from './views/ActivityView'
import { CoverageView } from './views/CoverageView'
import { ScheduleView } from './views/ScheduleView'
import { TeamView } from './views/TeamView'
import { TodayView } from './views/TodayView'

export default function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<TodayView />} />
            <Route path="coverage" element={<CoverageView />} />
            <Route path="schedule" element={<ScheduleView />} />
            <Route path="activity" element={<ActivityViewPage />} />
            <Route path="team" element={<TeamView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </DashboardProvider>
    </BrowserRouter>
  )
}
