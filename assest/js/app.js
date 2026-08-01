/* =====================================================================
   Fast Forward Logistics — tracking client (FedEx-style result)
   Data order:  Supabase (if configured) → local test shipments (admin)
                → built-in demo shipments
   ===================================================================== */
(() => {
  "use strict";

  const cfg = window.FFL_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.startsWith("YOUR_") &&
    !cfg.SUPABASE_ANON_KEY.startsWith("YOUR_");
  let supabase = null;
  if (configured && window.supabase)
    supabase = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY,
    );
  const LIVE = Boolean(supabase);

  const el = (id) => document.getElementById(id);
  const form = el("trackForm"),
    input = el("trackInput"),
    result = el("result");
  const loading = el("loading"),
    notFound = el("notFound"),
    errorState = el("errorState");
  const errorMsg = el("errorMsg"),
    dataMode = el("dataMode");
  if (!form) return; // not on the tracking page
  if (LIVE && dataMode) {
    dataMode.textContent = "live · supabase";
    dataMode.classList.add("live");
  }

  /* ---------- built-in demo shipments (Iraq → USA / Europe) ---------- */
  const now = Date.now();
  const days = (n) => new Date(now + n * 864e5).toISOString();
  const hours = (n) => new Date(now + n * 36e5).toISOString();
  const DEMO = {
    "FFL-2K5-8842": {
      tracking_number: "FFL-2K5-8842",
      bill_of_lading: "FFLU2405118842",
      container_number: "MSKU7834521",
      mode: "ocean",
      status: "in_transit",
      origin_port: "Umm Qasr, IQ (IQUQR)",
      destination_port: "New York, US (USNYC)",
      vessel_name: "MV Northern Vigour",
      voyage_number: "V.2418W",
      etd: days(-12),
      eta: days(16),
      commodity: "Fresh dates (reefer)",
      weight_kg: 18450,
      pieces: 320,
      shipper: "Basra Date Exporters Co.",
      consignee: "Brooklyn Foods Import LLC",
      tracking_events: [
        {
          event_time: days(-14),
          location: "Basra, IQ",
          description: "Booking confirmed and container assigned",
        },
        {
          event_time: days(-13),
          location: "Umm Qasr, IQ (IQUQR)",
          description: "Container gated in at origin terminal",
        },
        {
          event_time: days(-12),
          location: "Umm Qasr, IQ (IQUQR)",
          description: "Vessel departed port of loading",
        },
        {
          event_time: days(-7),
          location: "Jeddah, SA (SAJED)",
          description: "Transshipment — discharged and reloaded",
        },
        {
          event_time: days(-1),
          location: "Suez Canal, EG",
          description: "Vessel in transit through Suez Canal",
        },
      ],
    },
    "FFL-7A1-3390": {
      tracking_number: "FFL-7A1-3390",
      bill_of_lading: "FFLA2406043390",
      container_number: null,
      mode: "air",
      status: "customs",
      origin_port: "Baghdad, IQ (BGW)",
      destination_port: "Frankfurt, DE (FRA)",
      vessel_name: "Lufthansa Cargo LH1337",
      voyage_number: "LH1337",
      etd: days(-2),
      eta: days(1),
      commodity: "Precision machinery parts",
      weight_kg: 1240.5,
      pieces: 46,
      shipper: "Baghdad Industrial Supply",
      consignee: "Rhein Handel GmbH",
      tracking_events: [
        {
          event_time: days(-2),
          location: "Baghdad, IQ (BGW)",
          description: "Cargo accepted at origin airport",
        },
        {
          event_time: days(-2),
          location: "Baghdad, IQ (BGW)",
          description: "Flight departed origin airport",
        },
        {
          event_time: hours(-20),
          location: "Frankfurt, DE (FRA)",
          description: "Flight arrived at destination airport",
        },
        {
          event_time: hours(-6),
          location: "Frankfurt, DE (FRA)",
          description: "Held for customs clearance and inspection",
        },
      ],
    },
  };

  /* ---------- local test shipments (created on the Admin page) ---------- */
  function localShipments() {
    try {
      return JSON.parse(localStorage.getItem("ffl_shipments") || "[]");
    } catch {
      return [];
    }
  }

  /* ---------- stages ---------- */
  const STAGES = [
    { key: "booked", label: "Booked" },
    { key: "departed", label: "Departed" },
    { key: "transit", label: "In transit" },
    { key: "customs", label: "Customs" },
    { key: "delivered", label: "Delivered" },
  ];
  const STATUS = {
    booked: { label: "Booked", stage: 0, tone: "neutral" },
    in_transit: { label: "In transit", stage: 2, tone: "live" },
    customs: { label: "Customs clearance", stage: 3, tone: "live" },
    out_for_delivery: { label: "Out for delivery", stage: 3, tone: "live" },
    delivered: { label: "Delivered", stage: 4, tone: "done" },
    delayed: { label: "Delayed", stage: 2, tone: "alert" },
    exception: { label: "Exception", stage: 2, tone: "alert" },
  };

  /* ---------- formatting ---------- */
  const bigDate = (iso) =>
    !iso
      ? "—"
      : new Date(iso).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  const dayHeader = (iso) =>
    new Date(iso).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  const timeOf = (iso) =>
    new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);
  const fmtDate = (iso) =>
    !iso
      ? "—"
      : new Date(iso).toLocaleString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  const fmtWeight = (kg) =>
    kg == null || kg === ""
      ? "—"
      : Number(kg).toLocaleString(undefined, { maximumFractionDigits: 1 }) +
        " kg";
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  /* ---------- icons ---------- */
  const ICON = {
    booked: `<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8v3H8zM6 5h2v2H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-2V5h2a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" fill="currentColor"/><path d="M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    ocean_departed: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 14h16l-2 5H6l-2-5Zm2-1V8h5m0 5V4l5 3v6" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
    ocean_transit: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 15h18l-2.2 5H5.2L3 15Zm3-1V9h6m0 5V6l4 2.5V14" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M2 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    air_departed: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 19h18M6 14l3 1 4-6 2-4 1 1-1 4 4 3 1 2-5-1-3 4-2-1 1-3-4-1v-2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
    air_transit: `<svg viewBox="0 0 24 24" fill="none"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z" fill="currentColor"/></svg>`,
    customs: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    delivered: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 10 12 4l9 6v10H3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m8.5 14 2.2 2.2L15.5 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  const stageIcon = (key, isAir) =>
    key === "booked"
      ? ICON.booked
      : key === "departed"
        ? isAir
          ? ICON.air_departed
          : ICON.ocean_departed
        : key === "transit"
          ? isAir
            ? ICON.air_transit
            : ICON.ocean_transit
          : key === "customs"
            ? ICON.customs
            : ICON.delivered;

  /* ---------- data access ---------- */
  const eq = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();
  const matchLocal = (q) =>
    localShipments().find(
      (s) =>
        eq(s.tracking_number, q) ||
        eq(s.bill_of_lading, q) ||
        eq(s.container_number, q),
    );

  async function lookup(raw) {
    const q = raw.trim();
    if (!q) return { none: true };
    if (LIVE) {
      const { data, error } = await supabase
        .from("shipments")
        .select("*, tracking_events(event_time, location, description)")
        .or(
          `tracking_number.ilike.${q},bill_of_lading.ilike.${q},container_number.ilike.${q}`,
        )
        .limit(1);
      if (error) throw error;
      if (data && data.length) return { shipment: data[0] };
      const loc = matchLocal(q);
      return loc ? { shipment: loc } : { none: true };
    }
    const loc = matchLocal(q);
    if (loc) return { shipment: loc };
    const hit = Object.values(DEMO).find(
      (s) =>
        eq(s.tracking_number, q) ||
        eq(s.bill_of_lading, q) ||
        eq(s.container_number, q),
    );
    return hit ? { shipment: structuredClone(hit) } : { none: true };
  }

  /* ---------- view switching ---------- */
  const panels = [loading, notFound, errorState, result];
  const show = (node) =>
    panels.forEach((p) => p && p.classList.toggle("hidden", p !== node));

  /* ---------- render (FedEx-style) ---------- */
  function render(s) {
    const st = STATUS[s.status] || STATUS.booked;
    const isAir = s.mode === "air";
    const active = st.stage,
      isDone = st.tone === "done",
      isAlert = st.tone === "alert";
    const now = Date.now();
    const events = (s.tracking_events || [])
      .filter((e) => new Date(e.event_time).getTime() <= now)
      .sort((a, b) => new Date(b.event_time) - new Date(a.event_time));
    const latest = events[0];

    let hLabel, hDate;
    if (isDone) {
      hLabel = "Delivered";
      hDate = bigDate(latest ? latest.event_time : s.eta);
    } else if (isAlert) {
      hLabel =
        st.label === "Delayed" ? "Delivery delayed" : "Shipment exception";
      hDate = bigDate(s.eta);
    } else {
      hLabel = "Estimated delivery";
      hDate = bigDate(s.eta);
    }
    const subLine =
      esc(st.label) +
      esc(latest && latest.location ? " · " + latest.location : "");

    const stepsHtml = STAGES.map((stage, i) => {
      const done = i < active || (isDone && i === active);
      const current = i === active && !isDone;
      const cls = [
        done ? "done" : "",
        current ? "current" : "",
        current && isAlert ? "alert" : "",
      ]
        .join(" ")
        .trim();
      return `<li class="fx-stage ${cls}"><span class="fx-ic">${stageIcon(stage.key, isAir)}</span><span class="fx-stage-label">${esc(stage.label)}</span></li>`;
    }).join("");
    const pct = (active / (STAGES.length - 1)) * 100;

    const groups = [],
      byDay = new Map();
    events.forEach((e) => {
      const k = dayKey(e.event_time);
      if (!byDay.has(k)) {
        byDay.set(k, []);
        groups.push(k);
      }
      byDay.get(k).push(e);
    });
    const historyHtml =
      groups
        .map((k) => {
          const rows = byDay
            .get(k)
            .map((e) => {
              const isCurrent = latest && e.event_time === latest.event_time;
              return `<div class="fx-evt ${isCurrent ? "current" : ""}"><div class="fx-evt-time">${timeOf(e.event_time)}</div>
          <div class="fx-evt-main"><p class="fx-evt-desc">${esc(e.description)}</p>${e.location ? `<p class="fx-evt-loc">${esc(e.location)}</p>` : ""}</div></div>`;
            })
            .join("");
          return `<div class="fx-day"><p class="fx-day-head">${dayHeader(k + "T00:00:00")}</p>${rows}</div>`;
        })
        .join("") || `<p class="fx-empty">No tracking events yet.</p>`;

    const facts = [
      [
        "Service",
        isAir ? "International air freight" : "International ocean freight",
      ],
      [isAir ? "Flight" : "Vessel", s.vessel_name],
      [isAir ? "Flight no." : "Voyage", s.voyage_number, true],
      ["Container", s.container_number, true],
      ["Bill of lading", s.bill_of_lading, true],
      ["Commodity", s.commodity],
      ["Total weight", fmtWeight(s.weight_kg)],
      ["Pieces", s.pieces != null && s.pieces !== "" ? String(s.pieces) : "—"],
      ["Departed (ETD)", fmtDate(s.etd)],
      ["Arrival (ETA)", fmtDate(s.eta)],
    ];
    const factsHtml = facts
      .map(
        ([k, v, mono]) =>
          `<div class="fx-fact"><dt>${esc(k)}</dt><dd class="${mono ? "mono" : ""}">${esc(v ?? "—") || "—"}</dd></div>`,
      )
      .join("");

    result.innerHTML = `
      <div class="fx">
        <div class="fx-head fx-tone-${st.tone}">
          <div class="fx-status">
            <p class="fx-status-label">${esc(hLabel)}</p>
            <p class="fx-status-date">${esc(hDate)}</p>
            <p class="fx-status-sub"><span class="fx-dot"></span>${subLine}</p>
          </div>
          <div class="fx-idcard">
            <p class="fx-id-label">Tracking number</p>
            <p class="fx-id-no">${esc(s.tracking_number)}</p>
            <p class="fx-id-service">${isAir ? "Air freight" : "Ocean freight"}</p>
          </div>
        </div>
        <div class="fx-stepper"><div class="fx-track"><div class="fx-progress" id="fxProgress"></div></div><ol class="fx-stages">${stepsHtml}</ol></div>
        <div class="fx-body">
          <section class="fx-history-wrap"><h3 class="fx-h">Travel history</h3><div class="fx-history">${historyHtml}</div></section>
          <aside class="fx-facts-wrap">
            <div class="fx-route">
              <div class="fx-route-pt"><span class="fx-route-role">From</span><strong>${esc(s.origin_port)}</strong><span class="fx-route-party">${esc(s.shipper ?? "")}</span></div>
              <svg class="fx-route-arrow" viewBox="0 0 24 24" fill="none"><path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div class="fx-route-pt fx-route-to"><span class="fx-route-role">To</span><strong>${esc(s.destination_port)}</strong><span class="fx-route-party">${esc(s.consignee ?? "")}</span></div>
            </div>
            <h3 class="fx-h">Shipment facts</h3><dl class="fx-facts">${factsHtml}</dl>
          </aside>
        </div>
      </div>`;
    show(result);
    requestAnimationFrame(() => {
      const bar = el("fxProgress");
      if (bar) bar.style.width = pct + "%";
    });
  }

  /* ---------- controller ---------- */
  async function handle(raw) {
    const anchor = el("searchBlock");
    if (anchor) anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    show(loading);
    try {
      const { shipment, none } = await lookup(raw);
      if (none || !shipment) {
        show(notFound);
        return;
      }
      render(shipment);
    } catch (err) {
      console.error(err);
      if (errorMsg)
        errorMsg.textContent =
          (err && err.message ? err.message : "Unexpected error") +
          ". Check your Supabase URL/key and that schema.sql has been run.";
      show(errorState);
    }
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    handle(input.value);
  });
  const hints = el("demoHints");
  if (hints)
    hints.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-track]");
      if (!btn) return;
      input.value = btn.dataset.track;
      handle(btn.dataset.track);
    });

  /* ---------- deep link: tracking.html?track=NUMBER ---------- */
  const param = new URLSearchParams(location.search).get("track");
  if (param) {
    input.value = param;
    handle(param);
  }
})();
