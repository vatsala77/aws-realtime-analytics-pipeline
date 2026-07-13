import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { Activity, AlertTriangle, Shield, TrendingUp, Zap } from "lucide-react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";
const RATE_LIMITER_BASE = "https://rate-limiter-l8yi.onrender.com";

function App() {
  const [topIps, setTopIps] = useState([]);
  const [statusCodes, setStatusCodes] = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [suspiciousTotal, setSuspiciousTotal] = useState(0);
  const [byAlgorithm, setByAlgorithm] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simulateMsg, setSimulateMsg] = useState("");

  const fetchAll = async () => {
    try {
      const [ips, codes, suspResp, algo, trendData] = await Promise.all([
        fetch(`${API_BASE}/api/analytics/top-ips`).then((r) => r.json()),
        fetch(`${API_BASE}/api/analytics/status-codes`).then((r) => r.json()),
        fetch(`${API_BASE}/api/analytics/suspicious`).then((r) => r.json()),
        fetch(`${API_BASE}/api/analytics/by-algorithm`).then((r) => r.json()),
        fetch(`${API_BASE}/api/analytics/trend`).then((r) => r.json()),
      ]);
      setTopIps(ips);
      setStatusCodes(codes.map((c) => ({ ...c, count: Number(c.count) })));
      setSuspicious(suspResp.rows);
      setSuspiciousTotal(suspResp.total);
      setByAlgorithm(algo);
      setTrend(trendData);
      setError(null);
    } catch (err) {
      setError("Failed to load analytics data. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

 const simulateTraffic = async () => {
  setSimulating(true);
  setSimulateMsg("Sending burst traffic to Rate Limiter...");

  const endpoints = ["/api/fixed", "/api/sliding", "/api/token-bucket", "/api/leaky-bucket"];
  const REQUESTS_PER_ENDPOINT = 30;

  try {
    for (const endpoint of endpoints) {
      setSimulateMsg(`Sending traffic to ${endpoint}...`);
      for (let i = 0; i < REQUESTS_PER_ENDPOINT; i++) {
        try {
          await fetch(`${RATE_LIMITER_BASE}${endpoint}?_=${Date.now()}_${i}`, {
            mode: "no-cors",
            cache: "no-store",
          });
        } catch (e) {
          // ignore individual failures, keep going
        }
      }
    }

    setSimulateMsg(
      "Traffic sent (120 sequential requests across all 4 algorithms)! Pipeline is processing (Kinesis buffer + Lambda + partition refresh) — dashboard will reflect new data in ~2 minutes. It'll auto-refresh, no need to reload."
    );
  } catch (err) {
    setSimulateMsg("Traffic sent, but couldn't confirm delivery. Check back in a couple minutes anyway.");
  } finally {
    setSimulating(false);
    setTimeout(() => setSimulateMsg(""), 20000);
  }
};

  const COLORS = ["#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa"];

  if (loading) return <div className="loading-screen">Loading analytics...</div>;

  return (
    <div className="dashboard-container">
      <nav className="top-nav">
        <div className="nav-brand">
          <Shield className="brand-icon" />
          <span>AWS Brain AI <span className="brand-accent">Analytics</span></span>
        </div>
      </nav>

      <div className="dashboard">
        <header className="dashboard-header">
          <h1>Real-Time Traffic Analytics</h1>
          <p>
            Live pipeline: Kinesis Firehose → S3 → Lambda → Glue → Athena → Dashboard.
            The data below reflects actual captured traffic from load-testing sessions —
            it's not mock data. Use the button below to send new traffic and watch the
            pipeline update in real time (auto-refreshes every 15s).
          </p>
          {error && <p className="error-banner">{error}</p>}

          <div className="simulate-section">
            <button
              onClick={simulateTraffic}
              disabled={simulating}
              className="simulate-btn"
            >
              <Zap size={16} />
              {simulating ? "Sending traffic..." : "Simulate Traffic Burst"}
            </button>
            {simulateMsg && <p className="simulate-msg">{simulateMsg}</p>}
          </div>
        </header>

        <div className="stat-cards">
          <div className="stat-card">
            <div className="card-header">
              <span>Total Suspicious Events</span>
              <AlertTriangle size={18} className="icon-warn" />
            </div>
            <span className="stat-value">{suspiciousTotal}</span>
          </div>
          <div className="stat-card">
            <div className="card-header">
              <span>Unique IPs Tracked</span>
              <Activity size={18} className="icon-info" />
            </div>
            <span className="stat-value">{topIps.length}</span>
          </div>
          <div className="stat-card">
            <div className="card-header">
              <span>Algorithms Monitored</span>
              <TrendingUp size={18} className="icon-good" />
            </div>
            <span className="stat-value">{byAlgorithm.length}</span>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="chart-panel">
            <h2>Traffic Trend by Hour</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="hour_bucket" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Legend />
                <Line type="monotone" dataKey="request_count" name="Total Requests" stroke="#60a5fa" strokeWidth={2} />
                <Line type="monotone" dataKey="rate_limited_count" name="Rate Limited (429)" stroke="#f87171" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel">
            <h2>Top Offending IPs</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topIps}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="ip" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Bar dataKey="request_count" fill="#fbbf24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel">
            <h2>Status Code Distribution</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusCodes}
                  dataKey="count"
                  nameKey="statuscode"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {statusCodes.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-panel">
            <h2>Requests by Algorithm</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byAlgorithm}>
                <CartesianGrid stroke="#1e293b" vertical={false} />
                <XAxis dataKey="algorithm" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
                <Legend />
                <Bar dataKey="total_requests" name="Total" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="suspicious_count" name="Suspicious" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-panel full-width">
          <h2>Recent Suspicious Activity</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>IP</th><th>Method</th><th>Path</th><th>Status</th><th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {suspicious.length === 0 ? (
                <tr><td colSpan="5" className="empty-row">No suspicious activity detected</td></tr>
              ) : (
                suspicious.map((row, i) => (
                  <tr key={i}>
                    <td>{row.ip}</td>
                    <td>{row.method}</td>
                    <td>{row.path}</td>
                    <td className="status-bad">{row.statuscode}</td>
                    <td>{row.timestamp}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;