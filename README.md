# AWS Brain AI — Real-Time Log Analytics & Anomaly Detection Pipeline

A serverless, event-driven pipeline that ingests **live production traffic** from my [Distributed Rate Limiter](https://github.com/YOUR-USERNAME/rate-limiter) project, processes it in real time, and detects anomalous traffic patterns — with automated alerting and a live analytics dashboard.

Built as a hands-on portfolio project alongside preparing for the **AWS Certified Data Engineer – Associate (DEA-C01)** exam, to apply the same services (Kinesis, Glue, Athena, Lambda) in a real, working system rather than isolated practice exercises.

---

## 🔗 Live Demo

- **Dashboard:** https://aws-realtime-analytics-pipeline.vercel.app/
- **Backend API:** https://aws-realtime-analytics-pipeline.onrender.com
- **Demo Video:** https://youtu.be/UBwwR-ih3UM
- **Companion repo (data source):** [Rate Limiter](https://github.com/vatsala77/rate-limiterr)

> **Note:** The dashboard shows real captured traffic from load-testing sessions, not mock data. Click **"Simulate Traffic Burst"** on the dashboard to send fresh requests through the live pipeline and watch it update in real time (~2 min end-to-end latency due to Kinesis buffering + partition refresh).



---

## 🏗️ Architecture

```
┌─────────────────────┐
│   Rate Limiter API   │  (Node.js/Express, deployed on Render)
│  4 algorithms: Fixed  │
│  Window, Sliding,     │
│  Token/Leaky Bucket   │
└──────────┬───────────┘
           │ fire-and-forget log push (non-blocking)
           ▼
┌─────────────────────┐
│ Kinesis Data Firehose │  Direct PUT → buffered delivery
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│   S3 (raw/ prefix)    │  Partitioned by year/month/day/hour
└──────────┬───────────┘
           │ S3 Event trigger
           ▼
┌─────────────────────┐
│   AWS Lambda          │  Parses logs, flags suspicious requests
│  (transform + enrich  │  (429s, 5xx), runs threshold-based
│   + anomaly detect)   │  anomaly detection
└──────────┬───────────┘
           │                      │
           ▼                      ▼ (if threshold breached)
┌─────────────────────┐  ┌──────────────────┐
│ S3 (processed/ prefix)│  │   Amazon SNS      │ → Email/SMS Alert
└──────────┬───────────┘  └──────────────────┘
           │ crawled by
           ▼
┌─────────────────────┐
│  AWS Glue Data Catalog│  Auto-detected schema + partitions
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│   Amazon Athena       │  SQL queries over S3 data lake
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  Express Backend API  │  Runs Athena queries, returns JSON
│   (Node.js, Render)   │  Auto-repairs partitions every 60s
└──────────┬───────────┘
           ▼
┌─────────────────────┐
│  React Dashboard       │  Recharts visualizations,
│  (Vite, Vercel)        │  auto-refresh every 15s
└──────────────────────┘
```

**[Insert architecture diagram image here — draw.io/excalidraw export]**

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Ingestion | Amazon Kinesis Data Firehose |
| Storage | Amazon S3 (data lake, partitioned) |
| Transform/Compute | AWS Lambda (Node.js 20, ESM) |
| Cataloging | AWS Glue Data Catalog + Crawler |
| Query Engine | Amazon Athena |
| Alerting | Amazon SNS (Email + SMS) |
| Backend API | Node.js, Express, AWS SDK v3 |
| Frontend | React (Vite), Recharts, Lucide Icons |
| Deployment | Render (backend), Vercel (frontend) |
| IAM | Least-privilege roles per service (Firehose, Lambda, Glue, App user) |

---

## 🎯 Why This Exists

Most portfolio data pipelines use synthetic/mock data generators, which reads as a tutorial exercise rather than a real system. This pipeline instead observes **genuine traffic** from a production-style system I built and deployed — [a Redis-backed distributed rate limiter](https://github.com/vatsala77/rate-limiterr) supporting four different rate-limiting algorithms.

When the rate limiter blocks a client with a `429 Too Many Requests`, that signal flows through this pipeline in real time, gets flagged by rule-based anomaly detection in Lambda, and triggers an automated alert — the same pattern used in production observability systems, built at a scale appropriate for a portfolio project.

---

## ✨ Features

- **Real-time ingestion** of live application logs via Kinesis Firehose, with zero impact on the source application (fire-and-forget, fail-open logging)
- **Automatic enrichment**: raw logs are parsed and tagged with `is_suspicious` and `hour_bucket` fields in Lambda before landing in the processed data lake
- **Self-healing partition management**: backend automatically runs `MSCK REPAIR TABLE` every 60 seconds so newly arrived S3 partitions become queryable without manual intervention
- **Rule-based anomaly detection**: Lambda counts suspicious requests per batch and triggers an SNS alert (Email/SMS) when a threshold is breached — a deliberate, documented trade-off vs. a full ML-based approach (see [Design Decisions](#-design-decisions))
- **Live dashboard** with 5 visualizations (traffic trend, top offending IPs, status code distribution, per-algorithm breakdown, recent suspicious activity table), auto-refreshing every 15 seconds
- **Interactive "Simulate Traffic Burst" button** lets anyone verify the pipeline is genuinely live, not static/mock data

---

## 🧠 Design Decisions & Trade-offs

**Why Lambda-based rule detection instead of Kinesis Data Analytics / SageMaker?**
Amazon Kinesis Data Analytics for SQL applications (the service originally planned for `RANDOM_CUT_FOREST`-based anomaly detection) was discontinued by AWS effective January 27, 2026, in favor of Amazon Managed Service for Apache Flink — a heavier, code-based service requiring Java/Scala/Python and billed continuously per KPU-hour ($0.11/KPU-hour minimum, no free tier). Given the project's cost and timeline constraints, I chose a rule-based threshold detector inside the existing Lambda transform function instead — genuinely free, deployed in under an hour, and a defensible engineering trade-off I can articulate: **start simple and rule-based, graduate to ML-based detection (SageMaker Random Cut Forest or Managed Flink) once traffic volume and false-positive rates justify the added cost and complexity.**

**Why partition auto-repair via polling instead of Glue crawler triggers?**
For a portfolio-scale project, running `MSCK REPAIR TABLE` on a 60-second interval from the backend is simpler and cheaper than scheduling recurring Glue Crawler runs (which bill per DPU-hour) or building Lambda-triggered partition registration. At production scale, this would be replaced with event-driven partition projection or scheduled crawlers.

**Why separate repos instead of a monorepo?**
The Rate Limiter (traffic source) and this analytics pipeline (observability layer) are deployed, scaled, and evolve independently — a deliberate separation-of-concerns choice, cross-linked via READMEs and a shared architecture diagram so the two together read as one coherent system.

---



---

## 💰 Cost Management

Built with a **$60 AWS free-tier/promotional credit budget**, mindful of a **30 July 2026 expiry**.

| Service | Free tier status |
|---|---|
| S3, Lambda, SNS, Glue Data Catalog | Free (within always-free limits at this scale) |
| Athena | Pay-per-query, but negligible (~$0.50 total across all testing) |
| Kinesis Data Firehose | Paid, ~$1–3/month at hobby-scale traffic |
| Glue Crawler | Paid per DPU-hour, run manually (not scheduled) to minimize cost — a handful of runs, <$1 total |

**Guardrails used:** AWS Budget alerts set at $5 and $15 thresholds from day one. Paid components (Firehose) are scheduled for teardown before the credit expiry date, with free-tier components (Lambda, S3, Glue Catalog, SNS) optionally left running as a permanent lightweight demo.

---


## 🚀 Local Setup

### Prerequisites
- Node.js 20+
- AWS account with the services above provisioned (see [Architecture](#-architecture))
- `.env` files configured (see `.env.example` in each folder — **never commit real credentials**)

### Backend
```bash
cd backend
npm install
# configure backend/.env — see below
npm start
```

`backend/.env`:
```
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-south-1
ATHENA_DATABASE=rate_limiter_analytics
ATHENA_TABLE=logs_processed
ATHENA_OUTPUT_LOCATION=s3://your-athena-results-bucket/
PORT=4000
```

### Frontend
```bash
cd frontend
npm install
# configure frontend/.env
npm run dev
```

`frontend/.env`:
```
VITE_API_BASE=http://localhost:4000
```

### Lambda
See `lambda/index.mjs` for the transform + anomaly detection function. Deploy via AWS Console or your preferred IaC tool, with environment variable `SNS_TOPIC_ARN` set to your SNS topic ARN.

---

## 📂 Repo Structure

```
aws-realtime-analytics-pipeline/
├── backend/          # Express API — runs Athena queries, serves JSON
├── frontend/         # React dashboard (Vite + Recharts)
├── lambda/           # Transform + enrichment + anomaly detection function
├── athena/           # Saved SQL queries + sample results
├── docs/             # Architecture diagram, screenshots, demo video link
└── README.md
```

---

## 📜 License

MIT — feel free to reference the architecture or approach for your own projects.

---

## 🔗 Related

- [Rate Limiter](https://github.com/YOUR-USERNAME/rate-limiter) — the source system whose traffic this pipeline observes
- [FreelanceShield](https://freelance-shield-sable.vercel.app/) — milestone-based escrow platform for Indian freelancers (separate project)
