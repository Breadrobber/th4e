// Totem Huggers data collector

const fs = require("fs");
const path = require("path");

// ---------- Settings: change these to match your guild ----------
const REGION = "us";                 // "us" or "eu"
const REALM = "sargeras";     // exactly as it appears in game, e.g. "Area 52"
const GUILD = "not-clan";     // exactly as it appears in game, use hyphen for spaces
const MIN_LEVEL = 10;                // min level
const RECENT_PER_PLAYER = 5;         // newest achievements kept per character
const RECENT_TOTAL = 5;             // how many show on the home page
const LEAD_CHANGES_KEPT = 5;         // lead changes remembered for the home page
const SKIP_LEAD_CHANGES = ["itemLevel"];   // boards that never count as a lead change
// ------------------------------------------------------------------

const CLIENT_ID = process.env.BLIZZARD_CLIENT_ID;
const CLIENT_SECRET = process.env.BLIZZARD_CLIENT_SECRET;
const API = `https://${REGION}.api.blizzard.com`;
const NAMESPACE = `profile-${REGION}`;
const OUTPUT = path.join(__dirname, "..", "players.json");

// ---------- Leaderboard tabs ----------
// Each line is one tab on the site, in this order.
//   key:    a short unique id, letters only, no spaces
//   label:  the tab's name on the site
//   column: (optional) the column heading, if it should differ from the label
//   order:  "desc" = highest wins, "asc" = lowest wins
//   stat:   the statistic's name EXACTLY as it appears in stats-list.txt
// The first three tabs come from other parts of the API, so they have no "stat".

const CATEGORIES = [
  //{ key: "achievementPoints", label: "Achievement points", order: "desc" },
  { key: "itemLevel",         label: "Item level",         order: "desc" },
  { key: "quests",            label: "Quests completed",   order: "desc", stat: "Quests completed" },
  { key: "lold",              label: "Times LOL'd",        order: "desc", stat: "Total times LOL'd" },
  { key: "cheers",            label: "Total cheers",       order: "desc", stat: "Total cheers" },
  { key: "bgWins",            label: "Battleground wins",  order: "desc", stat: "Battlegrounds won" },
  { key: "falling",           label: "Falling deaths",     order: "desc", stat: "Deaths from falling" },
  { key: "flightPath",        label: "Flight Paths taken", order: "desc", stat: "Flight paths taken" },
  { key: "deaths",            label: "Fewest deaths",      order: "asc",  stat: "Total deaths", column: "Deaths" },
  { key: "elixirs",           label: "Elixirs consumed",   order: "desc", stat: "Elixirs consumed" },
  { key: "beverages",         label: "Beverages consumed", order: "desc", stat: "Beverages consumed" },
  { key: "foodEaten",         label: "Food eaten",         order: "desc", stat: "Food eaten" },
  { key: "healthstones",      label: "Healthstones used",  order: "desc", stat: "Healthstones used" },
  { key: "fishCaught",        label: "Fish caught",        order: "desc", stat: "Fish caught" },
  { key: "hearths",           label: "Times hearthed",     order: "desc", stat: "Number of times hearthed" },
  { key: "duelsWon",          label: "Duels won",          order: "desc", stat: "Duels won" },
];

// ---------- PvP leaderboard tabs (the PvP page) ----------
// Same settings as above. "winRate" is worked out below, not read from a stat.
const PVP_CATEGORIES = [
  { key: "honorKills", label: "Honorable kills", order: "desc", stat: "Total Honorable Kills" },
  { key: "pvpDeaths",  label: "PvP deaths",      order: "desc", stat: "Total deaths from opposite faction" },
  { key: "winRate",    label: "Win rate",        order: "desc", column: "Win %" },
];
const ALL_CATEGORIES = [...CATEGORIES, ...PVP_CATEGORIES];
// ----------------------------------------

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
  if (!res.ok) throw new Error(`Login to Blizzard failed (${res.status}). Check your client ID and secret.`);
  return (await res.json()).access_token;
}

async function api(token, urlPath) {
  const sep = urlPath.includes("?") ? "&" : "?";
  const res = await fetch(`${API}${urlPath}${sep}namespace=${NAMESPACE}&locale=en_US`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;               // character hidden or inactive
  if (!res.ok) throw new Error(`${urlPath} returned ${res.status}`);
  return res.json();
}

// Search Blizzard's nested statistics categories for one stat by name
function findStat(statsData, name) {
  if (!statsData) return null;
  const walk = cats => {
    for (const c of cats || []) {
      const hit = (c.statistics || []).find(s => s.name === name);
      if (hit) return hit.quantity;
      const deeper = walk(c.sub_categories);
      if (deeper != null) return deeper;
    }
    return null;
  };
  return walk(statsData.categories);
}

async function collectMember(token, member) {
  const realm = member.character.realm.slug;
  const name = encodeURIComponent(member.character.name.toLowerCase());
  const base = `/profile/wow/character/${realm}/${name}`;

  const [profile, stats, mounts, media, achievements] = await Promise.all([
    api(token, base),
    api(token, `${base}/achievements/statistics`),
    api(token, `${base}/collections/mounts`),
    api(token, `${base}/character-media`),
    api(token, `${base}/achievements`),
  ]);
  if (!profile) return null;

  const player = {
    name: profile.name,
    class: profile.character_class?.name ?? "Unknown",
    race: profile.race?.name ?? "",
    gender: profile.gender?.type ?? "",
    realm: profile.realm?.slug ?? realm,  // used to build the Armory link
    avatar: media?.assets?.find(a => a.key === "avatar")?.value ?? null,
    stats: {
      level: profile.level,
      achievementPoints: profile.achievement_points ?? null,
      itemLevel: profile.equipped_item_level ?? null,
      mounts: mounts?.mounts?.length ?? null,
    },
  };
  // Fill in every tab that uses a statistic from the Statistics list
  for (const cat of ALL_CATEGORIES) {
    if (cat.stat) player.stats[cat.key] = findStat(stats, cat.stat);
  }

  // The newest achievements this character finished, for the home page feed
  player.recent = (achievements?.achievements ?? [])
    .filter(a => a.completed_timestamp)
    .sort((a, b) => b.completed_timestamp - a.completed_timestamp)
    .slice(0, RECENT_PER_PLAYER)
    .map(a => ({ name: a.achievement?.name ?? "Unknown", when: a.completed_timestamp }));

  // Win rate: share of PvP encounters they walked away from
  const k = player.stats.honorKills, d = player.stats.pvpDeaths;
  player.stats.winRate = (typeof k === "number" && typeof d === "number" && k + d > 0)
    ? Math.round((k / (k + d)) * 1000) / 10
    : null;

  return player;
}

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET.");
  }
  const token = await getToken();

  const roster = await api(token, `/data/wow/guild/${slug(REALM)}/${slug(GUILD)}/roster`);
  if (!roster) throw new Error(`Guild not found. Check REALM ("${REALM}") and GUILD ("${GUILD}").`);

  const members = roster.members.filter(m => m.character.level >= MIN_LEVEL);
  console.log(`Found ${roster.members.length} members, ${members.length} at level ${MIN_LEVEL}+`);

  // Fetch a few characters at a time to stay well under Blizzard's rate limit
  const players = [];
  for (let i = 0; i < members.length; i += 5) {
    const batch = await Promise.all(members.slice(i, i + 5).map(m =>
      collectMember(token, m).catch(err => { console.warn(`Skipped ${m.character.name}: ${err.message}`); return null; })
    ));
    batch.forEach(p => p && players.push(p));
  }

  for (const cat of ALL_CATEGORIES) {
    if (cat.stat && !players.some(p => typeof p.stats[cat.key] === "number")) {
      console.warn(`No one had a value for "${cat.stat}". Check the spelling against stats-list.txt.`);
    }
  }

  // Merge everyone's achievements into one guild feed, newest first
  const recent = [];
  players.forEach(p => {
    (p.recent || []).forEach(a => recent.push({
      player: p.name, class: p.class, race: p.race,
      realm: p.realm, avatar: p.avatar, name: a.name, when: a.when,
    }));
    delete p.recent;   // the feed holds these now; keeps players.json small
  });
  recent.sort((a, b) => b.when - a.when);

  // Who leads each board now
  const leaderOf = (cats) => {
    const out = {};
    cats.forEach(cat => {
      const ranked = players
        .filter(p => typeof p.stats[cat.key] === "number")
        .sort((a, b) => cat.order === "asc"
          ? a.stats[cat.key] - b.stats[cat.key]
          : b.stats[cat.key] - a.stats[cat.key]);
      if (ranked.length) out[cat.key] = { name: ranked[0].name, value: ranked[0].stats[cat.key] };
    });
    return out;
  };
  const leaders = leaderOf(ALL_CATEGORIES);

  // Compare against last run to spot anyone who has taken over a board
  let previous = {}, history = [];
  try {
    const last = JSON.parse(fs.readFileSync(OUTPUT, "utf8"));
    previous = last.leaders || {};
    history = last.leadChanges || [];
  } catch { /* first run, or no file yet */ }

  const takeovers = [];
  for (const cat of ALL_CATEGORIES) {
    const now = leaders[cat.key], before = previous[cat.key];
    // Only a genuine change of name counts, and never on the first run
    if (now && before && now.name !== before.name && !SKIP_LEAD_CHANGES.includes(cat.key)) {
      const taker = players.find(p => p.name === now.name);
      takeovers.push({
        label: cat.label,
        key: cat.key,
        name: now.name,
        value: now.value,
        previous: before.name,
        previousValue: before.value,
        class: taker?.class ?? "",
        race: taker?.race ?? "",
        realm: taker?.realm ?? "",
        avatar: taker?.avatar ?? null,
        when: Date.now(),
      });
    }
  }
  // Newest first, keeping a short history so the home page always has something
  const leadChanges = [...takeovers, ...history].slice(0, LEAD_CHANGES_KEPT);

  if (takeovers.length) {
    takeovers.forEach(t => console.log(`${t.name} took the lead on ${t.label} from ${t.previous}`));
  } else {
    console.log("No leads changed hands this run.");
  }

  const output = {
    guild: roster.guild.name,
    faction: roster.guild.faction?.name ?? "",
    sampleData: false,
    updated: new Date().toISOString().slice(0, 10),
    categories: CATEGORIES,
    pvpCategories: PVP_CATEGORIES,
    leaders,
    takeovers,
    leadChanges,
    recent: recent.slice(0, RECENT_TOTAL),
    players,
  };
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2));
  console.log(`Saved ${players.length} players to players.json`);
}

main().catch(err => { console.error(err.message); process.exit(1); });
