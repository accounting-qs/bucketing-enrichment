# Implementation Plan: Scalable background Architecture for Render

## 1. Executive Summary
The goal is to transition the current prototype from a single-process, local-storage application to a distributed, scalable architecture capable of processing "Big Lists" (100k+ rows). This will be achieved by decoupling the web interface from data processing using background workers and cloud-native infrastructure on Render.

## 2. Target Architecture
*   **Web Layer (Next.js)**: Responsible for UI, API routing, and authentication. It handles metadata and triggers jobs but does *not* process files.
*   **Worker Layer (Node.js/BullMQ)**: A dedicated, headless service that executes long-running tasks like heavy CSV parsing and batch AI mappings.
*   **Data Persistence (PostgreSQL)**: Managed database for relational data, replacing volatile local SQLite.
*   **Message Broker (Redis)**: Manages the job queue (BullMQ), enabling communication between the Web and Worker layers.
*   **Object Storage (S3/R2)**: Centralized storage for CSV files and JSON analysis results.

## 3. High-Level Phases

### Phase 1: Persistence & Storage Migration
We must eliminate the dependency on the local file system (`data/` folder) and local SQLite (`demo.db`).
*   Migrate SQLite schemas to PostgreSQL.
*   Implement an S3-compatible client for all file operations (uploads/reads).

### Phase 2: Background Job System (BullMQ)
Continuous processing in a request-response cycle leads to timeouts on large files.
*   Set up BullMQ with Redis connection.
*   Create a "Workbook-Processing" queue.
*   Transition the heavy logic from `/api/workbooks/[id]/analyze/confirm` into a worker job.

### Phase 3: Scaling "Big List" Processing
To handle 100k+ rows without memory crashes:
*   **Streaming**: Use `csv-parse` streams to process files row-by-row.
*   **Batching**: Group rows (e.g., 50-100) before sending to AI providers to maximize API throughput and minimize network overhead.
*   **Parallelism**: Scale the number of Render worker instances based on load.

### Phase 4: Frontend State & Polling
*   Implement a job status tracker in DB (`status: 'pending' | 'processing' | 'completed' | 'failed'`).
*   Update the UI to show a "Processing..." state with a progress bar driven by the database state.

### Phase 5: Deployment Orchestration
*   Define a `render.yaml` Blueprint to automatically provision Postgres, Redis, Web, and Worker services with shared environment variables.

## 4. Risks & Mitigations
*   **AI Rate Limits**: Mitigated by exponential backoff in BullMQ and batching.
*   **Memory Usage**: Mitigated by strict streaming (avoiding `.arrayBuffer()` or loading full CSVs).
*   **Cost**: Managed by using Render's auto-scaling or manually adjusting worker counts during peak imports.
