/**
 * nav.js — Shared navigation for the Electrical Age Journal site.
 * Drop <script src="js/nav.js"></script> into any page's <head> or <body>,
 * and replace your existing <header>…</header> with:
 *
 *   <header id="site-header"></header>
 *
 * The script will fill it in automatically and mark the current page active.
 */

(function () {
  const PAGES = [
    { href: "index.html",               label: "Home" },
    { href: "reports.html",             label: "Reports" },
    { href: "analysis.html",            label: "Analysis" },
    { href: "experiments.html",         label: "Experiments" },
    { href: "people.html",              label: "People" },
    { href: "persons_explorer.html",    label: "Persons Explorer" },
    { href: "person_network.html",      label: "Person Network" },
    { href: "locations.html",           label: "Locations" },
    { href: "locations_explorer.html",  label: "Location Explorer" },
    { href: "articles.html",            label: "Articles" },
    { href: "portraits.html",           label: "Portraits" },
    { href: "connections_explorer.html",label: "Connections" },
  ];

  /* ── Identify the current page ── */
  const currentFile = window.location.pathname.split("/").pop() || "index.html";

  /* ── Build nav links ── */
  const navLinks = PAGES.map(({ href, label }) => {
    const isCurrent = href === currentFile;
    return `<a href="${href}"${isCurrent ? ' class="nav-current" aria-current="page"' : ""}>${label}</a>`;
  }).join("\n        ");

  /* ── Inject styles (only once) ── */
  if (!document.getElementById("site-nav-styles")) {
    const style = document.createElement("style");
    style.id = "site-nav-styles";
    style.textContent = `
      /* ── Site header & nav injected by nav.js ── */
      #site-header {
        background: #2c2c2c;
        color: white;
        padding: 0;
        border-bottom: 4px solid #8b1a1a;
      }
      .site-header-inner {
        max-width: 1100px;
        margin: 0 auto;
        padding: 1.4rem 1.5rem 0;
      }
      .site-header-top {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 0.9rem;
      }
      .site-header-wordmark {
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 1.25rem;
        font-weight: 900;
        color: #fff;
        text-decoration: none;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }
      .site-header-wordmark:hover { color: #ddd; }

      /* ── Nav strip ── */
      .site-nav {
        border-top: 1px solid rgba(255,255,255,0.12);
        padding: 0;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
      }
      .site-nav::-webkit-scrollbar { display: none; }
      .site-nav-inner {
        display: flex;
        align-items: stretch;
        gap: 0;
        min-width: max-content;
      }
      .site-nav a {
        display: block;
        padding: 0.52rem 0.9rem;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.5);
        text-decoration: none;
        border-bottom: 3px solid transparent;
        transition: color 0.15s ease, border-color 0.15s ease,
                    background 0.15s ease;
        white-space: nowrap;
      }
      .site-nav a:hover {
        color: #fff;
        background: rgba(255,255,255,0.06);
        border-bottom-color: rgba(255,255,255,0.25);
      }
      .site-nav a.nav-current {
        color: #fff;
        border-bottom-color: #8b1a1a;
        background: rgba(255,255,255,0.04);
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Build & inject the header HTML ── */
  const target = document.getElementById("site-header");
  if (!target) return; // nothing to do if no placeholder found

  target.innerHTML = `
    <div class="site-header-inner">
      <div class="site-header-top">
        <a href="index.html" class="site-header-wordmark">Exploring the Electrical Age Journal</a>
      </div>
    </div>
    <nav class="site-nav" aria-label="Site navigation">
      <div class="site-nav-inner">
        ${navLinks}
      </div>
    </nav>
  `;
})();
