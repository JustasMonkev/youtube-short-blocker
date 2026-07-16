// ShortBlock UI — talks to the Rust backend via Tauri IPC.

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const el = (id) => document.getElementById(id);
let snapshot = null;
let countdownTimer = null;

// ---------- rendering ----------

function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtMinute(minute) {
  const d = new Date();
  d.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtCountdown(untilMs) {
  const left = Math.max(0, untilMs - Date.now());
  const mins = Math.ceil(left / 60000);
  if (mins >= 120) return `${Math.floor(mins / 60)} h ${mins % 60} min`;
  if (mins >= 60) return `1 h ${mins % 60} min`;
  return `${mins} min`;
}

function render(s) {
  snapshot = s;
  const { config } = s;
  const paused = config.paused_until && config.paused_until > s.now_ms;

  // Hero
  const orb = el("status-orb");
  const title = el("status-title");
  const subtitle = el("status-subtitle");
  el("master-toggle").checked = config.enabled;

  if (!config.enabled) {
    orb.dataset.tone = "off";
    title.textContent = "Blocking is off";
    subtitle.textContent = "Flip the switch to start blocking system-wide.";
  } else if (paused) {
    orb.dataset.tone = "warn";
    title.textContent = "On a break";
    subtitle.textContent = `Blocking resumes in ${fmtCountdown(config.paused_until)}.`;
  } else if (!s.blocking_active) {
    orb.dataset.tone = "warn";
    title.textContent = "Outside focus hours";
    subtitle.textContent = "Blocking will re-arm when your focus window starts.";
  } else {
    orb.dataset.tone = "on";
    title.textContent = "Blocking active";
    const n = s.active_domain_count;
    subtitle.textContent = n
      ? `${n} domain${n === 1 ? "" : "s"} blocked in every browser on this Mac.`
      : "Add a website below to start blocking.";
  }

  // Sync banner
  const banner = el("sync-banner");
  if (s.sync_error) {
    el("sync-banner-text").textContent = s.sync_error;
    banner.classList.remove("hidden");
  } else if (s.sync && !s.sync.in_sync) {
    el("sync-banner-text").textContent =
      "The system hosts file doesn’t match your block list yet.";
    banner.classList.remove("hidden");
  } else {
    banner.classList.add("hidden");
  }

  // Pause chips
  el("resume-btn").classList.toggle("hidden", !paused);

  // Site list
  const list = el("site-list");
  list.replaceChildren();
  const sites = [...config.sites].sort((a, b) => a.label.localeCompare(b.label));
  for (const site of sites) {
    list.appendChild(siteRow(site, s.now_ms));
  }
  el("site-empty").classList.toggle("hidden", sites.length > 0);
  const enabledCount = sites.filter((x) => x.enabled).length;
  el("site-count").textContent = sites.length
    ? `${enabledCount} of ${sites.length} rule${sites.length === 1 ? "" : "s"} enabled.`
    : "";

  // Schedule
  const scheduleStatus = el("schedule-status");
  const clearBtn = el("schedule-clear");
  if (config.schedule) {
    const { start_minute, end_minute } = config.schedule;
    el("schedule-start").value = minuteToInput(start_minute);
    el("schedule-end").value = minuteToInput(end_minute);
    scheduleStatus.textContent =
      start_minute === end_minute
        ? "Focus window covers the whole day."
        : `Blocking is enforced daily from ${fmtMinute(start_minute)} until ${fmtMinute(end_minute)}${start_minute > end_minute ? " (wraps past midnight)" : ""}.`;
    clearBtn.classList.remove("hidden");
  } else {
    scheduleStatus.textContent = "No focus window set — blocking applies all day.";
    clearBtn.classList.add("hidden");
  }

  // Footnote
  el("footnote").textContent = s.last_synced_at
    ? `Hosts file last updated at ${fmtTime(s.last_synced_at)} · changes need an administrator password`
    : "Changes are applied to /etc/hosts and need an administrator password.";

  armCountdowns();
}

function minuteToInput(minute) {
  const h = String(Math.floor(minute / 60)).padStart(2, "0");
  const m = String(minute % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function siteRow(site, nowMs) {
  const li = document.createElement("li");
  li.className = "site-row";

  const info = document.createElement("div");
  info.className = "site-info";
  const label = document.createElement("div");
  label.className = "site-label";
  label.textContent = site.label;
  const host = document.createElement("div");
  host.className = "site-host";
  host.textContent = site.host;
  info.append(label, host);
  li.appendChild(info);

  if (site.expires_at) {
    const timer = document.createElement("span");
    timer.className = "site-timer";
    timer.dataset.expiresAt = site.expires_at;
    if (site.expires_at > nowMs) {
      timer.textContent = `${fmtCountdown(site.expires_at)} left`;
    } else {
      timer.textContent = "timer ended";
      timer.classList.add("expired");
    }
    li.appendChild(timer);
  }

  const toggleWrap = document.createElement("label");
  toggleWrap.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = site.enabled;
  input.addEventListener("change", () =>
    call("toggle_site", { id: site.id, enabled: input.checked })
  );
  const slider = document.createElement("span");
  slider.className = "slider";
  toggleWrap.append(input, slider);
  li.appendChild(toggleWrap);

  const remove = document.createElement("button");
  remove.className = "icon-btn";
  remove.title = `Remove ${site.host}`;
  remove.textContent = "✕";
  remove.addEventListener("click", () => call("remove_site", { id: site.id }));
  li.appendChild(remove);

  return li;
}

function armCountdowns() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    document.querySelectorAll(".site-timer[data-expires-at]").forEach((node) => {
      const at = Number(node.dataset.expiresAt);
      if (at > Date.now()) {
        node.textContent = `${fmtCountdown(at)} left`;
      } else if (!node.classList.contains("expired")) {
        refresh(); // a timer just ran out — pull fresh state
      }
    });
    if (snapshot?.config.paused_until && snapshot.config.paused_until <= Date.now()) {
      refresh();
    }
  }, 15000);
}

// ---------- backend calls ----------

async function call(cmd, args = {}) {
  try {
    render(await invoke(cmd, args));
    return true;
  } catch (err) {
    showAddError(String(err));
    return false;
  }
}

async function refresh() {
  try {
    render(await invoke("get_state"));
  } catch {
    /* backend not ready yet; the next poll retries */
  }
}

function showAddError(message) {
  const node = el("add-error");
  node.textContent = message;
  node.classList.remove("hidden");
  setTimeout(() => node.classList.add("hidden"), 6000);
}

// ---------- wiring ----------

el("master-toggle").addEventListener("change", (e) =>
  call("set_enabled", { enabled: e.target.checked })
);

el("pause-row").addEventListener("click", (e) => {
  const minutes = e.target.closest(".chip")?.dataset.minutes;
  if (minutes) call("pause", { minutes: Number(minutes) });
});
el("resume-btn").addEventListener("click", () => call("resume"));

el("add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = el("add-input");
  const timer = el("add-timer");
  if (!input.value.trim()) return;
  const args = { input: input.value };
  if (timer.value) args.minutes = Number(timer.value);
  if (await call("add_site", args)) {
    input.value = "";
    timer.value = "";
    el("add-error").classList.add("hidden");
  }
});

el("schedule-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const [sh, sm] = el("schedule-start").value.split(":").map(Number);
  const [eh, em] = el("schedule-end").value.split(":").map(Number);
  call("set_schedule", { startMinute: sh * 60 + sm, endMinute: eh * 60 + em });
});
el("schedule-clear").addEventListener("click", () => call("clear_schedule"));

el("sync-now").addEventListener("click", () => call("sync_now"));

listen("shortblock://state-changed", refresh);
window.addEventListener("focus", refresh);
setInterval(refresh, 20000);
refresh();
