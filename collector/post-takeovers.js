// Posts to Discord when someone takes over the lead on a board.
// Reads the "takeovers" list the collector works out, so it only posts
// when a lead actually changed hands. Silent otherwise.

const fs = require("fs");
const path = require("path");

// ---------- Settings ----------
const SITE_URL = "https://breadrobber.github.io/totem-huggers-guild-website/";   // your site's address
const SKIP_KEYS = ["itemLevel"];   // boards not worth announcing
// ------------------------------

const WEBHOOK = process.env.DISCORD_WEBHOOK;
const DATA = path.join(__dirname, "..", "players.json");

async function main() {
  if (!WEBHOOK) throw new Error("Missing DISCORD_WEBHOOK secret.");

  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const takeovers = (data.takeovers || []).filter(t => !SKIP_KEYS.includes(t.key));
  if (!takeovers.length) {
    console.log("No takeovers to announce.");
    return;
  }

  const fmt = (key, v) => key === "winRate" ? v.toFixed(1) + "%" : v.toLocaleString();

  const embed = {
    title: takeovers.length === 1 ? "A lead has changed hands" : `${takeovers.length} leads have changed hands`,
    url: SITE_URL,
    color: 0xc8a253,                 // the site's bronze
    fields: takeovers.slice(0, 10).map(t => ({
      name: t.label,
      value: `**${t.name}** takes the lead with **${fmt(t.key, t.value)}**, passing ${t.previous}`,
      inline: false,
    })),
  };

  const res = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`Discord returned ${res.status}. Check the webhook secret.`);
  console.log(`Announced ${takeovers.length} takeover(s).`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
