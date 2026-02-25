# Tasks: Scaling & Render Deployment

This list contains the actionable steps required to move the application to a scalable background-processing architecture.

## 🟩 Phase 1: Database & Storage Refactor
*   [ ] **Provision Database**: Set up a managed PostgreSQL instance (e.g., on Render or Supabase).
*   [ ] **Update DB Library**: Replace `better-sqlite3` with a Postgres-compatible driver (e.g., `postgres` or `pg`) or Prisma.
*   [ ] **Migrate Schemas**: Write DDL scripts to create `workbooks` and `analyses` tables in Postgres.
*   [ ] **S3 Integration**: Create an S3 bucket (AWS S3 or Cloudflare R2).
*   [ ] **Update Upload Logic**: Modify `src/app/api/workbooks/upload/route.ts` to stream the file to S3 instead of saving to `data/uploads`.

## 🟨 Phase 2: Worker & Queue Setup
*   [ ] **Provision Redis**: Set up a Render Redis instance.
*   [ ] **Initialize BullMQ**: Create `src/lib/queue.ts` to share a Redis-backed queue between the app and worker.
*   [ ] **Extract Analysis Logic**: Move the code from `src/app/api/workbooks/[id]/analyze/confirm/route.ts` into a new `src/worker/analyzer.worker.ts`.
*   [ ] **Implement Batch Mapping**: Update the worker to process CSV rows in batches of 50 for AI mapping.
*   [ ] **Status Tracking**: Update the database when jobs start, progress, and finish.

## 🟧 Phase 3: Frontend Adjustments
*   [ ] **Async Interaction**: Update the "Analyze" confirmation button to trigger a `jobId` rather than waiting for a direct response.
*   [ ] **Job Status API**: Create `GET /api/jobs/[id]` to return the current progress from the database.
*   [ ] **Progress UI**: Create a new `AnalysisProgress` component with a progress bar and status messages.

## 🟦 Phase 4: Deployment & DevOps
*   [ ] **Render Blueprint**: Create a `render.yaml` file in the root directory.
*   [ ] **Environment Variables**: Configure `DATABASE_URL`, `REDIS_URL`, `S3_BUCKET`, `AWS_SECRET_KEY`, and AI API keys on Render.
*   [ ] **Build Scripts**: Ensure `package.json` has separate start scripts for the web server (`next start`) and the background worker (`node dist/worker.js`).

## 🚀 Future Enhancements
*   [ ] **Webhooks**: Use webhooks from S3 or the AI provider for even tighter integration.
*   [ ] **Auto-Scaling**: Configure Render to spin up more workers when the queue depth exceeds a threshold.
