import { ActivityFeed } from '../components/activity/ActivityFeed'
import { useDashboard } from '../context/DashboardContext'

export function ActivityViewPage() {
  const { activityFull } = useDashboard()

  return (
    <div className="view-container-narrow">
      <ActivityFeed events={activityFull} />
    </div>
  )
}
