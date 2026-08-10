import { performance } from "node:perf_hooks";

const baseUrl = process.env.TRACEWEAVE_BASE_URL || "http://127.0.0.1:8787";
const concurrency = Math.max(1, Number(process.env.TRACEWEAVE_LOAD_CONCURRENCY || 10));
const requests = Math.max(concurrency, Number(process.env.TRACEWEAVE_LOAD_REQUESTS || 200));
const latencies = [];
let failures = 0;
let cursor = 0;

async function worker() {
  while (cursor < requests) {
    cursor += 1;
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    } catch {
      failures += 1;
    } finally {
      latencies.push(performance.now() - started);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
latencies.sort((a, b) => a - b);
const percentile = (value) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * value))];
const summary = { requests, concurrency, failures, p50Ms: percentile(0.5).toFixed(1), p95Ms: percentile(0.95).toFixed(1), p99Ms: percentile(0.99).toFixed(1) };
console.log(JSON.stringify(summary));
if (failures) process.exitCode = 1;
