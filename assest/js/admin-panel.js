/* Fast Forward Logistics — Admin panel (dashboard, add shipment, quotes, flags) */
(() => {
  "use strict";
  const SK = "ffl_shipments",
    QK = "ffl_quotes";
  const load = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "[]");
    } catch {
      return [];
    }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const $ = (id) => document.getElementById(id);
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
  const money = (n) =>
    n != null && n !== ""
      ? "$" +
        Number(n).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "—";
  const fDate = (iso) =>
    !iso
      ? "—"
      : new Date(iso).toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  const fDT = (iso) =>
    !iso
      ? "—"
      : new Date(iso).toLocaleString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  const toISO = (v) => (v ? new Date(v).toISOString() : null);
  const toInp = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3000);
  }

  /* ── generators ── */
  const rnd = (chars, n) =>
    Array.from(
      { length: n },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  const NUM = "0123456789",
    AZ = "ABCDEFGHJKLMNPQRSTUVWXYZ",
    AN = AZ + NUM;
  function genTN() {
    const used = new Set(load(SK).map((s) => s.tracking_number));
    let tn;
    do {
      tn = `FFL-${rnd(AN, 3)}-${rnd(AN, 4)}`;
    } while (used.has(tn));
    return tn;
  }
  function genContainer(mode) {
    return mode === "air"
      ? "AWB-" + rnd(NUM, 3) + "-" + rnd(NUM, 8)
      : "FFLU" + rnd(NUM, 7);
  }
  function genBL(mode) {
    return mode === "air"
      ? "FFL" + rnd(AN, 2) + rnd(NUM, 6)
      : "FFLB" + rnd(AZ, 2) + rnd(NUM, 6);
  }
  function refreshAutoFields(isNew) {
    const mode = $("modeSelect").value;
    if (isNew) {
      $("tnField").value = genTN();
      $("containerField").value = genContainer(mode);
      $("blField").value = genBL(mode);
    } else {
      const cn = $("containerField").value,
        bl = $("blField").value;
      if (!cn || cn.startsWith("FFLU") || cn.startsWith("AWB-"))
        $("containerField").value = genContainer(mode);
      if (!bl || bl.startsWith("FFLB") || bl.startsWith("FFL"))
        $("blField").value = genBL(mode);
    }
  }
  $("modeSelect").addEventListener("change", () => refreshAutoFields(false));

  /* ── charge auto-total ── */
  function calcTotal() {
    const s = parseFloat($("chargeShip").value) || 0,
      h = parseFloat($("chargeHandle").value) || 0;
    $("chargeTotal").value = s + h > 0 ? "$" + (s + h).toFixed(2) : "";
  }
  $("chargeShip").addEventListener("input", calcTotal);
  $("chargeHandle").addEventListener("input", calcTotal);

  /* ── status meta ── */
  const STATUSES = [
    { v: "booked", l: "Booked" },
    { v: "in_transit", l: "In transit" },
    { v: "customs", l: "Customs" },
    { v: "out_for_delivery", l: "Out for delivery" },
    { v: "delivered", l: "Delivered" },
    { v: "delayed", l: "Delayed" },
    { v: "exception", l: "Exception" },
  ];
  const sLabel = (v) => (STATUSES.find((s) => s.v === v) || {}).l || v;
  const sOpts = (cur) =>
    STATUSES.map(
      (s) =>
        `<option value="${s.v}"${s.v === cur ? " selected" : ""}>${s.l}</option>`,
    ).join("");

  /* ── tab switching ── */
  const tabs = document.querySelectorAll("[data-tab]");
  const secs = document.querySelectorAll(".sec");
  // Tab switching handled by admin.html showTab() globally

  /* ════════ CHART ════════ */
  const RATE = { ocean: 0.055, air: 4.2, road: 1.4 };
  const MDAYS = { ocean: 32, air: 5, road: 12 };
  function shipRev(s) {
    return (
      (Number(s.weight_kg) || 0) *
        (RATE[s.mode] || RATE.ocean) *
        (MDAYS[s.mode] || 30) +
      (Number(s.charge_shipment) || 0) +
      (Number(s.charge_handling) || 0)
    );
  }
  function calcRev(ships, days) {
    const cut = Date.now() - days * 864e5;
    return ships
      .filter(
        (s) => new Date(s.created_at || s.etd || Date.now()).getTime() >= cut,
      )
      .reduce((a, s) => a + shipRev(s), 0);
  }
  function sparkPts(ships, days) {
    const now = Date.now(),
      step = (days / 7) * 864e5;
    return Array.from({ length: 7 }, (_, i) => {
      const from = now - (7 - i) * step,
        to = now - (6 - i) * step;
      return ships
        .filter((s) => {
          const d = new Date(s.created_at || s.etd || Date.now()).getTime();
          return d >= from && d < to;
        })
        .reduce((a, s) => a + shipRev(s), 0);
    });
  }
  let chartRange = "day";
  const RDAYS = { day: 1, week: 7, month: 30 };
  function drawChart(pts) {
    const canvas = $("rateChart");
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1,
      W = canvas.offsetWidth || 300,
      H = 80;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const max = Math.max(...pts, 1),
      pp = pts.map((v, i) => ({
        x: (i / (pts.length - 1)) * (W - 4) + 2,
        y: H - 4 - (v / max) * (H - 12),
      }));
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(242,161,4,.35)");
    g.addColorStop(1, "rgba(242,161,4,0)");
    ctx.beginPath();
    ctx.moveTo(pp[0].x, H);
    pp.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pp[pp.length - 1].x, H);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath();
    pp.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.strokeStyle = "rgba(242,161,4,.9)";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();
    pp.forEach((p, i) => {
      if (pts[i] > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "#F2A104";
        ctx.fill();
      }
    });
  }
  function updateChart() {
    const ships = load(SK),
      days = RDAYS[chartRange];
    const tot = calcRev(ships, days),
      prev = calcRev(ships, days * 2) - tot;
    drawChart(sparkPts(ships, days));
    $("chartRate").textContent = "$" + Math.round(tot).toLocaleString();
    $("chartSub").textContent =
      `est. ${chartRange === "day" ? "today" : chartRange === "week" ? "this week" : "this month"}`;
    const tr = $("chartTrend");
    if (tot === 0 && prev === 0) {
      tr.textContent = "— no data";
      tr.className = "chart-trend";
    } else if (prev <= 0) {
      tr.textContent = "↑ new period";
      tr.className = "chart-trend";
    } else {
      const pct = Math.round(((tot - prev) / prev) * 100);
      tr.textContent = (pct >= 0 ? "↑ " : "↓ ") + Math.abs(pct) + "% vs prev";
      tr.className = "chart-trend" + (pct < 0 ? " down" : "");
    }
  }
  document.querySelectorAll(".chart-tab").forEach((b) =>
    b.addEventListener("click", () => {
      document
        .querySelectorAll(".chart-tab")
        .forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      chartRange = b.dataset.range;
      updateChart();
    }),
  );

  /* ════════ DASHBOARD ════════ */
  let activeFilter = "all";
  function refreshDash() {
    const all = load(SK);
    const stTotal = $("st-total");
    if (stTotal) stTotal.textContent = all.length;
    const stTransit = $("st-transit");
    if (stTransit)
      stTransit.textContent = all.filter((s) =>
        ["in_transit", "customs", "out_for_delivery"].includes(s.status),
      ).length;
    const stDone = $("st-done");
    if (stDone)
      stDone.textContent = all.filter((s) => s.status === "delivered").length;
    renderShips();
    // Trigger outer dashboard refresh if available
    if (typeof patchedRefresh === "function") setTimeout(patchedRefresh, 50);
  }
  function renderShips() {
    let all = load(SK);
    if (activeFilter !== "all")
      all = all.filter((s) => s.status === activeFilter);
    const list = $("shipList");
    if (!all.length) {
      list.innerHTML = `<div class="empty">${activeFilter === "all" ? 'No shipments yet. <a href="#" id="goAddBtn">Create one →</a>' : "No shipments with this status."}</div>`;
      const g = $("goAddBtn");
      if (g)
        g.addEventListener("click", (e) => {
          e.preventDefault();
          if (window.showTab) window.showTab("addShipment");
          resetForm();
        });
      return;
    }
    const now = Date.now();
    list.innerHTML = all
      .map((s) => {
        const evts = (s.tracking_events || []).filter(
          (e) => new Date(e.event_time).getTime() <= now,
        );
        const pending = (s.tracking_events || []).filter(
          (e) => new Date(e.event_time).getTime() > now,
        );
        const flags = (s.alert_flags || []).filter((f) => f.active);
        return `<div class="ship-card">
        <div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px">
            <p class="ship-tn">${esc(s.tracking_number)}</p>
            <span class="badge ${esc(s.status)}">${esc(sLabel(s.status))}</span>
            <span style="font-size:11px;color:var(--muted)">${esc(s.mode || "")}</span>
            ${pending.length ? `<span style="font-size:10px;background:rgba(242,161,4,.15);color:var(--amber-dk);padding:2px 7px;border-radius:4px;font-weight:600">${pending.length} pending event${pending.length > 1 ? "s" : ""}</span>` : ""}
            ${flags.length ? `<span style="font-size:10px;background:rgba(214,69,69,.15);color:var(--alert);padding:2px 7px;border-radius:4px;font-weight:600">⚠ ${flags.length} flag${flags.length > 1 ? "s" : ""}</span>` : ""}
          </div>
          <p class="ship-lane">${esc(s.origin_port || "—")} → ${esc(s.destination_port || "—")}</p>
          <p class="ship-party"><strong>Sender:</strong> ${esc(s.shipper_contact || "—")}${s.shipper_phone ? " · " + esc(s.shipper_phone) : ""}${s.shipper_email ? " · " + esc(s.shipper_email) : ""}</p>
          <p class="ship-party"><strong>Receiver:</strong> ${esc(s.consignee_contact || "—")}${s.consignee_phone ? " · " + esc(s.consignee_phone) : ""}${s.consignee_email ? " · " + esc(s.consignee_email) : ""}</p>
          <p class="ship-meta">
            ${esc(s.commodity || "")}${s.weight_kg ? " · " + Number(s.weight_kg).toLocaleString() + " kg" : ""}
            · ETD ${fDate(s.etd)} · ETA ${fDate(s.eta)}
            · ${evts.length} visible event${evts.length !== 1 ? "s" : ""}
            ${s.charge_shipment || s.charge_handling ? ` · Total: ${money((parseFloat(s.charge_shipment) || 0) + (parseFloat(s.charge_handling) || 0))}` : ""}
          </p>
        </div>
        <div class="ship-actions">
          <button class="btn invoice" data-inv="${esc(s.tracking_number)}">🖨 Invoice</button>
          <button class="btn notify" data-notify="${esc(s.tracking_number)}">📨 Notify</button>
          <button class="btn" style="background:rgba(214,69,69,.08);border-color:rgba(214,69,69,.3);color:var(--alert)" data-flags="${esc(s.tracking_number)}">🚨 Flags${flags.length ? ` (${flags.length})` : ""}</button>
          <button class="btn update" data-upd="${esc(s.tracking_number)}">✏️ Update</button>
          <a href="tracking.html?track=${encodeURIComponent(s.tracking_number)}" target="_blank" class="btn">Track ↗</a>
          <button class="btn" data-edit="${esc(s.tracking_number)}">Edit</button>
          <button class="btn danger" data-del="${esc(s.tracking_number)}">Delete</button>
        </div>
      </div>`;
      })
      .join("");
  }

  $("shipList").addEventListener("click", (e) => {
    const inv = e.target.closest("[data-inv]");
    if (inv) {
      printInvoice(inv.dataset.inv);
      return;
    }
    const ntf = e.target.closest("[data-notify]");
    if (ntf) {
      openNotifModal(ntf.dataset.notify);
      return;
    }
    const flg = e.target.closest("[data-flags]");
    if (flg) {
      openFlagsModal(flg.dataset.flags);
      return;
    }
    const upd = e.target.closest("[data-upd]");
    if (upd) {
      openUpdateModal(upd.dataset.upd);
      return;
    }
    const ed = e.target.closest("[data-edit]");
    if (ed) {
      loadEdit(ed.dataset.edit);
      return;
    }
    const dl = e.target.closest("[data-del]");
    if (dl && confirm(`Delete ${dl.dataset.del}?`)) {
      save(
        SK,
        load(SK).filter((s) => s.tracking_number !== dl.dataset.del),
      );
      refreshDash();
    }
  });
  $("filters").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]");
    if (!b) return;
    activeFilter = b.dataset.f;
    document
      .querySelectorAll("#filters button")
      .forEach((x) => x.classList.toggle("active", x === b));
    renderShips();
  });

  /* ════════ ALERT FLAGS ════════ */
  const FLAG_TYPES = {
    weather_delay: {
      label: "Weather delay",
      color: "#5b9bd5",
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 19v1M8 15v1M12 21v1M12 17v1M16 19v1M16 15v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    },
    demurrage: {
      label: "Additional demurrage",
      color: "#e6954a",
      icon: `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 3.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
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
      label: "Custom alert",
      color: "#f2a104",
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    },
  };

  let flagsTN = null,
    selectedFlagType = null;

  function openFlagsModal(tn) {
    flagsTN = tn;
    selectedFlagType = null;
    $("flagsModalTN").textContent = tn;
    $("flagAddForm").classList.add("hidden");
    $("flagCustomLabel").value = "";
    $("flagNote").value = "";
    document
      .querySelectorAll(".flag-type-btn")
      .forEach((b) => b.classList.remove("selected"));
    const grid = $("flagTypeGrid");
    grid.innerHTML = Object.entries(FLAG_TYPES)
      .map(
        ([k, ft]) =>
          `<button class="flag-type-btn" data-ftype="${k}">
        <div class="flag-type-icon" style="background:${ft.color}">${ft.icon}</div>
        <span class="flag-type-label">${ft.label}</span>
      </button>`,
      )
      .join("");
    renderFlagList(tn);
    $("flagsModal").classList.add("open");
  }

  // Delegated click on the grid (works every time modal opens)
  $("flagTypeGrid").addEventListener("click", (e) => {
    const btn = e.target.closest(".flag-type-btn");
    if (!btn) return;
    document
      .querySelectorAll(".flag-type-btn")
      .forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedFlagType = btn.dataset.ftype;
    const ft = FLAG_TYPES[selectedFlagType];
    $("flagCustomLabel").placeholder =
      selectedFlagType === "custom"
        ? "Required: enter your custom flag name"
        : `Default: "${ft.label}" — or override below`;
    $("flagAddForm").classList.remove("hidden");
  });

  $("flagConfirmAdd").addEventListener("click", () => {
    if (!selectedFlagType) {
      alert("Please choose a flag type.");
      return;
    }
    if (selectedFlagType === "custom" && !$("flagCustomLabel").value.trim()) {
      alert("Please enter a name for the custom flag.");
      return;
    }
    const all = load(SK),
      ship = all.find((s) => s.tracking_number === flagsTN);
    if (!ship) return;
    if (!ship.alert_flags) ship.alert_flags = [];
    ship.alert_flags.push({
      type: selectedFlagType,
      custom_label: $("flagCustomLabel").value.trim() || null,
      note: $("flagNote").value.trim() || null,
      active: true,
      added_at: new Date().toISOString(),
    });
    save(SK, all);
    selectedFlagType = null;
    $("flagCustomLabel").value = "";
    $("flagNote").value = "";
    $("flagAddForm").classList.add("hidden");
    document
      .querySelectorAll(".flag-type-btn")
      .forEach((b) => b.classList.remove("selected"));
    renderFlagList(flagsTN);
    refreshDash();
    toast("Flag added — visible on tracking page now");
  });

  $("flagCancelAdd").addEventListener("click", () => {
    selectedFlagType = null;
    $("flagAddForm").classList.add("hidden");
    document
      .querySelectorAll(".flag-type-btn")
      .forEach((b) => b.classList.remove("selected"));
  });

  function renderFlagList(tn) {
    const ship = load(SK).find((s) => s.tracking_number === tn);
    const flags = ((ship && ship.alert_flags) || []).filter((f) => f.active);
    const list = $("flagList");
    if (!flags.length) {
      list.innerHTML =
        '<div class="flag-list-empty">No active flags on this shipment.</div>';
      return;
    }
    list.innerHTML = flags
      .map((f, i) => {
        const ft = FLAG_TYPES[f.type] || FLAG_TYPES.custom;
        return `<div class="flag-item">
        <div class="flag-item-icon" style="background:${ft.color}">${ft.icon}</div>
        <div class="flag-item-body">
          <p class="flag-item-label">${esc(f.custom_label || ft.label)}</p>
          ${f.note ? `<p class="flag-item-note">${esc(f.note)}</p>` : ""}
          <p style="font-size:11px;color:var(--muted);margin-top:3px">Added ${fDT(f.added_at)}</p>
        </div>
        <div class="flag-item-actions">
          <button class="flag-item-del" data-fidx="${i}" title="Remove">✕</button>
        </div>
      </div>`;
      })
      .join("");
    list.querySelectorAll("[data-fidx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!confirm("Remove this flag?")) return;
        const all = load(SK),
          sh = all.find((s) => s.tracking_number === flagsTN);
        if (!sh) return;
        (sh.alert_flags || []).filter((f) => f.active)[
          parseInt(btn.dataset.fidx)
        ].active = false;
        save(SK, all);
        renderFlagList(flagsTN);
        refreshDash();
        toast("Flag removed");
      });
    });
  }

  function closeFlagsModal() {
    $("flagsModal").classList.remove("open");
    flagsTN = null;
  }
  $("flagsModalClose").addEventListener("click", closeFlagsModal);
  $("flagsModal").addEventListener("click", (e) => {
    if (e.target === $("flagsModal")) closeFlagsModal();
  });

  /* ════════ INVOICE PRINT ════════ */
  function printInvoice(tn) {
    const s = load(SK).find((x) => x.tracking_number === tn);
    if (!s) return;
    const ship = parseFloat(s.charge_shipment) || 0,
      hand = parseFloat(s.charge_handling) || 0,
      total = ship + hand;
    const now = new Date();
    const issuedFull =
      now.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " " +
      now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const orderNum =
      s.tracking_number.replace(/[^0-9]/g, "") ||
      Math.floor(Math.random() * 9000 + 1000);
    const modeLabel =
      s.mode === "air"
        ? "Air Freight"
        : s.mode === "road"
          ? "Road / Rail"
          : "Ocean Freight";
    const statusColor =
      s.status === "delivered"
        ? "#1a7a4a"
        : s.status === "delayed" || s.status === "exception"
          ? "#c0392b"
          : "#1a6b2a";
    const USD = (n) =>
      n > 0
        ? "USD " +
          Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })
        : "USD 0.00";
    const seed = tn.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const barcodeStripes = Array.from(
      { length: 52 },
      (_, i) =>
        `<div style="width:${((seed * i * 7 + i * 13) % 3) + 1}px;background:#000;flex-shrink:0"></div>`,
    ).join("");
    const eventsHtml = (s.tracking_events || []).length
      ? `
      <table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr>
        <th style="background:#f0f4f8;padding:6px 8px;text-align:left;color:#1a5276;border:1px solid #d5e8f0;text-transform:uppercase;letter-spacing:.5px">Date / Time</th>
        <th style="background:#f0f4f8;padding:6px 8px;text-align:left;color:#1a5276;border:1px solid #d5e8f0;text-transform:uppercase;letter-spacing:.5px">Location</th>
        <th style="background:#f0f4f8;padding:6px 8px;text-align:left;color:#1a5276;border:1px solid #d5e8f0;text-transform:uppercase;letter-spacing:.5px">Update</th>
      </tr></thead><tbody>
      ${(s.tracking_events || [])
        .slice()
        .sort((a, b) => new Date(a.event_time) - new Date(b.event_time))
        .map(
          (e, i) =>
            `<tr style="background:${i % 2 ? "#fafcfe" : "#fff"}">
          <td style="padding:6px 8px;border:1px solid #e8f0f5;white-space:nowrap">${fDT(e.event_time)}</td>
          <td style="padding:6px 8px;border:1px solid #e8f0f5">${esc(e.location || "—")}</td>
          <td style="padding:6px 8px;border:1px solid #e8f0f5">${esc(e.description)}</td>
        </tr>`,
        )
        .join("")}
      </tbody></table>`
      : '<p style="color:#7f8c8d;font-size:12px">No tracking events yet.</p>';

    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Invoice — ${esc(tn)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;background:#e8f4f0;min-height:100vh;padding:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{background:#fff;max-width:800px;margin:0 auto;border:1px solid #c8ddd8;overflow:hidden;position:relative}
.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:72px;font-weight:900;color:rgba(11,31,51,.05);text-transform:uppercase;letter-spacing:12px;white-space:nowrap;pointer-events:none;z-index:0}
.content{position:relative;z-index:1;padding:28px 32px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.logo-img{height:64px;width:auto;object-fit:contain}
.logo-fallback{display:none;align-items:center;gap:10px}
.logo-icon{width:54px;height:54px;background:#0B1F33;border-radius:10px;display:flex;align-items:center;justify-content:center}
.logo-icon svg{width:30px;height:30px;color:#F2A104}
.logo-name{font-size:20px;font-weight:900;color:#0B1F33;text-transform:uppercase}
.logo-name span{color:#F2A104}
.tn-headline{font-size:17px;font-weight:900;color:#c0392b;margin-top:6px}
.photo-box{width:110px;height:110px;border:1.5px solid #c8ddd8;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#f8fffe;flex-shrink:0;font-size:9px;color:#aaa;text-align:center}
.company-band{text-align:center;padding:14px 20px;margin-bottom:20px}
.company-band p{font-size:13px;font-weight:700;color:#1a5276;line-height:1.7}
.parties-row{display:flex;gap:0;margin-bottom:20px;align-items:flex-start}
.party{flex:1;padding:12px 0}
.party-label{font-size:10px;font-weight:700;color:#1a5276;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px}
.party-name{font-size:17px;font-weight:900;color:#1a7a4a;margin-bottom:4px}
.party-line{font-size:12px;color:#2c3e50;margin-bottom:2px;line-height:1.5}
.party-line strong{font-weight:700}
.barcode-wrap{display:flex;flex-direction:column;align-items:center;gap:4px;padding:0 16px;flex-shrink:0}
.barcode-bars{display:flex;gap:1.5px;height:50px;align-items:stretch;padding:4px 8px;background:#fff;border:1px solid #eee}
.barcode-num{font-size:10px;font-weight:700;letter-spacing:1px;color:#2c3e50;font-family:monospace}
.order-row{display:flex;gap:6px;margin-bottom:3px;font-size:12px}
.order-key{font-weight:700;color:#2c3e50;min-width:100px}
.mode-pill{display:inline-block;background:#1a5276;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:3px;text-transform:uppercase}
.sec-title{font-size:10px;font-weight:700;color:#1a5276;letter-spacing:1px;text-transform:uppercase;margin:18px 0 8px;padding-top:14px;border-top:1px solid #e0ecf4}
table.cargo{width:100%;border-collapse:collapse;margin-bottom:6px}
table.cargo th{background:#1a5276;color:#fff;font-size:10px;letter-spacing:.5px;text-transform:uppercase;padding:8px 10px;text-align:left}
table.cargo td{padding:9px 10px;font-size:12px;border-bottom:1px solid #e8f0f5;color:#2c3e50;vertical-align:top}
table.cargo tr:nth-child(even) td{background:#fafcff}
.status-pill{display:inline-block;padding:3px 9px;border-radius:3px;font-size:10px;font-weight:700;text-transform:uppercase;color:#fff;background:${statusColor}}
.bottom-row{display:flex;gap:20px;margin-top:20px;padding-top:18px;border-top:1px solid #e0ecf4;align-items:flex-start}
.pay-box{flex:1}
.pay-title{font-size:12px;font-weight:700;color:#2c3e50;margin-bottom:8px}
.pay-icons{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.pay-icon{background:#f5f5f5;border:1px solid #e0e0e0;border-radius:4px;padding:4px 10px;font-size:11px;font-weight:700;color:#2c3e50}
.secure-badge{background:#e8f4ee;border:1px solid #b8ddc8;border-radius:4px;padding:6px 10px;font-size:10px;color:#1a6b3a;font-weight:600}
.stamp-col{flex:1;text-align:center}
.stamp-date{font-size:12px;font-weight:700;color:#2c3e50;margin-bottom:8px}
.stamp-circle{width:80px;height:80px;border-radius:50%;border:3px solid #1a5276;display:flex;align-items:center;justify-content:center;margin:0 auto;background:#fff}
.stamp-inner{text-align:center}
.stamp-inner .s1{font-size:7px;font-weight:900;color:#1a5276;letter-spacing:1px;text-transform:uppercase}
.stamp-inner .s2{font-size:11px;font-weight:900;color:#1a5276;font-style:italic;margin:2px 0}
.stamp-inner .s3{font-size:6px;color:#1a5276;letter-spacing:.5px}
.duty-col{flex:0 0 140px;text-align:center}
.duty-title{font-size:12px;font-weight:700;color:#2c3e50;margin-bottom:8px}
.duty-stamp{width:80px;height:80px;border-radius:50%;border:3px dashed #c0392b;display:flex;align-items:center;justify-content:center;margin:0 auto;background:#fff4f4}
.duty-stamp span{font-size:9px;font-weight:900;color:#c0392b;text-transform:uppercase;letter-spacing:1px;text-align:center;line-height:1.3}
.amount-section{margin-top:20px;padding-top:16px;border-top:1px solid #e0ecf4}
.amount-title{font-size:14px;font-weight:900;color:#2c3e50;margin-bottom:12px}
.amount-row{display:flex}
.amount-col{flex:1;padding:10px 14px;background:#f8fafc;border:1px solid #e0ecf4;margin-right:-1px}
.amount-col:last-child{margin-right:0;background:#1a5276}
.a-label{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7a8a99;margin-bottom:4px}
.amount-col:last-child .a-label{color:rgba(255,255,255,.7)}
.a-val{font-size:16px;font-weight:900;color:#2c3e50}
.amount-col:last-child .a-val{color:#fff}
.inv-footer{text-align:center;font-size:10px;color:#7a8a99;padding:14px 20px;background:#f8fafc;border-top:1px solid #e0ecf4;margin-top:20px}
.print-bar{max-width:800px;margin:0 auto 16px;display:flex;gap:10px}
.print-bar button{padding:10px 22px;border-radius:8px;border:0;font-size:14px;font-weight:700;cursor:pointer}
.btn-print{background:#1a5276;color:#fff}.btn-close{background:#e0e0e0;color:#333}
@media print{body{background:#fff!important;padding:0!important}.print-bar{display:none!important}.page{border:none!important}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style></head><body>
<div class="print-bar">
  <button class="btn-print" onclick="window.print()">🖨 Print / Save PDF</button>
  <button class="btn-close" onclick="window.close()">✕ Close</button>
</div>
<div class="watermark">Fast Forward Logistics</div>
<div class="page"><div class="content">
  <div class="hdr">
    <div>
      <img src="assest/images/logo.jpeg" alt="Fast Forward Logistics" class="logo-img"
        onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"/>
      <div class="logo-fallback">
        <div class="logo-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M3 15h13l4-4v4M3 15v3h18v-3M3 15l2-6h9l3 6" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="19" r="1.4" fill="currentColor"/><circle cx="17" cy="19" r="1.4" fill="currentColor"/></svg></div>
        <div><div class="logo-name">Fast <span>Forward</span> Logistics</div></div>
      </div>
      <p class="tn-headline">Tracking Number: ${esc(tn)}</p>
    </div>
    <div class="photo-box">Shipment<br/>Photo</div>
  </div>
  <div class="company-band">
    <p>Fast Forward Logistics Company</p>
    <p>Address: Baghdad, Iraq · USA · Europe · Worldwide</p>
    <p>Email: hello@fastforward.iq · Website: www.fastforward.iq</p>
  </div>
  <div class="parties-row">
    <div class="party">
      <div class="party-label">From (Sender)</div>
      <div class="party-name">${esc(s.shipper_contact || "—")}</div>
      ${s.shipper_phone ? `<div class="party-line"><strong>Phone:</strong> ${esc(s.shipper_phone)}</div>` : ""}
      ${s.shipper_email ? `<div class="party-line"><strong>Email:</strong> ${esc(s.shipper_email)}</div>` : ""}
      <div class="party-line"><strong>Address:</strong> ${esc(s.origin_port || "—")}</div>
    </div>
    <div class="party">
      <div class="party-label">To (Consignee)</div>
      <div class="party-name">${esc(s.consignee_contact || "—")}</div>
      ${s.consignee_phone ? `<div class="party-line"><strong>Phone:</strong> ${esc(s.consignee_phone)}</div>` : ""}
      ${s.consignee_email ? `<div class="party-line"><strong>Email:</strong> ${esc(s.consignee_email)}</div>` : ""}
      <div class="party-line"><strong>Address:</strong> ${esc(s.destination_port || "—")}</div>
    </div>
    <div class="barcode-wrap">
      <div class="barcode-bars">${barcodeStripes}</div>
      <div class="barcode-num">${esc(tn)}</div>
      <div style="margin-top:10px">
        <div class="order-row"><span class="order-key">Order ID:</span><span>${orderNum}</span></div>
        <div class="order-row"><span class="order-key">Mode:</span><span><span class="mode-pill">${modeLabel}</span></span></div>
        <div class="order-row"><span class="order-key">Ship Cost:</span><span>${USD(ship)}</span></div>
        <div class="order-row"><span class="order-key">Tracking:</span><span style="font-family:monospace;font-size:10px">${esc(tn)}</span></div>
      </div>
    </div>
  </div>
  <div class="sec-title">Shipment details</div>
  <table class="cargo"><thead><tr>
    <th>Qty</th><th>Product / Commodity</th><th>Status</th><th>Description</th>
    <th>Shipping Cost</th><th>Handling Cost</th><th>Total Cost</th>
  </tr></thead><tbody><tr>
    <td>${s.pieces || "1"}</td>
    <td><strong>${esc(s.commodity || "General cargo")}</strong>${s.weight_kg ? `<br/><span style="color:#7a8a99;font-size:11px">${Number(s.weight_kg).toLocaleString()} kg</span>` : ""}</td>
    <td><span class="status-pill">${esc(sLabel(s.status))}</span></td>
    <td>${esc(s.origin_port || "—")} → ${esc(s.destination_port || "—")}${s.vessel_name ? `<br/><span style="color:#7a8a99;font-size:11px">${esc(s.vessel_name)}</span>` : ""}</td>
    <td style="font-weight:700">${USD(ship)}</td>
    <td style="font-weight:700">${USD(hand)}</td>
    <td style="font-weight:900;color:#1a5276">${USD(total)}</td>
  </tr>${
    s.bill_of_lading || s.container_number
      ? `<tr><td colspan="7" style="font-size:11px;color:#7a8a99;padding:6px 10px">
    ${s.bill_of_lading ? `B/L: <strong style="font-family:monospace">${esc(s.bill_of_lading)}</strong>  ` : ""}
    ${s.container_number ? `Container: <strong style="font-family:monospace">${esc(s.container_number)}</strong>  ` : ""}
    ETD: <strong>${fDate(s.etd)}</strong>  ETA: <strong>${fDate(s.eta)}</strong>
  </td></tr>`
      : ""
  }</tbody></table>
  ${(s.tracking_events || []).length ? `<div class="sec-title">Tracking history</div>${eventsHtml}` : ""}
  <div class="bottom-row">
    <div class="pay-box">
      <div class="pay-title">Payment Methods:</div>
      <div class="pay-icons"><span class="pay-icon">VISA</span><span class="pay-icon">MasterCard</span><span class="pay-icon">AMEX</span><span class="pay-icon">PayPal</span><span class="pay-icon">Bank Transfer</span></div>
      <div class="secure-badge">🔒 Secured · Safe Shopping</div>
    </div>
    <div class="stamp-col">
      <div class="stamp-date">Official Stamp / ${issuedFull}</div>
      <div class="stamp-circle"><div class="stamp-inner"><div class="s1">Fast Forward</div><div class="s2">Logistics</div><div class="s3">Baghdad · Iraq</div><div class="s1">Est. 2009</div></div></div>
    </div>
    <div class="duty-col">
      <div class="duty-title">Stamp Duty:</div>
      <div class="duty-stamp"><span>STAMP<br/>DUTY</span></div>
    </div>
  </div>
  <div class="amount-section">
    <div class="amount-title">Amount Due</div>
    <div class="amount-row">
      <div class="amount-col"><div class="a-label">Shipping Cost:</div><div class="a-val">${USD(ship)}</div></div>
      <div class="amount-col"><div class="a-label">Handling Cost:</div><div class="a-val">${USD(hand)}</div></div>
      <div class="amount-col"><div class="a-label">Total Amount:</div><div class="a-val">${USD(total)}</div></div>
    </div>
  </div>
</div>
<div class="inv-footer">Fast Forward Logistics · hello@fastforward.iq · +964 780 000 0000 · Baghdad, Iraq | Thank you for choosing Fast Forward Logistics.</div>
</div></body></html>`;
    const win = window.open("", "_blank", "width=880,height=1100");
    if (!win) {
      toast("Pop-up blocked — please allow pop-ups for this page.");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  /* ════════ UPDATE MODAL ════════ */
  let modalTN = null;
  function openUpdateModal(tn) {
    modalTN = tn;
    $("modalTN").textContent = tn;
    $("updLocation").value = "";
    $("updStatus").value = "";
    $("updNote").value = "";
    const ship = load(SK).find((s) => s.tracking_number === tn);
    const evts = ((ship && ship.tracking_events) || [])
      .slice()
      .reverse()
      .slice(0, 8);
    if (evts.length) {
      $("updateLog").style.display = "";
      $("updateLogList").innerHTML = evts
        .map(
          (e) =>
            `<div class="update-item"><div><div class="update-time">${fDT(e.event_time)}</div>${e.location ? `<div style="font-size:11px;color:var(--muted)">${esc(e.location)}</div>` : ""}</div><div>${esc(e.description)}</div></div>`,
        )
        .join("");
    } else {
      $("updateLog").style.display = "none";
    }
    $("updateModal").classList.add("open");
    setTimeout(() => $("updNote").focus(), 100);
  }
  function closeModal() {
    $("updateModal").classList.remove("open");
    modalTN = null;
  }
  $("modalClose").addEventListener("click", closeModal);
  $("modalCancel").addEventListener("click", closeModal);
  $("updateModal").addEventListener("click", (e) => {
    if (e.target === $("updateModal")) closeModal();
  });
  $("modalSave").addEventListener("click", () => {
    const note = $("updNote").value.trim();
    if (!note) {
      alert("Please enter an update note.");
      $("updNote").focus();
      return;
    }
    const all = load(SK),
      ship = all.find((s) => s.tracking_number === modalTN);
    if (!ship) {
      closeModal();
      return;
    }
    ship.tracking_events = ship.tracking_events || [];
    ship.tracking_events.push({
      event_time: new Date().toISOString(),
      location: $("updLocation").value.trim(),
      description: note,
    });
    const ns = $("updStatus").value;
    if (ns) ship.status = ns;
    save(SK, all);
    closeModal();
    refreshDash();
    toast(`Update posted on ${modalTN}`);
  });

  /* ════════ ADD / EDIT FORM ════════ */
  const form = $("shipForm"),
    tnFld = $("tnField"),
    evRows = $("eventRows");
  let editKey = null;
  const fv = (n) => {
    const f = form.querySelector(`[name="${n}"]`);
    return f ? f.value.trim() : "";
  };
  const fset = (n, v) => {
    const f = form.querySelector(`[name="${n}"]`);
    if (f) f.value = v ?? "";
  };
  function addEvRow(ev = {}) {
    const d = document.createElement("div");
    d.className = "ev-row";
    const nowMs = Date.now(),
      evTime = ev.event_time ? new Date(ev.event_time).getTime() : null;
    const state = evTime ? (evTime <= nowMs ? "live" : "pending") : "pending";
    d.classList.add(state);
    d.innerHTML = `<input type="datetime-local" class="ev-time" value="${toInp(ev.event_time)}" placeholder="Date &amp; time"/>
      <input type="text" class="ev-loc" placeholder="Location" value="${esc(ev.location || "")}"/>
      <input type="text" class="ev-desc" placeholder="Description" value="${esc(ev.description || "")}"/>
      <button type="button" class="ev-del" title="Remove">✕</button>`;
    d.querySelector(".ev-time").addEventListener("change", function () {
      const t = this.value ? new Date(this.value).getTime() : null;
      d.className =
        "ev-row " + (t ? (t <= Date.now() ? "live" : "pending") : "pending");
    });
    d.querySelector(".ev-del").addEventListener("click", () => d.remove());
    evRows.appendChild(d);
  }
  function collectEvs() {
    return [...evRows.querySelectorAll(".ev-row")]
      .map((r) => ({
        event_time:
          toISO(r.querySelector(".ev-time").value) || new Date().toISOString(),
        location: r.querySelector(".ev-loc").value.trim(),
        description: r.querySelector(".ev-desc").value.trim(),
      }))
      .filter((e) => e.description);
  }
  function resetForm() {
    form.reset();
    refreshAutoFields(true);
    calcTotal();
    evRows.innerHTML = "";
    addEvRow();
    editKey = null;
    $("formTitle").textContent = "Create New Shipment";
    $("cancelEditBtn").style.display = "none";
  }
  function fillForm(s) {
    [
      "mode",
      "status",
      "origin_port",
      "destination_port",
      "shipper_contact",
      "shipper_phone",
      "shipper_email",
      "consignee_contact",
      "consignee_phone",
      "consignee_email",
      "vessel_name",
      "voyage_number",
      "commodity",
      "weight_kg",
      "pieces",
      "charge_shipment",
      "charge_handling",
    ].forEach((n) => fset(n, s[n]));
    $("tnField").value = s.tracking_number || "";
    $("containerField").value = s.container_number || "";
    $("blField").value = s.bill_of_lading || "";
    fset("etd", toInp(s.etd));
    fset("eta", toInp(s.eta));
    calcTotal();
    evRows.innerHTML = "";
    (s.tracking_events || [])
      .slice()
      .sort((a, b) => new Date(a.event_time) - new Date(b.event_time))
      .forEach(addEvRow);
    if (!evRows.children.length) addEvRow();
  }
  function loadEdit(tn) {
    const s = load(SK).find((x) => x.tracking_number === tn);
    if (!s) return;
    fillForm(s);
    editKey = s.tracking_number;
    $("formTitle").textContent = "Edit Shipment — " + s.tracking_number;
    $("cancelEditBtn").style.display = "";
    if (window.showTab) window.showTab("addShipment");
  }
  $("addEventBtn").addEventListener("click", () => addEvRow());
  $("clearFormBtn").addEventListener("click", resetForm);
  $("cancelEditBtn").addEventListener("click", () => {
    resetForm();
    if (window.showTab) window.showTab("dashboard");
  });
  $("sampleBtn").addEventListener("click", () => {
    const now = Date.now(),
      d = (n) => new Date(now + n * 864e5).toISOString();
    fillForm({
      mode: "ocean",
      status: "in_transit",
      origin_port: "Umm Qasr, IQ (IQUQR)",
      destination_port: "New York, US (USNYC)",
      shipper_contact: "Ahmed Hassan",
      shipper_phone: "+964 750 123 4567",
      shipper_email: "ahmed@basradates.iq",
      consignee_contact: "Sarah Johnson",
      consignee_phone: "+1 718 555 0199",
      consignee_email: "sarah@brooklynfoods.com",
      vessel_name: "MV Northern Vigour",
      voyage_number: "V.001W",
      commodity: "Fresh dates (reefer)",
      weight_kg: 18450,
      pieces: 320,
      charge_shipment: 2600,
      charge_handling: 380,
      etd: d(-12),
      eta: d(16),
      tracking_events: [
        {
          event_time: d(-14),
          location: "Basra, IQ",
          description: "Booking confirmed",
        },
        {
          event_time: d(-12),
          location: "Umm Qasr, IQ (IQUQR)",
          description: "Vessel departed port of loading",
        },
        {
          event_time: d(-5),
          location: "Jeddah, SA",
          description: "Transshipment — reloaded",
        },
        {
          event_time: d(8),
          location: "Atlantic Ocean",
          description: "Vessel crossing Atlantic — on schedule",
        },
        {
          event_time: d(16),
          location: "New York, US (USNYC)",
          description: "Vessel arrived at destination port",
        },
      ],
    });
    $("containerField").value = genContainer("ocean");
    $("blField").value = genBL("ocean");
    editKey = null;
    $("formTitle").textContent = "Create New Shipment";
  });
  $("saveBtn").addEventListener("click", () => {
    if (!fv("commodity")) {
      alert("Please enter the commodity.");
      return;
    }
    if (!fv("shipper_contact")) {
      alert("Please enter the sender contact name.");
      return;
    }
    if (!fv("consignee_contact")) {
      alert("Please enter the receiver contact name.");
      return;
    }
    if (!fv("origin_port")) {
      alert("Please enter the origin address.");
      return;
    }
    if (!fv("destination_port")) {
      alert("Please enter the destination address.");
      return;
    }
    const tn = editKey || $("tnField").value || genTN();
    const cs = parseFloat(fv("charge_shipment")) || 0,
      ch = parseFloat(fv("charge_handling")) || 0;
    // preserve existing alert_flags when editing
    const existing = editKey
      ? load(SK).find((s) => s.tracking_number === editKey) || {}
      : {};
    const rec = {
      tracking_number: tn,
      mode: fv("mode"),
      status: fv("status"),
      origin_port: fv("origin_port"),
      destination_port: fv("destination_port"),
      shipper_contact: fv("shipper_contact"),
      shipper_phone: fv("shipper_phone"),
      shipper_email: fv("shipper_email"),
      consignee_contact: fv("consignee_contact"),
      consignee_phone: fv("consignee_phone"),
      consignee_email: fv("consignee_email"),
      vessel_name: fv("vessel_name"),
      voyage_number: fv("voyage_number"),
      container_number: $("containerField").value || genContainer(fv("mode")),
      bill_of_lading: $("blField").value || genBL(fv("mode")),
      commodity: fv("commodity"),
      weight_kg: fv("weight_kg") ? Number(fv("weight_kg")) : null,
      pieces: fv("pieces") ? Number(fv("pieces")) : null,
      etd: toISO(form.querySelector("[name=etd]").value),
      eta: toISO(form.querySelector("[name=eta]").value),
      charge_shipment: cs || null,
      charge_handling: ch || null,
      charge_total: cs + ch || null,
      tracking_events: collectEvs(),
      alert_flags: existing.alert_flags || [],
      created_at: new Date().toISOString(),
    };
    let all = load(SK).filter(
      (s) => s.tracking_number.toLowerCase() !== tn.toLowerCase(),
    );
    all.unshift(rec);
    save(SK, all);
    resetForm();
    toast(`Saved ${tn}`);
    if (window.showTab) window.showTab("dashboard");
  });

  /* ════════ QUOTES ════════ */
  function renderQuotes() {
    const all = load(QK);
    $("quoteList").innerHTML = !all.length
      ? '<div class="empty">No quote requests yet.</div>'
      : all
          .map(
            (q) =>
              `<div class="quote-item"><div><p class="q-ref">${esc(q.reference || "—")}</p><p class="q-lane">${esc(q.origin || "Iraq")} → ${esc(q.destination || "—")} · ${esc(q.mode || "")}</p><p class="q-meta">${q.estimate_low ? "$" + q.estimate_low.toLocaleString() + "–$" + q.estimate_high.toLocaleString() : ""} · ${esc(q.name || "")} · ${esc(q.email || "")}</p></div><a href="mailto:${esc(q.email)}" class="btn" style="width:auto;padding:7px 14px">Reply</a></div>`,
          )
          .join("");
  }
  $("clearQuotesBtn").addEventListener("click", () => {
    if (confirm("Clear all?")) {
      save(QK, []);
      renderQuotes();
    }
  });

  /* ════════════════════════════════════════════════════
     SETTINGS — store EmailJS + Twilio keys in localStorage
  ════════════════════════════════════════════════════ */
  const CFG_KEY = "ffl_notif_config";
  function loadCfg() {
    try {
      return JSON.parse(localStorage.getItem(CFG_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveCfg(obj) {
    localStorage.setItem(CFG_KEY, JSON.stringify(obj));
  }

  function fillSettings() {
    const c = loadCfg();
    $("ejsPublicKey").value = c.ejsPublicKey || "";
    $("ejsServiceId").value = c.ejsServiceId || "";
    $("ejsTemplateId").value = c.ejsTemplateId || "";
    $("smsProxyUrl").value = c.smsProxyUrl || "";
    $("cfgCompanyName").value = c.companyName || "Fast Forward Logistics";
    $("cfgSupportPhone").value = c.supportPhone || "+964 780 000 0000";
    $("cfgSupportEmail").value = c.supportEmail || "hello@fastforward.iq";
    $("cfgTrackingUrl").value =
      c.trackingUrl || window.location.origin + "/tracking.html";
  }

  $("saveSettings").addEventListener("click", () => {
    saveCfg({
      ejsPublicKey: $("ejsPublicKey").value.trim(),
      ejsServiceId: $("ejsServiceId").value.trim(),
      ejsTemplateId: $("ejsTemplateId").value.trim(),
      smsProxyUrl: $("smsProxyUrl").value.trim(),
      companyName: $("cfgCompanyName").value.trim(),
      supportPhone: $("cfgSupportPhone").value.trim(),
      supportEmail: $("cfgSupportEmail").value.trim(),
      trackingUrl: $("cfgTrackingUrl").value.trim(),
    });
    const m = $("settingsMsg");
    m.textContent = "✓ Settings saved.";
    m.style.display = "block";
    m.style.color = "var(--teal)";
    setTimeout(() => {
      m.style.display = "none";
    }, 3000);
    toast("Settings saved");
  });

  $("testEmail").addEventListener("click", async () => {
    const c = loadCfg();
    if (!c.ejsPublicKey || !c.ejsServiceId || !c.ejsTemplateId) {
      alert("Please fill in and save your EmailJS keys first.");
      return;
    }
    const m = $("settingsMsg");
    m.textContent = "⏳ Sending test email…";
    m.style.display = "block";
    m.style.color = "var(--amber-dk)";
    try {
      if (window.emailjs) {
        window.emailjs.init({ publicKey: c.ejsPublicKey });
        await window.emailjs.send(c.ejsServiceId, c.ejsTemplateId, {
          to_name: "Test Customer",
          to_email: c.supportEmail,
          tracking_number: "FFL-TEST-0000",
          commodity: "Test cargo",
          eta: "Mon, 01 Sep 2026",
          origin: "Baghdad, IQ",
          destination: "New York, US",
          message:
            "This is a test notification from Fast Forward Logistics admin panel.",
          company_name: c.companyName,
          support_phone: c.supportPhone,
          support_email: c.supportEmail,
          tracking_url: c.trackingUrl + "?track=FFL-TEST-0000",
        });
        m.textContent = "✓ Test email sent to " + c.supportEmail;
        m.style.color = "var(--teal)";
      } else {
        m.textContent = "✗ EmailJS SDK not loaded — check internet connection";
        m.style.color = "var(--alert)";
      }
    } catch (err) {
      m.textContent =
        "✗ Email failed: " + (err.text || err.message || String(err));
      m.style.color = "var(--alert)";
    }
  });

  $("testSMS").addEventListener("click", async () => {
    const c = loadCfg();
    if (!c.smsProxyUrl) {
      alert(
        "Please fill in and save your SMS Proxy URL (Supabase function URL) in Settings first.",
      );
      return;
    }
    const testPhone = prompt(
      "Enter a phone number to send the test SMS to (with country code e.g. +9647801234567):",
    );
    if (!testPhone || !testPhone.trim()) return;
    const m = $("settingsMsg");
    m.textContent = "⏳ Sending test SMS…";
    m.style.display = "block";
    m.style.color = "var(--amber-dk)";
    try {
      const msgBody =
        (c.companyName || "Fast Forward Logistics") +
        ": Test SMS — your notification system is working correctly.";
      const res = await fetch(c.smsProxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone.trim(), message: msgBody }),
      });
      const data = await res.json();
      if (data.success) {
        m.textContent =
          "✓ Test SMS sent to " +
          testPhone.trim() +
          "! Credits remaining: " +
          (data.quotaRemaining ?? "?");
        m.style.color = "var(--teal)";
      } else {
        m.textContent = "✗ SMS failed: " + (data.error || JSON.stringify(data));
        m.style.color = "var(--alert)";
      }
    } catch (err) {
      m.textContent = "✗ Error: " + (err.message || String(err));
      m.style.color = "var(--alert)";
    }
  });

  /* ════════════════════════════════════════════════════
     NOTIFICATION MODAL — preview & send
  ════════════════════════════════════════════════════ */
  const fmtEta = (iso) =>
    !iso
      ? "—"
      : new Date(iso).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });

  function buildMessage(s, cfg) {
    const company = cfg.companyName || "Fast Forward Logistics";
    const trackUrl =
      (cfg.trackingUrl || "http://localhost:5500/tracking.html") +
      "?track=" +
      encodeURIComponent(s.tracking_number);
    return `Dear ${s.consignee_contact || "Valued Customer"},

We are pleased to confirm that your shipment has been booked with ${company}.

📦 SHIPMENT DETAILS
━━━━━━━━━━━━━━━━━━━━
Tracking Number : ${s.tracking_number}
Commodity       : ${s.commodity || "—"}
Weight          : ${s.weight_kg ? Number(s.weight_kg).toLocaleString() + " kg" : "—"}
Pieces          : ${s.pieces || "—"}
Freight mode    : ${s.mode === "air" ? "Air Freight" : s.mode === "road" ? "Road / Rail" : "Ocean Freight"}

📍 ROUTE
━━━━━━━━━━━━━━━━━━━━
From            : ${s.origin_port || "—"}
To              : ${s.destination_port || "—"}
Departed (ETD)  : ${fmtEta(s.etd)}
Expected arrival: ${fmtEta(s.eta)}

🔗 Track your shipment live:
${trackUrl}

For any enquiries please contact us:
📧 ${cfg.supportEmail || "hello@fastforward.iq"}
📞 ${cfg.supportPhone || "+964 780 000 0000"}

Thank you for choosing ${company}.`;
  }

  function buildSMS(s, cfg) {
    const company = cfg.companyName || "Fast Forward Logistics";
    const trackUrl =
      (cfg.trackingUrl || "") +
      "?track=" +
      encodeURIComponent(s.tracking_number);
    const eta = s.eta
      ? new Date(s.eta).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";
    return `${company}: Hi ${s.consignee_contact || "Customer"}, your shipment ${s.tracking_number} (${s.commodity || "cargo"}) is ${s.status.replace("_", " ")}. ETA: ${eta}. From: ${s.origin_port || "—"} → ${s.destination_port || "—"}. Track: ${trackUrl}`;
  }

  let notifShipment = null;

  function openNotifModal(tn) {
    const s = load(SK).find((x) => x.tracking_number === tn);
    if (!s) return;
    notifShipment = s;
    const cfg = loadCfg();

    $("notifModalTN").textContent = tn;
    $("notifRecvName").textContent = s.consignee_contact || "—";
    $("notifEmail").textContent = s.consignee_email || "(no email on file)";
    $("notifPhone").textContent = s.consignee_phone || "(no phone on file)";
    $("notifMessage").value = buildMessage(s, cfg);
    $("notifStatus").style.display = "none";
    $("notifStatus").className = "";

    // grey out SMS toggle if no phone
    $("sendSMS").disabled = !s.consignee_phone;
    if (!s.consignee_phone) $("sendSMS").checked = false;
    $("sendEmail").disabled = !s.consignee_email;
    if (!s.consignee_email) $("sendEmail").checked = false;

    $("notifModal").classList.add("open");
  }

  function closeNotifModal() {
    $("notifModal").classList.remove("open");
    notifShipment = null;
  }
  $("notifModalClose").addEventListener("click", closeNotifModal);
  $("notifCancel").addEventListener("click", closeNotifModal);
  $("notifModal").addEventListener("click", (e) => {
    if (e.target === $("notifModal")) closeNotifModal();
  });

  $("notifSend").addEventListener("click", async () => {
    if (!notifShipment) return;
    const s = notifShipment,
      cfg = loadCfg();
    const doEmail = $("sendEmail").checked && s.consignee_email;
    const doSMS = $("sendSMS").checked && s.consignee_phone;
    const message = $("notifMessage").value.trim();

    if (!doEmail && !doSMS) {
      alert(
        "Please select at least one channel (email or SMS) and make sure the shipment has contact details.",
      );
      return;
    }

    const statusEl = $("notifStatus");
    statusEl.textContent = "⏳ Sending…";
    statusEl.className = "sending";
    statusEl.style.display = "block";
    $("notifSend").disabled = true;

    const results = [];

    /* ── Email via EmailJS ── */
    if (doEmail) {
      if (!cfg.ejsPublicKey || !cfg.ejsServiceId || !cfg.ejsTemplateId) {
        results.push(
          "✗ Email: EmailJS keys not configured. Go to Settings tab.",
        );
      } else {
        try {
          if (window.emailjs) {
            window.emailjs.init({ publicKey: cfg.ejsPublicKey });
            await window.emailjs.send(cfg.ejsServiceId, cfg.ejsTemplateId, {
              to_name: s.consignee_contact || "Customer",
              to_email: s.consignee_email,
              tracking_number: s.tracking_number,
              commodity: s.commodity || "—",
              eta: fmtEta(s.eta),
              origin: s.origin_port || "—",
              destination: s.destination_port || "—",
              message: message,
              company_name: cfg.companyName || "Fast Forward Logistics",
              support_phone: cfg.supportPhone || "",
              support_email: cfg.supportEmail || "",
              tracking_url:
                (cfg.trackingUrl || "") +
                "?track=" +
                encodeURIComponent(s.tracking_number),
            });
            results.push("✓ Email sent to " + s.consignee_email);
          } else {
            results.push("✗ Email: EmailJS SDK not loaded");
          }
        } catch (err) {
          results.push(
            "✗ Email failed: " + (err.text || err.message || String(err)),
          );
        }
      }
    }

    /* ── SMS via Textbelt ── */
    if (doSMS) {
      if (!cfg.smsProxyUrl) {
        results.push(
          "✗ SMS: SMS Proxy URL not configured. Go to Settings tab.",
        );
      } else {
        try {
          const smsBody = buildSMS(s, cfg);
          const res = await fetch(cfg.smsProxyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: s.consignee_phone,
              message: smsBody,
            }),
          });
          const data = await res.json();
          if (data.success) {
            results.push(
              "✓ SMS sent to " +
                s.consignee_phone +
                " · Credits left: " +
                (data.quotaRemaining ?? "?"),
            );
          } else {
            results.push(
              "✗ SMS failed: " +
                (data.error || JSON.stringify(data).slice(0, 120)),
            );
          }
        } catch (err) {
          results.push("✗ SMS failed: " + (err.message || String(err)));
        }
      }
    }

    const allOk = results.every((r) => r.startsWith("✓"));
    statusEl.textContent = results.join("\n");
    statusEl.className = allOk ? "success" : "error";
    $("notifSend").disabled = false;

    if (allOk) {
      // Log notification on shipment
      const all = load(SK),
        ship = all.find((x) => x.tracking_number === s.tracking_number);
      if (ship) {
        if (!ship.notifications) ship.notifications = [];
        ship.notifications.push({
          sent_at: new Date().toISOString(),
          channels: [doEmail ? "email" : null, doSMS ? "sms" : null].filter(
            Boolean,
          ),
        });
        save(SK, all);
      }
      toast("Notification sent!");
      setTimeout(() => closeNotifModal(), 2200);
    }
  });

  /* ── init ── */
  resetForm();
  refreshDash();
  fillSettings();
  // Expose key functions globally so admin.html showTab() can call them
  window.renderShips = renderShips;
  window.refreshDash = refreshDash;
  window.renderQuotes = renderQuotes;
  window.openFlagsModal = openFlagsModal;
})();
