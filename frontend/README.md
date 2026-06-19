# Teem.Talk Manager Dashboard

React frontend for the Teem.Talk manager dashboard, built from the design handoff prototype.

## Stack

- React 19 + TypeScript
- Vite
- React Router

## Run locally

```bash
cd frontend
npm install
npm run dev
```

Open the URL shown in the terminal (default `http://localhost:5173`).

## Views

| Route | Screen |
|---|---|
| `/` | Today — stats, live coverage hero, floor timeline, approvals, activity |
| `/coverage` | Coverage theater — live call-down stage, candidate queue, transcript |
| `/schedule` | Weekly schedule grid |
| `/activity` | Full audit trail |
| `/team` | Staff roster |

## Demo simulation

The live call-down uses a local timer that replays the design prototype's scripted scenario (Sam declines → Elena no answer → Tom accepts). When the backend is ready, replace `DashboardProvider` state with realtime events from InsForge.

## Build

```bash
npm run build
npm run preview
```
