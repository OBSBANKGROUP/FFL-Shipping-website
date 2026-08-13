/* =====================================================================
   Fast Forward Logistics — shared layout + site interactions
   • On pages with an EMPTY <header id="topbar"> / <footer id="siteFooter">,
     this builds the shared header & footer from SITE below.
   • On pages that already have their own header/footer markup (e.g. the
     home page), it leaves them exactly as they are.
   ===================================================================== */
(() => {
  "use strict";

  /* =====================================================================
     SITE SETTINGS  —  edit these
     ---------------------------------------------------------------------
     ▸ TO ADD YOUR LOGO: set `logo` to your image path, e.g.
         logo: "assest/images/logo.png"
       It replaces the icon mark on EVERY page (including the home page).
       Leave it as "" to keep the built-in icon + text mark.
     ===================================================================== */
  const SITE = {
    name: "Fast Forward Logistics",
    logo: "assest/images/logo.jpeg", // e.g. "assest/images/logo.png"
    logoAlt: "Fast Forward Logistics",
    phone: "+1 (943) 210 8427",
    email: "support@fastforwardlogistics.express",
    address: "Empire Business Tower, T3, 2nd Floor, Office #5, Erbil, Iraq",
    hoursNote: "Sun–Thu, 8:00–18:00 (AST)",
    nav: [
      { label: "Home", href: "index.html", key: "home" },
      { label: "Services", href: "services.html", key: "services" },
      { label: "Track", href: "tracking.html", key: "tracking" },
      { label: "About", href: "About.html", key: "about" },
      { label: "Contact", href: "contact.html", key: "contact" },
    ],
    quoteHref: "quote.html",
  };
  window.SITE = SITE;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const page = document.body.dataset.page || "";

  const brandMark = SITE.logo
    ? `<img src="${SITE.logo}" alt="${SITE.logoAlt}" class="brand-logo" />`
    : `<span class="brand-mark" aria-hidden="true">
         <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
           <path d="M3 15h13l4-4v4M3 15v3h18v-3M3 15l2-6h9l3 6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
           <circle cx="7" cy="19" r="1.4" fill="currentColor"/><circle cx="17" cy="19" r="1.4" fill="currentColor"/>
         </svg>
       </span>`;

  /* ---------- header (inject only when empty) ---------- */
  const header = document.getElementById("topbar");
  if (header && header.children.length === 0) {
    const links = SITE.nav
      .map(
        (n) =>
          `<a href="${n.href}"${n.key === page ? ' class="active"' : ""}>${n.label}</a>`,
      )
      .join("");
    header.innerHTML = `
      <a class="brand" href="index.html">${brandMark}</a>
      <nav class="topnav" id="topnav">${links}
        <a href="${SITE.quoteHref}" class="nav-cta${page === "quote" ? " active" : ""}">Get a quote</a></nav>
      <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>`;
  }

  /* ---------- footer (inject only when the container exists & is empty) ---------- */
  const footer = document.getElementById("siteFooter");
  if (footer && footer.children.length === 0) {
    footer.innerHTML = `
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="brand" href="index.html">${brandMark}</a>
          <p>We provide you with up-to-date information on the latest trends in the industry, technical advances, legislative changes and new security products and services concerning shipping — using air, sea and land transportation to satisfy our customers worldwide.</p>
        </div>
        <div class="footer-col"><h4>Services</h4>
          <a href="svc-ocean.html">Ocean freight</a><a href="svc-air.html">Air freight</a>
          <a href="svc-road.html">Road &amp; rail</a><a href="svc-warehouse.html">Warehousing</a>
          <a href="svc-door.html">Door to door</a><a href="svc-project.html">Project cargo</a></div>
        <div class="footer-col"><h4>Company</h4>
          <a href="about.html">About us</a><a href="tracking.html">Track a shipment</a>
          <a href="quote.html">Get a quote</a><a href="contact.html">Contact</a></div>
        <div class="footer-col"><h4>Get in touch</h4>
          <a href="mailto:${SITE.email}">${SITE.email}</a>
          <a href="tel:+19432108427">${SITE.phone}</a>
          <span style="margin-top:8px;display:block"><strong style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;opacity:.6">Iraq — Head Office</strong><br/>Empire Business Tower, T3, 2nd Floor, Office #5,<br/>Erbil, Iraq</span>
          <span style="margin-top:10px;display:block"><strong style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;opacity:.6">UAE — Dubai</strong><br/>Business Center 1, M Floor, The Meydan Hotel,<br/>Nad Al Sheba, Dubai</span>
          <span style="margin-top:10px;display:block"><strong style="font-size:11px;text-transform:uppercase;letter-spacing:.5px;opacity:.6">Turkey — Istanbul</strong><br/>Maltepe Parima Plaza No:8 Kapı 123,<br/>Zeytinburnu / İstanbul</span>
        </div>
      </div>
      <div class="footer-bar">
        <span class="mode-badge" id="dataMode" style="display:none"></span>
        <span>2009–<span id="year"></span> Fast Forward Logistics. All rights reserved. Handcrafted by Quakevision</span>
      </div>`;
  }

  /* ---------- logo swap for pre-existing (inline) headers/footers ---------- */
  if (SITE.logo) {
    document.querySelectorAll(".brand-mark").forEach((m) => {
      const img = document.createElement("img");
      img.src = SITE.logo;
      img.alt = SITE.logoAlt;
      img.className = "brand-logo";
      m.replaceWith(img);
    });
  }

  /* ---------- year ---------- */
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
  /* hide any demo badges */
  document
    .querySelectorAll(".mode-badge, #dataMode")
    .forEach((el) => (el.style.display = "none"));

  /* ---------- sticky nav ---------- */
  const bar = document.getElementById("topbar");
  if (bar) {
    const onScroll = () =>
      bar.classList.toggle("scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------- mobile nav toggle ---------- */
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("topnav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", (e) => {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- simple quote form (home page CTA) ----------
     Only handles a basic form that does NOT have the rich #qResult panel
     (that richer form is owned by quote.js on the Quote/Contact pages). */
  const qform = document.getElementById("quoteForm");
  if (qform && !document.getElementById("qResult")) {
    qform.addEventListener("submit", (e) => {
      e.preventDefault();
      const note = document.getElementById("qfNote");
      if (note) {
        note.textContent =
          "Thanks — your request is in. We'll email your quote within one business day.";
        note.classList.add("qf-ok");
      }
      qform.reset();
    });
  }

  /* ---------- reveal on scroll ---------- */
  const reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    reveals.forEach((el) => io.observe(el));
  }

  /* ---------- count-up ---------- */
  const counters = document.querySelectorAll("[data-count]");
  const runCount = (el) => {
    const target = parseFloat(el.dataset.count),
      suffix = el.dataset.suffix || "";
    const decimals = (String(el.dataset.count).split(".")[1] || "").length;
    if (reduce) {
      el.textContent = target.toFixed(decimals) + suffix;
      return;
    }
    const dur = 1400,
      start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1),
        eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toFixed(decimals) + suffix;
    };
    requestAnimationFrame(tick);
  };
  if ("IntersectionObserver" in window) {
    const cio = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            runCount(en.target);
            cio.unobserve(en.target);
          }
        }),
      { threshold: 0.6 },
    );
    counters.forEach((el) => cio.observe(el));
  } else counters.forEach(runCount);

  /* ---------- hero parallax (home) ---------- */
  const heroMedia = document.getElementById("heroMedia");
  if (heroMedia && !reduce && window.innerWidth > 640) {
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const y = Math.min(window.scrollY, 900);
          heroMedia.style.transform = `translateY(${y * 0.18}px) scale(1.05)`;
          ticking = false;
        });
      },
      { passive: true },
    );
  }
})();
