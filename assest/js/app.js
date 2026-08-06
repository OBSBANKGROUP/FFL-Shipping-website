/* =====================================================================
   Fast Forward Logistics — Tracking result client
   Runs on result.html only.
   ===================================================================== */
(() => {
  "use strict";

  /* Only run on result.html */
  if (!document.getElementById("trackMap")) return;

  /* ── Supabase (optional) ── */
  const cfg = window.FFL_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.startsWith("YOUR_");
  let supabase = null;
  if (configured && window.supabase)
    supabase = window.supabase.createClient(
      cfg.SUPABASE_URL,
      cfg.SUPABASE_ANON_KEY,
    );

  /* ── Port coordinate lookup ── */
  const PORT_COORDS = {
    /* Iraq */
    IQUQR: [30.034, 47.942],
    BGW: [33.262, 44.234],
    EBL: [36.237, 43.963],
    Baghdad: [33.315, 44.366],
    Basra: [30.508, 47.783],
    Erbil: [36.191, 44.009],
    "Umm Qasr": [30.034, 47.942],
    Iraq: [33.0, 44.0],
    /* USA */
    USNYC: [40.661, -74.044],
    "New York": [40.661, -74.044],
    USLAX: [33.74, -118.252],
    "Los Angeles": [33.74, -118.252],
    USHOU: [29.726, -95.264],
    Houston: [29.726, -95.264],
    USMIA: [25.774, -80.185],
    Miami: [25.774, -80.185],
    USSAV: [32.077, -81.091],
    Savannah: [32.077, -81.091],
    Chicago: [41.878, -87.63],
    Dallas: [32.776, -96.797],
    /* Europe */
    NLRTM: [51.95, 4.14],
    Rotterdam: [51.95, 4.14],
    DEHAM: [53.542, 9.966],
    Hamburg: [53.542, 9.966],
    GBFXT: [51.96, 1.324],
    Felixstowe: [51.96, 1.324],
    DEFRA: [50.034, 8.562],
    Frankfurt: [50.034, 8.562],
    FRA: [50.034, 8.562],
    BEANR: [51.246, 4.404],
    Antwerp: [51.246, 4.404],
    ITGOA: [44.411, 8.932],
    Genoa: [44.411, 8.932],
    London: [51.507, -0.127],
    Paris: [48.856, 2.352],
    Berlin: [52.52, 13.405],
    Madrid: [40.416, -3.703],
    /* Middle East */
    AEDXB: [25.005, 55.065],
    Dubai: [25.005, 55.065],
    AEAUH: [24.471, 54.366],
    "Abu Dhabi": [24.471, 54.366],
    JOAQJ: [29.536, 35.006],
    Aqaba: [29.536, 35.006],
    SAJED: [21.49, 39.185],
    Jeddah: [21.49, 39.185],
    Kuwait: [29.378, 47.99],
    Istanbul: [41.015, 28.979],
    /* Asia / other */
    CNSHA: [31.23, 121.473],
    Shanghai: [31.23, 121.473],
    SGSIN: [1.264, 103.82],
    Singapore: [1.264, 103.82],
    HKHKG: [22.315, 114.168],
    "Hong Kong": [22.315, 114.168],
    INNSA: [18.936, 72.849],
    Mumbai: [18.936, 72.849],
    /* Africa */
    ZADUR: [-29.867, 31.024],
    Durban: [-29.867, 31.024],
    GHTEM: [5.633, -0.016],
    Tema: [5.633, -0.016],
    EGPSD: [29.972, 32.549],
    "Port Said": [29.972, 32.549],
    "Suez Canal": [30.59, 32.265],
    /* Atlantic */
    "Atlantic Ocean": [30.0, -40.0],
  };

  function resolveCoords(portStr) {
    if (!portStr) return null;
    /* Try exact key */
    if (PORT_COORDS[portStr]) return PORT_COORDS[portStr];
    /* Try each word/phrase in the string against keys */
    for (const key of Object.keys(PORT_COORDS)) {
      if (portStr.includes(key)) return PORT_COORDS[key];
    }
    return null;
  }

  /* ── Demo shipments ── */
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

  function localShipments() {
    try {
      return JSON.parse(localStorage.getItem("ffl_shipments") || "[]");
    } catch {
      return [];
    }
  }

  /* ── Alert flag types ── */
  const FLAG_TYPES = {
    weather_delay: {
      label: "Weather delay",
      color: "#5b9bd5",
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 19v1M8 15v1M12 21v1M12 17v1M16 19v1M16 15v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    },
    demurrage: {
      label: "Additional demurrage",
      color: "#e6954a",
      icon: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
    clearance_fee: {
      label: "Clearance fee",
      color: "#2a9d8f",
      icon: `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M2 10h20" stroke="currentColor" stroke-width="1.6"/></svg>`,
    },
    irs_hold: {
      label: "IRS hold",
      color: "#c0392b",
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    },
    fbi_fraud: {
      label: "FBI / Fraud review",
      color: "#8e44ad",
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 3h6l3 6-4 2.5a11 11 0 0 0 4.5 4.5L15 12l6 3v6a2 2 0 0 1-2 2A18 18 0 0 1 1 5a2 2 0 0 1 2-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
    custom: {
      label: "Alert",
      color: "#f2a104",
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
  };

  /* ── Stage / status definitions ── */
  const BASE_STAGES = [
    { key: "booked", label: "Booked" },
    { key: "departed", label: "Departed" },
    { key: "transit", label: "In transit" },
    { key: "customs", label: "Customs" },
    { key: "delivered", label: "Delivered" },
  ];
  const STATUS = {
    booked: { label: "Booked", stage: 0, tone: "neutral" },
    invoice_issued: { label: "Invoice Issued", stage: 0, tone: "neutral" },
    preparing_dispatch: {
      label: "Preparing for Dispatch",
      stage: 1,
      tone: "live",
    },
    in_warehouse: { label: "In Warehouse", stage: 1, tone: "live" },
    in_transit: { label: "In Transit", stage: 2, tone: "live" },
    customs: { label: "Customs Clearance", stage: 3, tone: "live" },
    out_for_delivery: { label: "Out for Delivery", stage: 3, tone: "live" },
    distribution: { label: "Distribution", stage: 3, tone: "live" },
    delivered: { label: "Delivered", stage: 4, tone: "done" },
    on_hold: { label: "ON HOLD", stage: 2, tone: "hold" },
    delayed: { label: "Delayed", stage: 2, tone: "alert" },
    exception: { label: "Exception", stage: 2, tone: "alert" },
  };

  /* ── Formatters ── */
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
  const fmtWt = (kg) =>
    kg == null
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

  /* ── SVG icons ── */
  const ICON = {
    booked: `<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8v3H8zM6 5h2v2H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-2V5h2a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" fill="currentColor"/></svg>`,
    ocean_dep: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 14h16l-2 5H6l-2-5Zm2-1V8h5m0 5V4l5 3v6" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/></svg>`,
    ocean_tr: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 15h18l-2.2 5H5.2L3 15Zm3-1V9h6m0 5V6l4 2.5V14" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><path d="M2 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
    air_dep: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 19h18M6 14l3 1 4-6 2-4 1 1-1 4 4 3 1 2-5-1-3 4-2-1 1-3-4-1v-2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
    air_tr: `<svg viewBox="0 0 24 24" fill="none"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z" fill="currentColor"/></svg>`,
    customs: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V6z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    delivered: `<svg viewBox="0 0 24 24" fill="none"><path d="M3 10 12 4l9 6v10H3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m8.5 14 2.2 2.2L15.5 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  const stageIcon = (key, isAir) =>
    key === "booked"
      ? ICON.booked
      : key === "departed"
        ? isAir
          ? ICON.air_dep
          : ICON.ocean_dep
        : key === "transit"
          ? isAir
            ? ICON.air_tr
            : ICON.ocean_tr
          : key === "customs"
            ? ICON.customs
            : ICON.delivered;

  /* ── Data lookup ── */
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
    if (supabase) {
      try {
        console.log("[FFL] Looking up in Supabase:", q);
        const { data, error } = await supabase
          .from("shipments")
          .select("*")
          .or(
            `tracking_number.ilike.%${q}%,bill_of_lading.ilike.%${q}%,container_number.ilike.%${q}%`,
          )
          .limit(1)
          .maybeSingle();
        if (error) {
          console.warn("[FFL] Supabase error:", error.message, error.details);
        } else if (data) {
          console.log("[FFL] Found in Supabase:", data.tracking_number);
          return { shipment: data };
        } else {
          console.log("[FFL] Not found in Supabase, checking local...");
        }
      } catch (e) {
        console.warn("[FFL] Supabase exception:", e);
      }
    } else {
      console.log("[FFL] Supabase not configured, checking local...");
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

  /* ── DOM refs ── */
  const mapWrap = document.getElementById("mapWrap");
  const mapLoading = document.getElementById("mapLoading");
  const mapBadge = document.getElementById("mapBadge");
  const mapOriginLbl = document.getElementById("mapOriginLabel");
  const mapDestLbl = document.getElementById("mapDestLabel");
  const resultStates = document.getElementById("resultStates");
  const resultContent = document.getElementById("resultContent");
  const resultEl = document.getElementById("result");
  const resultTopbar = document.getElementById("resultTopbar");
  const resultTNBar = document.getElementById("resultTNBar");
  const stateIdle = document.getElementById("stateIdle");
  const quickInput = document.getElementById("quickInput");
  const quickSearch = document.getElementById("quickSearch");

  /* ── Map instance ── */
  let mapInst = null;

  function buildMap(s) {
    const originCoords = resolveCoords(s.origin_port);
    const destCoords = resolveCoords(s.destination_port);

    /* Short labels for badge */
    const originLabel = (s.origin_port || "—")
      .split(",")[0]
      .split("(")[0]
      .trim();
    const destLabel = (s.destination_port || "—")
      .split(",")[0]
      .split("(")[0]
      .trim();
    mapOriginLbl.textContent = originLabel;
    mapDestLbl.textContent = destLabel;

    mapWrap.style.display = "block";
    mapLoading.style.display = "flex";

    /* Slight delay so layout paints before Leaflet sizes itself */
    setTimeout(() => {
      if (mapInst) {
        mapInst.remove();
        mapInst = null;
      }

      /* Default to Iraq→world mid-point if coords missing */
      const fallback = [25.0, 45.0];
      const oCoords = originCoords || fallback;
      const dCoords = destCoords || fallback;

      /* Centre on midpoint, zoom to fit both points */
      const midLat = (oCoords[0] + dCoords[0]) / 2;
      const midLng = (oCoords[1] + dCoords[1]) / 2;

      mapInst = L.map("trackMap", {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([midLat, midLng], 3);

      /* OpenStreetMap tiles (free, no key needed) */
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(mapInst);

      /* Origin marker — teal circle */
      const originIcon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#2A9D8F;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      /* Destination marker — amber circle */
      const destIcon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;background:#F2A104;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      /* Current location pulse (most recent tracking event location) */
      const pulseIcon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;background:#F2A104;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 0 rgba(242,161,4,.5);animation:pulse-ring 2s infinite"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      if (originCoords) {
        L.marker(originCoords, { icon: originIcon })
          .addTo(mapInst)
          .bindTooltip(`<strong>Origin</strong><br>${esc(originLabel)}`, {
            permanent: false,
            direction: "top",
          });
      }
      if (destCoords) {
        L.marker(destCoords, { icon: destIcon })
          .addTo(mapInst)
          .bindTooltip(`<strong>Destination</strong><br>${esc(destLabel)}`, {
            permanent: false,
            direction: "top",
          });
      }

      /* Draw route line */
      if (originCoords && destCoords) {
        /* Build waypoints through any known event locations */
        const nowMs = Date.now();
        const events = (s.tracking_events || [])
          .filter((e) => new Date(e.event_time).getTime() <= nowMs)
          .sort((a, b) => new Date(a.event_time) - new Date(b.event_time));
        const waypoints = [originCoords];
        events.forEach((e) => {
          const c = resolveCoords(e.location);
          if (c) {
            const last = waypoints[waypoints.length - 1];
            if (last[0] !== c[0] || last[1] !== c[1]) waypoints.push(c);
          }
        });
        if (waypoints[waypoints.length - 1][0] !== destCoords[0])
          waypoints.push(destCoords);

        /* Dashed future route */
        L.polyline([originCoords, destCoords], {
          color: "#aaa",
          weight: 1.5,
          dashArray: "5 6",
          opacity: 0.5,
        }).addTo(mapInst);

        /* Solid travelled route */
        if (waypoints.length > 1) {
          L.polyline(waypoints, {
            color: "#2A9D8F",
            weight: 3,
            opacity: 0.85,
          }).addTo(mapInst);

          /* Pulse at current position (last known waypoint before destination) */
          const currentPos =
            waypoints.length >= 2 ? waypoints[waypoints.length - 2] : null;
          if (
            currentPos &&
            (currentPos[0] !== destCoords[0] || currentPos[1] !== destCoords[1])
          ) {
            L.marker(currentPos, { icon: pulseIcon })
              .addTo(mapInst)
              .bindTooltip(`<strong>Last known position</strong>`, {
                permanent: false,
                direction: "top",
              });
          }
        }

        /* Fit map to show all points */
        const allPts = [...waypoints, destCoords];
        mapInst.fitBounds(L.latLngBounds(allPts), { padding: [30, 30] });
      }

      mapLoading.style.display = "none";
      mapBadge.style.display = "flex";
    }, 80);
  }

  /* ── Render tracking result ── */
  function render(s) {
    const st = STATUS[s.status] || STATUS.booked;
    const isAir = s.mode === "air";
    const isDone = st.tone === "done";
    const isAlert = st.tone === "alert";
    const isHold = st.tone === "hold";

    const nowMs = Date.now();
    const events = (s.tracking_events || [])
      .filter((e) => new Date(e.event_time).getTime() <= nowMs)
      .sort((a, b) => new Date(b.event_time) - new Date(a.event_time));
    const latest = events[0];

    /* Headline */
    let hLabel, hDate;
    if (isDone) {
      hLabel = "Delivered";
      hDate = bigDate(latest ? latest.event_time : s.eta);
    } else if (isHold) {
      hLabel = "Shipment on hold";
      hDate = bigDate(s.eta);
    } else if (isAlert) {
      hLabel = "Delivery delayed";
      hDate = bigDate(s.eta);
    } else {
      hLabel = "Estimated delivery";
      hDate = bigDate(s.eta);
    }
    const subLine =
      esc(st.label) +
      esc(latest && latest.location ? " · " + latest.location : "");

    /* Flags */
    const flags = (s.alert_flags || []).filter((f) => f.active);
    const flagStages = flags.map((f, i) => ({
      key: "flag_" + i,
      label:
        f.custom_label ||
        (FLAG_TYPES[f.type] ? FLAG_TYPES[f.type].label : "Alert"),
      flagType: f.type,
      flagColor: FLAG_TYPES[f.type] ? FLAG_TYPES[f.type].color : "#f2a104",
      flagIcon: FLAG_TYPES[f.type]
        ? FLAG_TYPES[f.type].icon
        : FLAG_TYPES.custom.icon,
    }));
    const fullStages = [
      ...BASE_STAGES.slice(0, 4),
      ...flagStages,
      BASE_STAGES[4],
    ];

    let activeIdx = st.stage;
    if (isDone) activeIdx = fullStages.length - 1;
    else if (activeIdx > 3) activeIdx = 3 + flagStages.length;

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
        let iconHtml = isFlag ? stage.flagIcon : stageIcon(stage.key, isAir);
        const style = isFlag ? `--flag-color:${stage.flagColor}` : "";
        return `<li class="fx-stage${isFlag ? " fx-stage-flag" : ""} ${cls}" style="${style}">
        <span class="fx-ic">${iconHtml}</span>
        <span class="fx-stage-label">${esc(stage.label)}</span>
      </li>`;
      })
      .join("");

    const pct = (activeIdx / (fullStages.length - 1)) * 100;

    /* Travel history */
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

    /* Alert flags notice */
    const flagsNoticeHtml = flags.length
      ? `
      <div class="fx-flags-notice">
        ${flags
          .map((f) => {
            const ft = FLAG_TYPES[f.type] || FLAG_TYPES.custom;
            const label = f.custom_label || ft.label;
            return `<div class="fx-flag-item" style="--fc:${ft.color}">
            <span class="fx-flag-ic">${ft.icon}</span>
            <div><p class="fx-flag-title">${esc(label)}</p>${f.note ? `<p class="fx-flag-note">${esc(f.note)}</p>` : ""}</div>
          </div>`;
          })
          .join("")}
      </div>`
      : "";

    /* Shipment facts */
    const facts = [
      [
        "Service",
        isAir ? "International air freight" : "International ocean freight",
      ],
      [isAir ? "Flight" : "Vessel", s.vessel_name],
      [isAir ? "Flt no." : "Voyage", s.voyage_number, true],
      ["Container", s.container_number, true],
      ["Bill of lading", s.bill_of_lading, true],
      ["Commodity", s.commodity],
      ["Total weight", fmtWt(s.weight_kg)],
      ["Pieces", s.pieces != null ? String(s.pieces) : "—"],
      ["Departed (ETD)", fmtDate(s.etd)],
      ["Arrival (ETA)", fmtDate(s.eta)],
    ];
    const factsHtml = facts
      .map(
        ([k, v, mono]) =>
          `<div class="fx-fact"><dt>${esc(k)}</dt><dd class="${mono ? "mono" : ""}">${esc(v ?? "—") || "—"}</dd></div>`,
      )
      .join("");

    resultEl.innerHTML = `
      <div class="fx">
        <div class="fx-head fx-tone-${isHold ? "hold" : st.tone}">
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
        ${
          isHold
            ? `
        <div class="fx-hold-banner">
          <div class="fx-hold-icon">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
              <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <p class="fx-hold-title">⚠️ Your shipment is currently ON HOLD</p>
            <p class="fx-hold-msg">Your shipment requires attention and has been placed on hold. Please contact our team immediately to resolve this.</p>
            <a href="contact.html" class="fx-hold-cta">Contact us now →</a>
          </div>
        </div>`
            : ""
        }
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

    /* Show result panel */
    resultStates.style.display = "none";
    resultContent.style.display = "block";

    requestAnimationFrame(() => {
      const bar = document.getElementById("fxProgress");
      if (bar) bar.style.width = pct + "%";
    });
  }

  /* ── Show states ── */
  function showLoading() {
    resultStates.style.display = "block";
    resultContent.style.display = "none";
    mapWrap.style.display = "none";
    resultStates.innerHTML = `<div class="state-card">
      <div class="spinner-lg"></div>
      <h2>Locating shipment…</h2>
    </div>`;
  }
  function showNotFound(q) {
    mapWrap.style.display = "none";
    resultStates.style.display = "block";
    resultContent.style.display = "none";
    resultStates.innerHTML = `<div class="state-card">
      <div class="state-icon">🔍</div>
      <h2>No shipment found</h2>
      <p>We couldn't find <strong>${esc(q)}</strong>. Check for typos or contact us.</p>
      <a href="tracking.html">← Try another number</a>
    </div>`;
  }
  function showError(msg) {
    mapWrap.style.display = "none";
    resultStates.style.display = "block";
    resultContent.style.display = "none";
    resultStates.innerHTML = `<div class="state-card">
      <div class="state-icon">⚠️</div>
      <h2>Something went wrong</h2>
      <p>${esc(msg || "Couldn't reach the tracking service. Try again in a moment.")}</p>
      <a href="tracking.html">← Go back</a>
    </div>`;
  }

  /* ── Main handler ── */
  async function handle(raw) {
    const q = (raw || "").trim();
    if (!q) return;

    /* Update URL bar without reload */
    const url = new URL(location.href);
    url.searchParams.set("track", q);
    history.replaceState(null, "", url);

    resultTNBar.textContent = q;
    resultTopbar.style.display = "flex";
    if (quickInput) quickInput.value = q;
    document.title = `${q} — Fast Forward Logistics`;

    showLoading();
    try {
      const { shipment, none } = await lookup(q);
      if (none || !shipment) {
        showNotFound(q);
        return;
      }
      /* Build map first (above result), then render details */
      buildMap(shipment);
      render(shipment);
    } catch (err) {
      console.error(err);
      showError(err.message);
    }
  }

  /* ── Quick search in result topbar ── */
  function doQuickSearch() {
    const v = quickInput ? quickInput.value.trim() : "";
    if (v) handle(v);
  }
  if (quickSearch) quickSearch.addEventListener("click", doQuickSearch);
  if (quickInput)
    quickInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doQuickSearch();
    });

  /* ── Auto-run from URL param ── */
  const param = new URLSearchParams(location.search).get("track");
  if (param) handle(param);
})();
