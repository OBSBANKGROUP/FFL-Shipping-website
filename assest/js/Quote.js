/* =====================================================================
   Fast Forward Logistics — quote request + instant estimate
   Attaches to #quoteForm on quote.html.
   ===================================================================== */
(() => {
  "use strict";
  const form = document.getElementById("quoteForm");
  if (!form) return;

  const cfg = window.FFL_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.startsWith("YOUR_") &&
    !cfg.SUPABASE_ANON_KEY.startsWith("YOUR_");
  const supabase =
    configured && window.supabase
      ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
      : null;

  const $ = (name) => form.querySelector(`[name="${name}"]`);
  const val = (name) => {
    const f = $(name);
    return f ? f.value.trim() : "";
  };
  const errorBox = document.getElementById("qError");
  const resultBox = document.getElementById("qResult");
  const KIND = form.dataset.kind || "quote"; // "contact" forms skip the price estimate

  /* ---------- indicative rate model (USD) ----------
     Rough starting points for Iraq-origin freight. Real quotes depend on
     carrier, season, fuel and exact addresses — these are estimates only. */
  const RATES = {
    air: {
      perKg: 4.2,
      min: 180,
      region: { usa: 1.25, europe: 1.0, other: 1.45 },
      transit: { usa: [4, 7], europe: [2, 4], other: [5, 9] },
    },
    ocean_fcl: {
      flat: { usa: 2600, europe: 1950, other: 3200 },
      transit: { usa: [26, 38], europe: [16, 26], other: [30, 45] },
    },
    ocean_lcl: {
      perKg: 0.55,
      min: 240,
      region: { usa: 1.2, europe: 1.0, other: 1.4 },
      transit: { usa: [28, 40], europe: [18, 28], other: [32, 48] },
    },
    road: {
      perKg: 1.4,
      min: 260,
      region: { usa: 2.2, europe: 1.0, other: 1.6 },
      transit: { usa: [30, 45], europe: [8, 16], other: [12, 22] },
    },
  };
  const MODE_LABEL = {
    air: "Air freight",
    ocean_fcl: "Ocean — FCL",
    ocean_lcl: "Ocean — LCL",
    road: "Road / rail",
  };
  const REGION_LABEL = {
    usa: "United States",
    europe: "Europe",
    other: "Other / worldwide",
  };

  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const ref = () =>
    "FFLQ-" +
    (Date.now().toString(36) + Math.random().toString(36).slice(2, 5))
      .toUpperCase()
      .slice(-7);

  function estimate({ mode, region, weight, volume }) {
    const r = RATES[mode];
    const w = Math.max(Number(weight) || 0, 1);
    let base;
    if (mode === "ocean_fcl") {
      base = r.flat[region];
    } else {
      // air uses chargeable weight (volumetric 167 kg/m³) when volume is given
      let chargeable = w;
      if (mode === "air" && volume)
        chargeable = Math.max(w, Number(volume) * 167);
      base = Math.max(r.min, chargeable * r.perKg) * r.region[region];
    }
    base *= 1.12; // handling + fuel surcharge
    const low = base * 0.85,
      high = base * 1.18;
    const [tLo, tHi] = r.transit[region];
    return { low, high, tLo, tHi, chargeable: mode === "ocean_fcl" ? null : w };
  }

  function fail(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove("hidden");
    errorBox.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");

    const data = {
      mode: val("mode"),
      region: val("region"),
      origin: val("origin"),
      destination: val("destination"),
      weight: val("weight"),
      volume: val("volume"),
      commodity: val("commodity"),
      ready_date: val("ready_date"),
      name: val("name"),
      company: val("company"),
      email: val("email"),
      phone: val("phone"),
      notes: val("notes"),
    };

    /* ---------- contact form: log enquiry, no estimate ---------- */
    if (KIND === "contact") {
      if (!data.name) return fail("Please enter your name.");
      if (!emailOk(data.email))
        return fail("Please enter a valid email address.");
      if (!data.destination)
        return fail("Please add a subject or destination.");
      const rec = {
        reference: "FFLC-" + Date.now().toString(36).toUpperCase().slice(-6),
        kind: "contact",
        name: data.name,
        company: data.company,
        email: data.email,
        phone: data.phone,
        destination: data.destination,
        notes: data.notes,
        created_at: new Date().toISOString(),
      };
      try {
        const all = JSON.parse(localStorage.getItem("ffl_quotes") || "[]");
        all.unshift(rec);
        localStorage.setItem("ffl_quotes", JSON.stringify(all));
      } catch (_) {}
      if (supabase) {
        try {
          await supabase.from("quotes").insert([rec]);
        } catch (_) {}
      }
      resultBox.innerHTML = `<div class="q-estimate"><div class="q-est-head"><div>
        <p class="q-est-eyebrow">Message sent</p>
        <p class="q-est-price" style="font-size:26px">Thanks, ${data.name.split(" ")[0]}!</p>
        <p class="q-est-note">We've received your message and will reply to ${data.email} within one business day.</p>
      </div><div class="q-est-ref"><span>Reference</span><strong>${rec.reference}</strong></div></div></div>`;
      resultBox.classList.remove("hidden");
      resultBox.scrollIntoView({ block: "start", behavior: "smooth" });
      form.reset();
      return;
    }

    /* ---------- quote form: validate + estimate ---------- */
    if (!data.mode) return fail("Please choose a freight mode.");
    if (!data.region) return fail("Please choose a destination region.");
    if (!data.destination) return fail("Please enter a destination.");
    if (!data.weight || Number(data.weight) <= 0)
      return fail("Please enter the cargo weight in kilograms.");
    if (!data.name) return fail("Please enter your name.");
    if (!emailOk(data.email))
      return fail("Please enter a valid email address.");

    const est = estimate(data);
    const reference = ref();
    const record = {
      reference,
      ...data,
      created_at: new Date().toISOString(),
      estimate_low: Math.round(est.low),
      estimate_high: Math.round(est.high),
    };

    // save locally (shows up on the Admin page)
    try {
      const all = JSON.parse(localStorage.getItem("ffl_quotes") || "[]");
      all.unshift(record);
      localStorage.setItem("ffl_quotes", JSON.stringify(all));
    } catch (_) {}

    // save to Supabase if connected (best effort)
    if (supabase) {
      try {
        await supabase.from("quotes").insert([record]);
      } catch (err) {
        console.warn("Supabase quote insert failed:", err && err.message);
      }
    }

    // show the estimate
    resultBox.innerHTML = `
      <div class="q-estimate">
        <div class="q-est-head">
          <div>
            <p class="q-est-eyebrow">Indicative estimate</p>
            <p class="q-est-price">${money(est.low)} – ${money(est.high)}</p>
            <p class="q-est-note">Non-binding · a firm all-in quote follows by email within one business day.</p>
          </div>
          <div class="q-est-ref"><span>Reference</span><strong>${reference}</strong></div>
        </div>
        <dl class="q-est-facts">
          <div><dt>Lane</dt><dd>${data.origin || "Iraq"} → ${data.destination}</dd></div>
          <div><dt>Region</dt><dd>${REGION_LABEL[data.region]}</dd></div>
          <div><dt>Mode</dt><dd>${MODE_LABEL[data.mode]}</dd></div>
          <div><dt>Weight</dt><dd>${Number(data.weight).toLocaleString()} kg</dd></div>
          <div><dt>Est. transit</dt><dd>${est.tLo}–${est.tHi} days</dd></div>
          <div><dt>Requested by</dt><dd>${data.name}${data.company ? ", " + data.company : ""}</dd></div>
        </dl>
        <p class="q-est-thanks">Thanks, ${data.name.split(" ")[0]} — we've logged your request. Our team will email <strong>${data.email}</strong> shortly.</p>
      </div>`;
    resultBox.classList.remove("hidden");
    resultBox.scrollIntoView({ block: "start", behavior: "smooth" });
    form.reset();
  });
})();
