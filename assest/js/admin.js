/* =====================================================================
   Fast Forward Logistics — Admin (single page, section tabs)
   Sections: Dashboard · Add Shipment · Quotes
   ===================================================================== */
(() => {
  "use strict";

  const SK = "ffl_shipments",
    QK = "ffl_quotes";
  const read = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k) || "[]");
    } catch {
      return [];
    }
  };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const byId = (id) => document.getElementById(id);
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

  /* ==================================================================
     SECTION NAVIGATION
     ================================================================== */
  const sections = document.querySelectorAll(".admin-section");
  const navLinks = document.querySelectorAll("#adminNav a[data-section]");

  function showSection(key) {
    sections.forEach((s) =>
      s.classList.toggle("hidden", s.id !== "sec-" + key),
    );
    navLinks.forEach((a) =>
      a.classList.toggle("active", a.dataset.section === key),
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (key === "dashboard") {
      renderStats();
      renderShipments();
    }
    if (key === "quotes") renderQuotes();
  }

  byId("adminNav").addEventListener("click", (e) => {
    const link = e.target.closest("[data-section]");
    if (!link) return;
    e.preventDefault();
    showSection(link.dataset.section);
  });

  // public helper so dashboard buttons can switch to the form
  function goToForm(tn) {
    if (tn) loadShipmentIntoForm(tn);
    else resetForm();
    showSection("addShipment");
  }

  /* ==================================================================
     SHARED
     ================================================================== */
  const STATUSES = [
    { value: "booked", label: "Booked" },
    { value: "in_transit", label: "In transit" },
    { value: "customs", label: "Customs" },
    { value: "out_for_delivery", label: "Out for delivery" },
    { value: "delivered", label: "Delivered" },
    { value: "delayed", label: "Delayed" },
    { value: "exception", label: "Exception" },
  ];
  const statusLabel = (v) =>
    (STATUSES.find((s) => s.value === v) || {}).label || v;
  const statusOpts = (cur) =>
    STATUSES.map(
      (s) =>
        `<option value="${s.value}"${s.value === cur ? " selected" : ""}>${s.label}</option>`,
    ).join("");
  const fmtDate = (iso) =>
    !iso
      ? "—"
      : new Date(iso).toLocaleDateString(undefined, {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });

  function flash(msg) {
    const n = byId("adminFlash");
    n.textContent = msg;
    n.classList.add("show");
    setTimeout(() => n.classList.remove("show"), 3200);
  }

  function generateTN() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const pick = (len) =>
      Array.from(
        { length: len },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join("");
    const existing = new Set(read(SK).map((s) => s.tracking_number));
    let tn;
    do {
      tn = `FFL-${pick(3)}-${pick(4)}`;
    } while (existing.has(tn));
    return tn;
  }

  const toInput = (iso) =>
    iso ? new Date(iso).toISOString().slice(0, 16) : "";
  const toISO = (v) => (v ? new Date(v).toISOString() : null);

  /* ==================================================================
     DASHBOARD
     ================================================================== */
  let activeFilter = "all";

  function renderStats() {
    const all = read(SK);
    const total = all.length;
    const transit = all.filter((s) =>
      ["in_transit", "customs", "out_for_delivery"].includes(s.status),
    ).length;
    const delivered = all.filter((s) => s.status === "delivered").length;
    const attention = all.filter(
      (s) => s.status === "delayed" || s.status === "exception",
    ).length;
    byId("dashStats").innerHTML = `
      <div class="dash-stat"><span class="dash-stat-num">${total}</span><span class="dash-stat-label">Total</span></div>
      <div class="dash-stat"><span class="dash-stat-num amber">${transit}</span><span class="dash-stat-label">In transit</span></div>
      <div class="dash-stat"><span class="dash-stat-num teal">${delivered}</span><span class="dash-stat-label">Delivered</span></div>
      <div class="dash-stat"><span class="dash-stat-num alert">${attention}</span><span class="dash-stat-label">Attention</span></div>`;
  }

  function renderShipments() {
    let all = read(SK);
    if (activeFilter !== "all")
      all = all.filter((s) => s.status === activeFilter);
    if (!all.length) {
      byId("dashList").innerHTML = `<p class="admin-empty">${
        activeFilter === "all"
          ? 'No shipments yet. <a href="#" id="emptyAddBtn">Create one →</a>'
          : "No shipments with this status."
      }</p>`;
      const btn = byId("emptyAddBtn");
      if (btn)
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          goToForm();
        });
      return;
    }
    byId("dashList").innerHTML = all
      .map(
        (s) => `
      <div class="dash-ship" data-tn="${esc(s.tracking_number)}">
        <div>
          <div class="dash-ship-top">
            <p class="dash-ship-tn">${esc(s.tracking_number)}</p>
            <span class="pill pill-${esc(s.status)}">${esc(statusLabel(s.status))}</span>
            <span style="font-size:12px;color:var(--muted)">${esc(s.mode || "")}</span>
          </div>
          <p class="dash-ship-lane">${esc(s.origin_port || "—")} → ${esc(s.destination_port || "—")}</p>
          <div class="dash-ship-parties">
            <p class="dash-ship-party"><strong>Sender:</strong> ${esc(s.shipper || "—")}${s.shipper_contact ? " · " + esc(s.shipper_contact) : ""}${s.shipper_phone ? " · " + esc(s.shipper_phone) : ""}${s.shipper_email ? " · " + esc(s.shipper_email) : ""}</p>
            <p class="dash-ship-party"><strong>Receiver:</strong> ${esc(s.consignee || "—")}${s.consignee_contact ? " · " + esc(s.consignee_contact) : ""}${s.consignee_phone ? " · " + esc(s.consignee_phone) : ""}${s.consignee_email ? " · " + esc(s.consignee_email) : ""}</p>
          </div>
          <p class="dash-ship-meta">
            ${esc(s.commodity || "")}${s.weight_kg ? " · " + Number(s.weight_kg).toLocaleString() + " kg" : ""}${s.pieces ? " · " + s.pieces + " pcs" : ""}
            · ETD ${fmtDate(s.etd)} · ETA ${fmtDate(s.eta)}
            · ${(s.tracking_events || []).length} events
          </p>
        </div>
        <div class="dash-ship-actions">
          <select class="status-select" data-status-for="${esc(s.tracking_number)}">${statusOpts(s.status)}</select>
          <a href="tracking.html?track=${encodeURIComponent(s.tracking_number)}" target="_blank" class="ai-btn">Track ↗</a>
          <button type="button" class="ai-btn" data-edit="${esc(s.tracking_number)}">Edit</button>
          <button type="button" class="ai-btn ai-danger" data-del="${esc(s.tracking_number)}">Delete</button>
        </div>
      </div>`,
      )
      .join("");
  }

  // status quick-update
  byId("dashList").addEventListener("change", (e) => {
    const sel = e.target.closest("[data-status-for]");
    if (!sel) return;
    const tn = sel.dataset.statusFor,
      newStatus = sel.value;
    const all = read(SK);
    const ship = all.find((s) => s.tracking_number === tn);
    if (!ship) return;
    const oldLabel = statusLabel(ship.status);
    ship.status = newStatus;
    if (!ship.tracking_events) ship.tracking_events = [];
    ship.tracking_events.push({
      event_time: new Date().toISOString(),
      location: "",
      description: `Status updated: ${oldLabel} → ${statusLabel(newStatus)}`,
    });
    write(SK, all);
    renderStats();
    renderShipments();
    flash(`${tn} → ${statusLabel(newStatus)}`);
  });

  // edit + delete
  byId("dashList").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    if (edit) {
      e.preventDefault();
      goToForm(edit.dataset.edit);
      return;
    }
    const del = e.target.closest("[data-del]");
    if (del && confirm(`Delete ${del.dataset.del}?`)) {
      write(
        SK,
        read(SK).filter((s) => s.tracking_number !== del.dataset.del),
      );
      renderStats();
      renderShipments();
    }
  });

  // filter
  byId("statusFilter").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    byId("statusFilter")
      .querySelectorAll("button")
      .forEach((b) => b.classList.toggle("active", b === btn));
    renderShipments();
  });

  /* ==================================================================
     ADD / EDIT SHIPMENT FORM
     ================================================================== */
  const form = byId("shipForm");
  const $ = (n) => form.querySelector(`[name="${n}"]`);
  const val = (n) => {
    const f = $(n);
    return f ? f.value.trim() : "";
  };
  const eventRows = byId("eventRows");
  const formTitle = byId("formTitle");
  const tnField = byId("tnField");
  let editingKey = null;

  function addEventRow(ev = {}) {
    const row = document.createElement("div");
    row.className = "ev-row";
    row.innerHTML = `
      <input type="datetime-local" class="ev-time" value="${toInput(ev.event_time)}" />
      <input type="text" class="ev-loc" placeholder="Location" value="${esc(ev.location || "")}" />
      <input type="text" class="ev-desc" placeholder="Description" value="${esc(ev.description || "")}" />
      <button type="button" class="ev-del" aria-label="Remove">✕</button>`;
    row.querySelector(".ev-del").addEventListener("click", () => row.remove());
    eventRows.appendChild(row);
  }
  byId("addEvent").addEventListener("click", () => addEventRow());

  function collectEvents() {
    return [...eventRows.querySelectorAll(".ev-row")]
      .map((r) => ({
        event_time:
          toISO(r.querySelector(".ev-time").value) || new Date().toISOString(),
        location: r.querySelector(".ev-loc").value.trim(),
        description: r.querySelector(".ev-desc").value.trim(),
      }))
      .filter((e) => e.description);
  }

  function fillForm(s) {
    [
      "tracking_number",
      "mode",
      "status",
      "origin_port",
      "destination_port",
      "shipper",
      "shipper_contact",
      "shipper_phone",
      "shipper_email",
      "consignee",
      "consignee_contact",
      "consignee_phone",
      "consignee_email",
      "vessel_name",
      "voyage_number",
      "container_number",
      "bill_of_lading",
      "commodity",
      "weight_kg",
      "pieces",
    ].forEach((n) => {
      if ($(n)) $(n).value = s[n] ?? "";
    });
    if ($("etd")) $("etd").value = toInput(s.etd);
    if ($("eta")) $("eta").value = toInput(s.eta);
    tnField.readOnly = true;
    eventRows.innerHTML = "";
    (s.tracking_events || [])
      .slice()
      .sort((a, b) => new Date(a.event_time) - new Date(b.event_time))
      .forEach(addEventRow);
    if (!(s.tracking_events || []).length) addEventRow();
  }

  function resetForm() {
    form.reset();
    tnField.value = "";
    tnField.readOnly = true;
    eventRows.innerHTML = "";
    addEventRow();
    editingKey = null;
    formTitle.textContent = "Create new shipment";
    byId("cancelEdit").style.display = "none";
  }

  function loadShipmentIntoForm(tn) {
    const s = read(SK).find((x) => x.tracking_number === tn);
    if (!s) return;
    fillForm(s);
    editingKey = s.tracking_number;
    formTitle.textContent = "Edit shipment — " + s.tracking_number;
    byId("cancelEdit").style.display = "";
  }

  byId("resetForm").addEventListener("click", resetForm);
  byId("cancelEdit").addEventListener("click", () => {
    resetForm();
    showSection("dashboard");
  });

  byId("loadSample").addEventListener("click", () => {
    const now = Date.now(),
      d = (n) => new Date(now + n * 864e5).toISOString();
    fillForm({
      tracking_number: generateTN(),
      mode: "ocean",
      status: "in_transit",
      origin_port: "Umm Qasr, IQ (IQUQR)",
      destination_port: "Chicago, US (USCHI)",
      shipper: "Erbil Textiles Ltd.",
      shipper_contact: "Ahmed Hassan",
      shipper_phone: "+964 750 123 4567",
      shipper_email: "ahmed@erbiltextiles.iq",
      consignee: "Midwest Apparel Co.",
      consignee_contact: "Sarah Johnson",
      consignee_phone: "+1 312 555 0199",
      consignee_email: "sarah@midwestapparel.com",
      vessel_name: "MV Test Runner",
      voyage_number: "V.001W",
      container_number: "FFLU1234567",
      bill_of_lading: "FFLTEST1001",
      commodity: "Cotton garments",
      weight_kg: 9200,
      pieces: 140,
      etd: d(-8),
      eta: d(20),
      tracking_events: [
        {
          event_time: d(-9),
          location: "Erbil, IQ",
          description: "Booking confirmed",
        },
        {
          event_time: d(-8),
          location: "Umm Qasr, IQ (IQUQR)",
          description: "Vessel departed port of loading",
        },
        {
          event_time: d(-2),
          location: "Jeddah, SA",
          description: "Transshipment — reloaded",
        },
      ],
    });
    editingKey = null;
    formTitle.textContent = "Create new shipment";
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!val("commodity")) {
      alert("Please enter the commodity.");
      return;
    }
    if (!val("shipper")) {
      alert("Please enter the sender company.");
      return;
    }
    if (!val("consignee")) {
      alert("Please enter the receiver company.");
      return;
    }

    let tn = val("tracking_number");
    if (!tn || !editingKey) tn = editingKey || generateTN();

    const rec = {
      tracking_number: tn,
      mode: val("mode"),
      status: val("status"),
      origin_port: val("origin_port"),
      destination_port: val("destination_port"),
      shipper: val("shipper"),
      shipper_contact: val("shipper_contact"),
      shipper_phone: val("shipper_phone"),
      shipper_email: val("shipper_email"),
      consignee: val("consignee"),
      consignee_contact: val("consignee_contact"),
      consignee_phone: val("consignee_phone"),
      consignee_email: val("consignee_email"),
      vessel_name: val("vessel_name"),
      voyage_number: val("voyage_number"),
      container_number: val("container_number") || null,
      bill_of_lading: val("bill_of_lading"),
      commodity: val("commodity"),
      weight_kg: val("weight_kg") ? Number(val("weight_kg")) : null,
      pieces: val("pieces") ? Number(val("pieces")) : null,
      etd: toISO($("etd").value),
      eta: toISO($("eta").value),
      tracking_events: collectEvents(),
      created_at: new Date().toISOString(),
    };

    let all = read(SK);
    const key = editingKey || tn;
    all = all.filter(
      (s) =>
        s.tracking_number.toLowerCase() !== key.toLowerCase() &&
        s.tracking_number.toLowerCase() !== tn.toLowerCase(),
    );
    all.unshift(rec);
    write(SK, all);
    resetForm();
    flash(`Saved ${tn}`);
    showSection("dashboard");
  });

  /* ==================================================================
     QUOTES
     ================================================================== */
  function renderQuotes() {
    const all = read(QK);
    if (!all.length) {
      byId("quoteList").innerHTML =
        `<p class="admin-empty">No quote requests yet.</p>`;
      return;
    }
    byId("quoteList").innerHTML = all
      .map(
        (q) => `
      <div class="admin-item">
        <div>
          <p class="admin-item-tn">${esc(q.reference || "—")}</p>
          <p class="admin-item-lane">${esc(q.origin || "Iraq")} → ${esc(q.destination || "—")} · ${esc(q.mode || "")}</p>
          <p class="admin-item-meta">${q.estimate_low ? "$" + q.estimate_low.toLocaleString() + "–$" + q.estimate_high.toLocaleString() : ""} · ${esc(q.name || "")} · ${esc(q.email || "")}</p>
        </div>
        <div class="admin-item-actions"><a href="mailto:${esc(q.email)}" class="ai-btn">Reply</a></div>
      </div>`,
      )
      .join("");
  }
  byId("clearQuotes").addEventListener("click", () => {
    if (confirm("Clear all quote requests?")) {
      write(QK, []);
      renderQuotes();
    }
  });

  /* ==================================================================
     INIT
     ================================================================== */
  resetForm();
  showSection("dashboard");
})();
