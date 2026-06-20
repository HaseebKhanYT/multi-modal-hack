# TeemTalk

Voice-first agent for shift call-outs. An employee calls in sick, TeemTalk releases the shift and phones eligible teammates one at a time until someone covers — the manager is only involved if no one can.

---

## What to review

| | |
|---|---|
| [`PRD.md`](PRD.md) | Product scope, architecture, integrations |
| [`functions/vapi-webhook.ts`](functions/vapi-webhook.ts) | Vapi webhook — leave intake + outbound coverage |
| [`migrations/`](migrations/) | Postgres schema |
| [`demo/seed-data.md`](demo/seed-data.md) | Demo roster & shifts |
| [Dashboard UI](https://github.com/HaseebKhanYT/multi-modal-hack/tree/feature/manager-dashboard) | Manager dashboard (`feature/manager-dashboard` branch) |

**Stack:** Vapi · Nebius AI Studio · InsForge · TypeScript

---

## Run the dashboard

```bash
git checkout feature/manager-dashboard
cd frontend && npm install && npm run dev
```

Open **http://localhost:5173** → **Coverage** for the live call-down demo (auto-plays: call-out → sequential calls → shift covered). Use **Replay** to run it again.
