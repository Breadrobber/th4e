// Probe the Blizzard API for WoW: Forever support.
// Tries several namespaces against one character, then reports which
// endpoints answer. Run it from Actions: "Probe Forever API".

// ---------- Settings ----------
const REGION = "us";
const REALM = "Normal";     // as it appears in game
const CHARACTER = "Bread-Whatever";      // first name only to start; see notes below
const GUILD = "";          // your Forever guild, if you have one yet
// ------------------------------

// Namespaces worth trying. Blizzard names these per game version.
const NAMESPACES = [
  "profile-us",
  "profile-classic-us",
  "profile-classic1x-us",
  "profile-forever-us",
  "profile-fresh-us",
  "profile-classic-fresh-us",
];

const CLIENT_ID = process.env.BLIZZARD_CLIENT_ID;
const CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET;
const API = `https://${REGION}.api.blizzard.com`;

const slug = s => s.trim().toLowerCase().replace(/'/g, "").replace(/\s+/g, "-");

async function getToken() {
  const res = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Login to Blizzard failed (${res.status}).`);
  return (await res.json()).access_token;
}

async function tryGet(token, path, ns) {
  const url = `${API}${path}?namespace=${ns}&locale=en_US`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, status: res.status, body: await res.json() };
  } catch (err) {
    return { ok: false, status: err.message };
  }
}

async function main() {
  const token = await getToken();
  const charPath = `/profile/wow/character/${slug(REALM)}/${encodeURIComponent(slug(CHARACTER))}`;

  // 1. Which namespace answers at all?
  console.log("=== Looking for a namespace that works ===");
  let working = null;
  for (const ns of NAMESPACES) {
    const r = await tryGet(token, charPath, ns);
    console.log(`${r.ok ? "WORKS " : "no    "} ${ns}  (${r.status})`);
    if (r.ok && !working) working = { ns, profile: r.body };
  }

  if (!working) {
    console.log("\nNo namespace returned the character.");
    console.log("Either Forever profiles aren't public yet, or REALM/CHARACTER need adjusting.");
    console.log("If the character has a two-part name, try the first name alone, then first-last.");
    return;
  }

  const { ns, profile } = working;
  console.log(`\n=== Using ${ns} ===`);
  console.log(`Character: ${profile.name}, level ${profile.level}, ` +
    `${profile.race?.name ?? "?"} ${profile.character_class?.name ?? "?"}`);
  console.log(`Achievement points: ${profile.achievement_points ?? "not present"}`);
  console.log(`Item level: ${profile.equipped_item_level ?? "not present"}`);
  console.log(`Last login: ${profile.last_login_timestamp ? new Date(profile.last_login_timestamp).toISOString() : "not present"}`);

  // 2. Which endpoints exist?
  console.log("\n=== Endpoints ===");
  const endpoints = {
    "statistics": `${charPath}/achievements/statistics`,
    "achievements": `${charPath}/achievements`,
    "character media": `${charPath}/character-media`,
    "mounts": `${charPath}/collections/mounts`,
    "pets": `${charPath}/collections/pets`,
    "titles": `${charPath}/titles`,
    "professions": `${charPath}/professions`,
    "pvp summary": `${charPath}/pvp-summary`,
    "guild roster": `/data/wow/guild/${slug(REALM)}/${slug(GUILD)}/roster`,
  };

  const results = {};
  for (const [label, path] of Object.entries(endpoints)) {
    const r = await tryGet(token, path, ns);
    results[label] = r;
    console.log(`${r.ok ? "WORKS " : "no    "} ${label}  (${r.status})`);
  }

  // 3. What's actually in the statistics list?
  const stats = results["statistics"];
  if (stats?.ok) {
    const names = [];
    const walk = cats => (cats || []).forEach(c => {
      (c.statistics || []).forEach(s => names.push(s.name));
      walk(c.sub_categories);
    });
    walk(stats.body.categories);
    console.log(`\n=== Statistics: ${names.length} found ===`);
    console.log("First 60:");
    names.slice(0, 60).forEach(n => console.log("  " + n));
  }

  // 4. What does the achievements endpoint look like?
  const ach = results["achievements"];
  if (ach?.ok) {
    const list = ach.body.achievements || [];
    const withTime = list.filter(a => a.completed_timestamp);
    console.log(`\n=== Achievements: ${list.length} total, ${withTime.length} with a completion time ===`);
    console.log("Top-level fields: " + Object.keys(ach.body).join(", "));
    if (list[0]) console.log("Fields on one entry: " + Object.keys(list[0]).join(", "));
    withTime
      .sort((a, b) => b.completed_timestamp - a.completed_timestamp)
      .slice(0, 5)
      .forEach(a => console.log(`  ${a.achievement?.name} — ${new Date(a.completed_timestamp).toISOString().slice(0,10)}`));
  }

  // 5. Roster shape
  const roster = results["guild roster"];
  if (roster?.ok) {
    const m = roster.body.members || [];
    console.log(`\n=== Guild roster: ${m.length} members ===`);
    if (m[0]) console.log("Fields on one member: " + Object.keys(m[0].character).join(", "));
    m.slice(0, 5).forEach(x => console.log(`  ${x.character.name} — level ${x.character.level}, rank ${x.rank}`));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Namespace to use: ${ns}`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
