/* =====================================================================
   Fast Forward Logistics — tracking client (FedEx-style result)
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
  if (!form) return;
  if (LIVE && dataMode) {
    dataMode.textContent = "live · supabase";
    dataMode.classList.add("live");
  }

  /* ---------- demo shipments ---------- */
  const now = Date.now();
  const days = (n) => new Date(now + n * 864e5).toISOString();
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
      shipper_contact: "Basra Date Exporters Co.",
      consignee_contact: "Brooklyn Foods Import LLC",
      tracking_events: [
        {
          event_time: days(-14),
          location: "Basra, IQ",
          description: "Booking confirmed and container assigned",
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
      alert_flags: [],
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
      shipper_contact: "Baghdad Industrial Supply",
      consignee_contact: "Rhein Handel GmbH",
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
          event_time: days(-1),
          location: "Frankfurt, DE (FRA)",
          description: "Flight arrived at destination airport",
        },
        {
          event_time: new Date(now - 6 * 36e5).toISOString(),
          location: "Frankfurt, DE (FRA)",
          description: "Held for customs clearance and inspection",
        },
      ],
      alert_flags: [],
    },
  };

  /* ---------- local test shipments ---------- */
  function localShipments() {
    try {
      return JSON.parse(localStorage.getItem("ffl_shipments") || "[]");
    } catch {
      return [];
    }
  }

  /* ─────────────────────────────────────────────────
     ALERT FLAGS — extra stepper icons between
     Customs and Delivered, triggered from admin panel
     ─────────────────────────────────────────────── */
  const FLAG_TYPES = {
    weather_delay: {
      label: "Weather delay",
      color: "#5b9bd5",
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 19v1M8 15v1M12 21v1M12 17v1M16 19v1M16 15v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    },
    demurrage: {
      label: "Additional demurrage",
      color: "#e6954a",
      icon: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 3.5 17 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    },
    clearance_fee: {
      label: "Clearance fee",
      color: "#2a9d8f",
      icon: `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.6"/><path d="M6 15h4M14 15h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    },
    irs_hold: {
      label: "IRS hold",
      color: "#c0392b",
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    },
    fbi_fraud: {
      label: "FBI / Fraud review",
      color: "#8e44ad",
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 3h6l3 6-4 2.5a11 11 0 0 0 4.5 4.5L15 12l6 3v6a2 2 0 0 1-2 2A18 18 0 0 1 1 5a2 2 0 0 1 2-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="m15 9 5-5M20 4h-5M20 4v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
    custom: {
      label: "Alert",
      color: "#f2a104",
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
  };

  /* ---------- base stages ---------- */
  const BASE_STAGES = [
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

  /* ─────────────────────────────────────────────────
     RENDER
     ─────────────────────────────────────────────── */
  function render(s) {
    const st = STATUS[s.status] || STATUS.booked;
    const isAir = s.mode === "air";
    const isDone = st.tone === "done";
    const isAlert = st.tone === "alert";

    /* only show events whose time has passed */
    const nowMs = Date.now();
    const events = (s.tracking_events || [])
      .filter((e) => new Date(e.event_time).getTime() <= nowMs)
      .sort((a, b) => new Date(b.event_time) - new Date(a.event_time));
    const latest = events[0];

    /* headline */
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

    /* ── build dynamic stages with alert flags injected before Delivered ── */
    const flags = (s.alert_flags || []).filter((f) => f.active);
    const STAGES = [...BASE_STAGES];
    // Insert active flags between customs (index 3) and delivered (index 4)
    const flagStages = flags.map((f, i) => ({
      key: "flag_" + i,
      label:
        f.custom_label ||
        (FLAG_TYPES[f.type] ? FLAG_TYPES[f.type].label : "Alert"),
      flagType: f.type,
      flagColor: f.custom_label
        ? "#f2a104"
        : FLAG_TYPES[f.type]
          ? FLAG_TYPES[f.type].color
          : "#f2a104",
      flagIcon: FLAG_TYPES[f.type]
        ? FLAG_TYPES[f.type].icon
        : FLAG_TYPES.custom.icon,
    }));

    // Build the full stages array: Booked, Departed, In transit, Customs, [flags...], Delivered
    const fullStages = [
      ...BASE_STAGES.slice(0, 4),
      ...flagStages,
      BASE_STAGES[4],
    ];

    // Map status stage index to full stages (flags count as "between customs and delivered")
    let activeIdx = st.stage; // 0-4 base
    if (activeIdx >= 4 && !isDone) {
      // between customs and delivered — active is at last flag or customs
      activeIdx = 3 + flagStages.length; // sits on last flag
    } else if (isDone) {
      activeIdx = fullStages.length - 1;
    } else if (activeIdx > 3) {
      activeIdx = 3 + flagStages.length;
    }

    const totalStages = fullStages.length;

    const stepsHtml = fullStages
      .map((stage, i) => {
        const isFlag = stage.key.startsWith("flag_");
        const done = i < activeIdx || (isDone && i === activeIdx);
        const current = i === activeIdx && !isDone;
        const cls = [
          done ? "done" : "",
          current ? "current" : "",
          current && isAlert ? "alert" : "",
        ]
          .join(" ")
          .trim();

        let iconHtml,
          iconStyle = "";
        if (isFlag) {
          iconHtml = stage.flagIcon;
          iconStyle = `--flag-color:${stage.flagColor}`;
        } else {
          iconHtml = stageIcon(stage.key, isAir);
        }
        const flagCls = isFlag ? " fx-stage-flag" : "";
        return `<li class="fx-stage${flagCls} ${cls}" style="${iconStyle}">
        <span class="fx-ic">${iconHtml}</span>
        <span class="fx-stage-label">${esc(stage.label)}</span>
      </li>`;
      })
      .join("");

    const pct = (activeIdx / (totalStages - 1)) * 100;

    /* travel history */
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
              return `<div class="fx-evt ${isCurrent ? "current" : ""}">
          <div class="fx-evt-time">${timeOf(e.event_time)}</div>
          <div class="fx-evt-main">
            <p class="fx-evt-desc">${esc(e.description)}</p>
            ${e.location ? `<p class="fx-evt-loc">${esc(e.location)}</p>` : ""}
          </div>
        </div>`;
            })
            .join("");
          return `<div class="fx-day"><p class="fx-day-head">${dayHeader(k + "T00:00:00")}</p>${rows}</div>`;
        })
        .join("") || `<p class="fx-empty">No tracking events yet.</p>`;

    /* alert flags notice strip (shows active flags to customer with note) */
    const flagsNoticeHtml = flags.length
      ? `
      <div class="fx-flags-notice">
        ${flags
          .map((f) => {
            const ft = FLAG_TYPES[f.type] || FLAG_TYPES.custom;
            const label = f.custom_label || ft.label;
            const color =
              f.custom_label && !FLAG_TYPES[f.type] ? "#f2a104" : ft.color;
            return `<div class="fx-flag-item" style="--fc:${color}">
            <span class="fx-flag-ic">${ft.icon}</span>
            <div>
              <p class="fx-flag-title">${esc(label)}</p>
              ${f.note ? `<p class="fx-flag-note">${esc(f.note)}</p>` : ""}
            </div>
          </div>`;
          })
          .join("")}
      </div>`
      : "";

    /* shipment facts */
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

        <div class="fx-stepper">
          <div class="fx-track"><div class="fx-progress" id="fxProgress"></div></div>
          <ol class="fx-stages">${stepsHtml}</ol>
        </div>

        ${flagsNoticeHtml}

        <div class="fx-body">
          <section class="fx-history-wrap">
            <h3 class="fx-h">Travel history</h3>
            <div class="fx-history">${historyHtml}</div>
          </section>
          <aside class="fx-facts-wrap">
            <div class="fx-route">
              <div class="fx-route-pt">
                <span class="fx-route-role">From</span>
                <strong>${esc(s.origin_port)}</strong>
                <span class="fx-route-party">${esc(s.shipper_contact ?? "")}</span>
              </div>
              <svg class="fx-route-arrow" viewBox="0 0 24 24" fill="none"><path d="M5 12h13m0 0-5-5m5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div class="fx-route-pt fx-route-to">
                <span class="fx-route-role">To</span>
                <strong>${esc(s.destination_port)}</strong>
                <span class="fx-route-party">${esc(s.consignee_contact ?? "")}</span>
              </div>
            </div>
            <h3 class="fx-h">Shipment facts</h3>
            <dl class="fx-facts">${factsHtml}</dl>
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
          ". Check your Supabase config.";
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

  const param = new URLSearchParams(location.search).get("track");
  if (param) {
    input.value = param;
    handle(param);
  }

  /* expose FLAG_TYPES so admin can read it */
  window.FFL_FLAG_TYPES = FLAG_TYPES;
})();
