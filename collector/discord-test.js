// Posts a short test message to Discord each time the collector runs.
// The webhook URL comes from the DISCORD_WEBHOOK secret, never from this file.

const WEBHOOK = process.env.DISCORD_WEBHOOK;

// Change this to your own zone, e.g. "America/New_York" or "UTC"
const TIME_ZONE = "America/New_York";

async function main() {
  if (!WEBHOOK) throw new Error("Missing DISCORD_WEBHOOK secret.");

  const stamp = new Date().toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });

  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: `Collector ran successfully — ${stamp}` }),
  });
  if (!res.ok) throw new Error(`Discord returned ${res.status}. Check the webhook secret.`);
  console.log("Posted to Discord.");
}

main().catch(err => { console.error(err.message); process.exit(1); });
