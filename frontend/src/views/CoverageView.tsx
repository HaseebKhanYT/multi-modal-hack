import { CandidateQueueRail, CoverageStage } from '../components/coverage/CoveragePanels'

export function CoverageView() {
  return (
    <div className="view-container two-col-coverage">
      <CoverageStage />
      <CandidateQueueRail />
    </div>
  )
}
