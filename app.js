const CLASS_COLORS = {
    Warrior: "#c69b6d", Paladin: "#f48cba", Hunter: "#aad372", Rogue: "#fff468",
    Priest: "#ffffff", Shaman: "#4a9eff", Mage: "#3fc7eb", Warlock: "#9fa0f5", Druid: "#ff7c0a",
    "Death Knight": "#e0435a", "Demon Hunter": "#c26fe0", Monk: "#00ff98", Evoker: "#4fc2a8"
  };

  // Class icons in images/class_icons. Classes not listed here show no icon.
  // File names must match exactly, capital letters included.
  const ICON_FOLDER = "images/class_icons/";
  const CLASS_ICONS = {
    Warrior: "warrior.png", Paladin: "paladin.png", Hunter: "hunter.png",
    Rogue: "rogue.png", Priest: "priest.png", Shaman: "shaman.png",
    Mage: "mage.png", Warlock: "warlock.png", Druid: "druid.png",
    Monk: "monk.png", "Death Knight": "deathknight.png",
    "Demon Hunter": "demonhunter.png", Evoker: "evoker.png"
  };

  // Race icons in images/race_icons, named like "orc-male.png" or "nightelf-female.png":
  // race in lowercase with spaces, apostrophes and hyphens removed, then -male or -female.
  const RACE_FOLDER = "images/race_icons/";
  // Races whose file name isn't just the race name with spaces removed
  const RACE_FILE_NAMES = {
    "Mag'har Orc": "maghar",
    "Lightforged Draenei": "lightforged",
    "Dark Iron Dwarf": "darkiron",
    "Highmountain Tauren": "highmountain",
    "Zandalari Troll": "zandalaritroll",
    "Kul Tiran": "kultiranhuman",
    "Earthen": "earthen",
  };
  function raceIcon(p) {
    if (!p.race || !p.gender) return "";
    const base = RACE_FILE_NAMES[p.race] || p.race.toLowerCase().replace(/['\s-]/g, "");
    const file = `${base}-${p.gender.toLowerCase()}.png`;
    // If an icon file is missing, hide it instead of showing a broken image
    return `<img class="class-icon" src="${RACE_FOLDER}${file}" alt="${p.race}" onerror="this.remove()">`;
  }

  // Each character's page on Blizzard's Armory site
  const ARMORY_REGION = "us";       // "eu" for EU realms
  const ARMORY_LOCALE = "en-us";    // "en-gb" for EU

  function armoryLink(p, span, className = "player") {
    if (!p.realm) { span.textContent = p.name; return span; }
    const a = document.createElement("a");
    a.className = className;
    a.href = `https://worldofwarcraft.blizzard.com/${ARMORY_LOCALE}/character/${ARMORY_REGION}/${p.realm}/${encodeURIComponent(p.name.toLowerCase())}`;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = p.name;
    const icon = document.createElement("span");
    icon.className = "ext";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "↗";
    a.appendChild(icon);
    span.replaceWith(a);
    return a;
  }

  // Blizzard's rendered character portrait, if there is one
  function avatarImg(p) {
    if (!p.avatar) return "";
    return `<img class="avatar" src="${p.avatar}" alt="" loading="lazy" onerror="this.remove()">`;
  }

  let data;
  let currentCategory = null;

  function showBoard(category) {
    if (!document.getElementById("rows")) return;
    currentCategory = category;
    document.querySelectorAll("#tabs button").forEach(b => {
      b.setAttribute("aria-pressed", b.dataset.key === category.key ? "true" : "false");
    });
    document.getElementById("board-title").textContent = category.label;
    document.getElementById("value-heading").textContent = category.column || category.label;

    // Leave out anyone Blizzard had no number for in this category
    const sorted = data.players.filter(p => typeof p.stats[category.key] === "number").sort((a, b) =>
      category.order === "asc"
        ? a.stats[category.key] - b.stats[category.key]
        : b.stats[category.key] - a.stats[category.key]
    );

    const rows = document.getElementById("rows");
    rows.innerHTML = "";
    const search = document.getElementById("board-search").value.trim().toLowerCase();
    let shown = 0;
    let rank = 0, lastValue = null;
    sorted.forEach((p, i) => {
      const value = p.stats[category.key];
      if (value !== lastValue) { rank = i + 1; lastValue = value; } // tied players share a rank
      // Ranks are worked out before filtering, so a searched player keeps their real rank
      if (search && !p.name.toLowerCase().includes(search)) return;
      shown++;
      const tr = document.createElement("tr");
      if (rank <= 3) tr.className = "top r" + rank;
      tr.innerHTML = `
        <td><span class="rank">${rank}</span></td>
        <td class="class-col">${raceIcon(p)}</td>
        <td class="class-col">${CLASS_ICONS[p.class] ? `<img class="class-icon" src="${ICON_FOLDER}${CLASS_ICONS[p.class]}" alt="${p.class}">` : ""}</td>
        <td class="level-col">${p.stats.level ?? ""}</td>
        <td><div class="player-cell">${avatarImg(p)}<span><span class="player"></span><span class="meta"></span></span></div></td>
        <td>${category.key === "winRate" ? value.toFixed(1) + "%" : value.toLocaleString()}</td>`;
      const name = armoryLink(p, tr.querySelector(".player"));
      name.style.color = CLASS_COLORS[p.class] || "inherit";
      tr.querySelector(".meta").textContent = `${p.race} ${p.class}`;
      rows.appendChild(tr);
    });
    document.getElementById("rows-no-match").hidden = shown > 0;
  }

  function showRoster() {
    if (!document.getElementById("roster-list")) return;
    const search = document.getElementById("roster-search").value.trim().toLowerCase();
    const matches = search
      ? data.players.filter(p => p.name.toLowerCase().includes(search))
      : data.players;
    const byClass = {};
    matches.forEach(p => (byClass[p.class] ||= []).push(p));
    document.getElementById("roster-count").textContent = search
      ? `${matches.length} of ${data.players.length} members`
      : `${data.players.length} members`;
    document.getElementById("roster-no-match").hidden = matches.length > 0;
    const list = document.getElementById("roster-list");
    list.innerHTML = "";
    Object.keys(byClass).sort().forEach(cls => {
      const members = byClass[cls].sort((a, b) => b.stats.level - a.stats.level);
      const box = document.createElement("div");
      box.className = "class-group";
      box.style.borderTopColor = CLASS_COLORS[cls] || "var(--bronze)";
      const listId = "roster-" + cls.replace(/\s+/g, "-").toLowerCase();
      const startOpen = search.length > 0;
      box.innerHTML = `
        <h3><button class="class-toggle" aria-expanded="${startOpen}" aria-controls="${listId}">
          <span class="arrow" aria-hidden="true">▶</span>
          <span class="name"></span>
          <span class="count"></span>
        </button></h3>
        <ul id="${listId}" ${startOpen ? "" : "hidden"}></ul>`;
      const toggle = box.querySelector(".class-toggle");
      toggle.style.color = CLASS_COLORS[cls] || "inherit";
      toggle.querySelector(".name").textContent = cls;
      toggle.querySelector(".count").textContent = members.length;
      // Click the header to open or close the list of names
      toggle.addEventListener("click", () => {
        const open = toggle.getAttribute("aria-expanded") === "true";
        toggle.setAttribute("aria-expanded", String(!open));
        box.querySelector("ul").hidden = open;
      });
      members.forEach(p => {
        const li = document.createElement("li");
        const nameSpan = document.createElement("span");
        li.appendChild(nameSpan);
        armoryLink(p, nameSpan, "roster-name").style.color = CLASS_COLORS[p.class] || "inherit";
        const lvl = document.createElement("span");
        lvl.textContent = `Lv ${p.stats.level}`;
        li.appendChild(lvl);
        box.querySelector("ul").appendChild(li);
      });
      list.appendChild(box);
    });
  }

  // ----- PvP table: one row per player, one column per PvP stat -----
  // Click a column heading to rank by that stat. Opens on win rate.
  let pvpSort = null;

  function buildPvp() {
    const head = document.getElementById("pvp-head");
    if (!head || !data.pvpCategories) return;
    data.pvpCategories.forEach(cat => {
      const th = document.createElement("th");
      th.className = "stat-col";
      const btn = document.createElement("button");
      btn.className = "sort-btn";
      btn.textContent = cat.column || cat.label;
      btn.addEventListener("click", () => { pvpSort = cat; showPvp(); });
      th.appendChild(btn);
      head.appendChild(th);
    });
    pvpSort = data.pvpCategories.find(c => c.key === "winRate") || data.pvpCategories[0];
    showPvp();
  }

  function showPvp() {
    const rows = document.getElementById("pvp-rows");
    if (!rows || !data.pvpCategories) return;
    const cats = data.pvpCategories;

    document.querySelectorAll("#pvp-head .sort-btn").forEach((b, i) => {
      b.setAttribute("aria-pressed", cats[i].key === pvpSort.key ? "true" : "false");
    });

    // Only players with a number in the sorted column are ranked
    const sorted = data.players
      .filter(p => typeof p.stats[pvpSort.key] === "number")
      .sort((a, b) => pvpSort.order === "asc"
        ? a.stats[pvpSort.key] - b.stats[pvpSort.key]
        : b.stats[pvpSort.key] - a.stats[pvpSort.key]);

    const search = document.getElementById("pvp-search").value.trim().toLowerCase();
    rows.innerHTML = "";
    let shown = 0, rank = 0, lastValue = null;
    sorted.forEach((p, i) => {
      const value = p.stats[pvpSort.key];
      if (value !== lastValue) { rank = i + 1; lastValue = value; }
      if (search && !p.name.toLowerCase().includes(search)) return;
      shown++;
      const tr = document.createElement("tr");
      if (rank <= 3) tr.className = "top r" + rank;
      const cells = cats.map(c => {
        const v = p.stats[c.key];
        const text = typeof v !== "number" ? "—"
          : c.key === "winRate" ? v.toFixed(1) + "%"
          : v.toLocaleString();
        return `<td class="stat-col${c.key === pvpSort.key ? " sorted" : ""}">${text}</td>`;
      }).join("");
      tr.innerHTML = `
        <td><span class="rank">${rank}</span></td>
        <td class="class-col">${raceIcon(p)}</td>
        <td class="class-col">${CLASS_ICONS[p.class] ? `<img class="class-icon" src="${ICON_FOLDER}${CLASS_ICONS[p.class]}" alt="${p.class}">` : ""}</td>
        <td class="level-col">${p.stats.level ?? ""}</td>
        <td><div class="player-cell">${avatarImg(p)}<span><span class="player"></span><span class="meta"></span></span></div></td>
        ${cells}`;
      const name = armoryLink(p, tr.querySelector(".player"));
      name.style.color = CLASS_COLORS[p.class] || "inherit";
      tr.querySelector(".meta").textContent = `${p.race} ${p.class}`;
      rows.appendChild(tr);
    });
    document.getElementById("pvp-no-match").hidden = shown > 0;
  }

  // ----- Home page: guild snapshot -----
  function showSnapshot() {
    const box = document.getElementById("snapshot");
    if (!box) return;
    const levels = data.players.map(p => p.stats.level).filter(l => typeof l === "number");
    // Max level is read from the roster, so it keeps working when the cap changes
    const cap = levels.length ? Math.max(...levels) : null;
    const atCap = cap === null ? 0 : levels.filter(l => l === cap).length;
    const cards = [
      { label: "Members", value: data.players.length },
      { label: cap === null ? "At max level" : `At level ${cap}`, value: atCap },
    ];
    box.innerHTML = "";
    cards.forEach(c => {
      const el = document.createElement("div");
      el.className = "stat-card";
      el.innerHTML = `<span class="stat-label"></span><span class="stat-value">${c.value.toLocaleString()}</span>`;
      el.querySelector(".stat-label").textContent = c.label;
      box.appendChild(el);
    });
  }

  // ----- Home page: stat of the day -----
  // One board is featured each day, the same one for everyone, changing at midnight.
  // To limit which boards can appear, list their keys here, e.g. ["fishCaught", "lold"].
  const STAT_OF_DAY_KEYS = [];

  function showStatOfDay() {
    const box = document.getElementById("stat-of-day");
    if (!box) return;
    const pool = (data.categories || []).filter(c =>
      (!STAT_OF_DAY_KEYS.length || STAT_OF_DAY_KEYS.includes(c.key)) &&
      data.players.some(p => typeof p.stats[c.key] === "number")
    );
    if (!pool.length) { box.hidden = true; return; }

    // Pick by date so the stat is the same all day and changes overnight
    const day = Math.floor(Date.now() / 86400000);
    const cat = pool[day % pool.length];

    const ranked = data.players
      .filter(p => typeof p.stats[cat.key] === "number")
      .sort((a, b) => cat.order === "asc"
        ? a.stats[cat.key] - b.stats[cat.key]
        : b.stats[cat.key] - a.stats[cat.key]);
    const top = ranked[0];
    if (!top) { box.hidden = true; return; }

    const value = top.stats[cat.key];
    const fmt = v => cat.key === "winRate" ? v.toFixed(1) + "%" : v.toLocaleString();
    let margin = "";
    if (ranked[1]) {
      const gap = Math.abs(value - ranked[1].stats[cat.key]);
      margin = gap === 0 ? " · tied for first" : ` · ${fmt(gap)} ahead of second place`;
    }

    box.hidden = false;
    box.innerHTML = `
      <div class="sod-label"></div>
      <div class="sod-body">
        ${avatarImg(top)}
        <span>
          <span class="sod-line"><span class="player"></span> leads with <span class="sod-value">${fmt(value)}</span></span>
          <span class="meta"></span>
        </span>
      </div>`;
    box.querySelector(".sod-label").textContent = `Stat of the day · ${cat.label}`;
    const name = armoryLink(top, box.querySelector(".player"));
    name.style.color = CLASS_COLORS[top.class] || "inherit";
    box.querySelector(".meta").textContent = `${top.race} ${top.class}${margin}`;
  }

  // ----- Home page: recent lead changes -----
  function showLeadChanges() {
    const list = document.getElementById("lead-changes");
    if (!list) return;
    const all = data.leadChanges || [];
    list.innerHTML = "";
    if (!all.length) {
      list.innerHTML = '<p class="no-match">No leads have changed hands yet.</p>';
      return;
    }
    all.forEach(t => {
      const fmt = v => t.key === "winRate" ? v.toFixed(1) + "%" : v.toLocaleString();
      const row = document.createElement("div");
      row.className = "feed-row lead-row";
      row.innerHTML = `
        ${avatarImg(t)}
        <span>
          <span class="feed-line"><span class="player"></span> took the lead in <span class="feat"></span></span>
          <span class="meta"></span>
        </span>
        <span class="when">${timeAgo(t.when)}</span>`;
      const name = armoryLink({ name: t.name, realm: t.realm }, row.querySelector(".player"));
      name.style.color = CLASS_COLORS[t.class] || "inherit";
      row.querySelector(".feat").textContent = t.label;
      row.querySelector(".meta").textContent =
        `${fmt(t.value)} · passed ${t.previous}`;
      list.appendChild(row);
    });
  }

  // ----- Home page: the guild's newest achievements -----
  function timeAgo(ms) {
    const mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 60) return mins <= 1 ? "just now" : `${mins} minutes ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function showFeed() {
    const list = document.getElementById("feed");
    if (!list) return;
    const all = data.recent || [];
    list.innerHTML = "";
    if (!all.length) {
      list.innerHTML = '<p class="no-match">No achievements recorded yet.</p>';
      return;
    }
    all.forEach(a => {
      const row = document.createElement("div");
      row.className = "feed-row";
      row.innerHTML = `
        ${avatarImg(a)}
        <span>
          <span class="feed-line"><span class="player"></span> earned <span class="feat"></span></span>
          <span class="meta"></span>
        </span>
        <span class="when">${timeAgo(a.when)}</span>`;
      const name = armoryLink({ name: a.player, realm: a.realm }, row.querySelector(".player"));
      name.style.color = CLASS_COLORS[a.class] || "inherit";
      row.querySelector(".feat").textContent = a.name;
      row.querySelector(".meta").textContent = `${a.race} ${a.class}`;
      list.appendChild(row);
    });
  }

  // ----- Composition bar charts -----
  const BREAKDOWNS = [
    { key: "class",  label: "Class",  value: p => p.class, color: v => CLASS_COLORS[v] || "var(--bronze)" },
    { key: "race",   label: "Race",   value: p => p.race,  color: () => "var(--bronze)" },
    { key: "level",  label: "Level",  value: p => levelBand(p.stats.level), color: () => "var(--blood)" },
  ];

  function levelBand(lv) {
    if (typeof lv !== "number") return "Unknown";
    if (lv >= 80) return "80+";
    const low = Math.floor(lv / 10) * 10;
    return `${low}-${low + 9}`;
  }

  function showChart(bd) {
    if (!document.getElementById("bars")) return;
    document.querySelectorAll("#chart-tabs button").forEach(b => {
      b.setAttribute("aria-pressed", b.dataset.key === bd.key ? "true" : "false");
    });
    const counts = {};
    data.players.forEach(p => {
      const v = bd.value(p) || "Unknown";
      counts[v] = (counts[v] || 0) + 1;
    });
    // Levels read best in order; everything else by size
    const entries = Object.entries(counts).sort((a, b) =>
      bd.key === "level" ? b[0].localeCompare(a[0], undefined, { numeric: true }) : b[1] - a[1]
    );
    const most = Math.max(...entries.map(e => e[1]));
    const bars = document.getElementById("bars");
    bars.innerHTML = "";
    entries.forEach(([name, count]) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `
        <span class="bar-label"></span>
        <span class="bar-track"><span class="bar-fill"></span></span>
        <span class="bar-value">${count}</span>`;
      row.querySelector(".bar-label").textContent = name;
      const fill = row.querySelector(".bar-fill");
      fill.style.width = (count / most * 100) + "%";
      fill.style.background = bd.color(name);
      bars.appendChild(row);
    });
  }

  // Mark the menu link for the page we're on
  const here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".menu a").forEach(a => {
    if (a.getAttribute("href") === here) a.classList.add("current");
  });

  fetch("players.json?v=" + Date.now(), { cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(json => {
      data = json;
      const notice = document.getElementById("notice");
      if (notice) notice.hidden = !data.sampleData;
      const stamp = document.getElementById("updated");
      if (stamp) stamp.textContent = `Last updated ${data.updated}`;
      const tabs = document.getElementById("tabs");
      if (tabs) data.categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.textContent = cat.label;
        btn.dataset.key = cat.key;
        btn.addEventListener("click", () => showBoard(cat));
        tabs.appendChild(btn);
      });
      if (tabs) showBoard(data.categories[0]);
      showRoster();
      buildPvp();
      showSnapshot();
      showStatOfDay();
      showLeadChanges();
      showFeed();
      document.getElementById("pvp-search")?.addEventListener("input", showPvp);
      const chartTabs = document.getElementById("chart-tabs");
      if (chartTabs) BREAKDOWNS.forEach(bd => {
        const btn = document.createElement("button");
        btn.textContent = bd.label;
        btn.dataset.key = bd.key;
        btn.addEventListener("click", () => showChart(bd));
        chartTabs.appendChild(btn);
      });
      if (chartTabs) showChart(BREAKDOWNS[0]);
      document.getElementById("board-search")?.addEventListener("input", () => showBoard(currentCategory));
      document.getElementById("roster-search")?.addEventListener("input", showRoster);
    })
    .catch(() => {
      const note = "The guild data couldn't load. Check that players.json is in the same folder as the pages.";
      const t = document.getElementById("board-title");
      if (t) t.textContent = "The data couldn't load";
      const rows = document.getElementById("rows") || document.getElementById("pvp-rows");
      if (rows) rows.innerHTML = `<tr><td colspan="8">${note}</td></tr>`;
      const feed = document.getElementById("feed");
      if (feed) feed.innerHTML = `<p class="no-match">${note}</p>`;
      const roster = document.getElementById("roster-list");
      if (roster) roster.innerHTML = `<p class="no-match">${note}</p>`;
    });
