import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { runAthenaQuery } from "./athenaClient.js";
import { repairTablePartitions } from "./athenaClient.js";
dotenv.config();

const app = express();
app.use(cors());

const TABLE = process.env.ATHENA_TABLE;


// Run once at startup
repairTablePartitions()
  .then(() => console.log("Partitions repaired at startup"))
  .catch((err) => console.warn("Partition repair failed:", err.message));

// Then refresh every 60 seconds so new S3 data becomes queryable automatically
setInterval(async () => {
  try {
    await repairTablePartitions();
    console.log("Partitions repaired");
  } catch (err) {
    console.warn("Partition repair failed:", err.message);
  }
}, 60000);
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Top offending IPs
app.get("/api/analytics/top-ips", async (req, res) => {
  try {
    const data = await runAthenaQuery(`
      SELECT ip, COUNT(*) as request_count
      FROM ${TABLE}
      GROUP BY ip
      ORDER BY request_count DESC
      LIMIT 10;
    `);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Status code distribution
app.get("/api/analytics/status-codes", async (req, res) => {
  try {
    const data = await runAthenaQuery(`
      SELECT statuscode, COUNT(*) as count
      FROM ${TABLE}
      GROUP BY statuscode
      ORDER BY count DESC;
    `);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Suspicious requests
app.get("/api/analytics/suspicious", async (req, res) => {
  try {
    const data = await runAthenaQuery(`
      SELECT ip, method, path, statuscode, timestamp
      FROM ${TABLE}
      WHERE is_suspicious = true
      ORDER BY timestamp DESC
      LIMIT 20;
    `);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Requests per algorithm
app.get("/api/analytics/by-algorithm", async (req, res) => {
  try {
    const data = await runAthenaQuery(`
      SELECT algorithm, COUNT(*) as total_requests,
             SUM(CASE WHEN is_suspicious THEN 1 ELSE 0 END) as suspicious_count
      FROM ${TABLE}
      GROUP BY algorithm
      ORDER BY total_requests DESC;
    `);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Traffic trend by hour
app.get("/api/analytics/trend", async (req, res) => {
  try {
    const data = await runAthenaQuery(`
      SELECT hour_bucket, COUNT(*) as request_count,
             SUM(CASE WHEN statuscode = 429 THEN 1 ELSE 0 END) as rate_limited_count
      FROM ${TABLE}
      GROUP BY hour_bucket
      ORDER BY hour_bucket;
    `);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Analytics API running on http://localhost:${PORT}`);
});