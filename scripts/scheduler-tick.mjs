const origin = process.env.SCHEDULER_ORIGIN;
const secret = process.env.CRON_SECRET;
if (!origin || !secret) throw new Error("SCHEDULER_ORIGIN and CRON_SECRET are required");
const response = await fetch(new URL("/api/tahrir/tick", origin), {
  method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(55_000),
});
if (!response.ok) throw new Error(`Scheduler failed: HTTP ${response.status}`);
const result = await response.json();
console.log(JSON.stringify({ ok: result.ok, promoted: result.promoted }));
