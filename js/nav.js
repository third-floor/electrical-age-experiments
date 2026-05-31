/**
 * nav.js — Shared navigation for the Electrical Age Journal site.
 * Add <script src="js/nav.js"></script> to <head> or <body>.
 *
 * Two modes:
 *   A) <header id="site-header"></header>   (empty)
 *      → Full header injected: dark background + wordmark + nav strip.
 *        Use on all pages except index.html.
 *
 *   B) <header id="site-header"> ...content... </header>  (has children)
 *      → Nav strip APPENDED only. Header background/border left to the
 *        page's own CSS. Use on index.html.
 */

function injectSiteNav() {
  const GROUPS = [
    { label: "Home", href: "index.html" },
    {
      label: "Search",
      pages: [
        { href: "people.html",    label: "People" },
        { href: "locations.html", label: "Locations" },
        { href: "articles.html",  label: "Articles" },
      ],
    },
    {
      label: "Explorers",
      pages: [
        { href: "persons_explorer.html",     label: "Persons Explorer" },
        { href: "person_network.html",       label: "Person Network" },
        { href: "locations_explorer.html",   label: "Location Explorer" },
        { href: "connections_explorer.html", label: "Connections Explorer" },
      ],
    },
    {
      label: "Reports",
      pages: [
        { href: "reports.html",  label: "Reports" },
        { href: "analysis.html", label: "Analysis" },
      ],
    },
    {
      label: "Experiments",
      pages: [
        { href: "experiments.html", label: "Experiments" },
        { href: "portraits.html",   label: "Portraits" },
      ],
    },
  ];

  const currentFile = window.location.pathname.split("/").pop() || "index.html";

  /* ── Styles ── */
  if (!document.getElementById("site-nav-styles")) {
    const style = document.createElement("style");
    style.id = "site-nav-styles";
    style.textContent = `
      /* Applied in Mode A (full injection) only — gives non-index pages their header */
      #site-header.nav-full {
        background: #2c2c2c;
        color: white;
        padding: 0;
        border-bottom: 4px solid #8b1a1a;
        position: relative;
        z-index: 1000;
      }
      .site-header-inner {
        max-width: 1100px;
        margin: 0 auto;
        padding: 1.4rem 1.5rem 0;
      }
      .site-header-wordmark {
        display: inline-block;
        font-family: 'Playfair Display', Georgia, serif;
        font-size: 1.25rem;
        font-weight: 900;
        color: #fff;
        text-decoration: none;
        letter-spacing: 0.01em;
        margin-bottom: 0.9rem;
      }
      .site-header-wordmark:hover { color: #ddd; }

      /* Nav strip — shared by both modes */
      .site-nav {
        border-top: 1px solid rgba(255,255,255,0.12);
        padding: 0;
        position: relative;
        z-index: 1000;
      }
      .site-nav-inner {
        display: flex;
        align-items: stretch;
        gap: 0;
      }

      /* Plain home link */
      .site-nav .nav-home {
        display: block;
        padding: 0.52rem 0.9rem;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.5);
        text-decoration: none;
        border-bottom: 3px solid transparent;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
        white-space: nowrap;
      }
      .site-nav .nav-home:hover {
        color: #fff;
        background: rgba(255,255,255,0.06);
        border-bottom-color: rgba(255,255,255,0.25);
      }
      .site-nav .nav-home.nav-current {
        color: #fff;
        border-bottom-color: #8b1a1a;
        background: rgba(255,255,255,0.04);
      }

      /* Dropdown wrapper */
      .nav-dropdown { position: relative; }

      /* Dropdown trigger */
      .nav-dropdown-btn {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.52rem 0.9rem;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.5);
        background: none;
        border: none;
        border-bottom: 3px solid transparent;
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s, background 0.15s;
        white-space: nowrap;
        height: 100%;
      }
      .nav-dropdown-btn:hover,
      .nav-dropdown.open .nav-dropdown-btn {
        color: #fff;
        background: rgba(255,255,255,0.06);
        border-bottom-color: rgba(255,255,255,0.25);
      }
      .nav-dropdown.has-current .nav-dropdown-btn {
        color: #fff;
        border-bottom-color: #8b1a1a;
        background: rgba(255,255,255,0.04);
      }
      .nav-dropdown-caret {
        font-size: 0.55rem;
        opacity: 0.6;
        transition: transform 0.2s ease;
        display: inline-block;
      }
      .nav-dropdown.open .nav-dropdown-caret { transform: rotate(180deg); }

      /* Dropdown panel */
      .nav-dropdown-panel {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        min-width: 180px;
        background: #1e1e1e;
        border: 1px solid rgba(255,255,255,0.1);
        border-top: 2px solid #8b1a1a;
        box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        z-index: 2000;
      }
      .nav-dropdown.open .nav-dropdown-panel { display: block; }
      .nav-dropdown-panel a {
        display: block;
        padding: 0.55rem 1rem;
        font-family: 'Courier Prime', 'Courier New', monospace;
        font-size: 0.72rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.55);
        text-decoration: none;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        transition: color 0.15s, background 0.15s, padding-left 0.15s;
      }
      .nav-dropdown-panel a:last-child { border-bottom: none; }
      .nav-dropdown-panel a:hover {
        color: #fff;
        background: rgba(255,255,255,0.07);
        padding-left: 1.3rem;
      }
      .nav-dropdown-panel a.nav-current {
        color: #fff;
        background: rgba(139,26,26,0.25);
        border-left: 3px solid #8b1a1a;
        padding-left: 0.75rem;
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Build nav items ── */
  const items = GROUPS.map(group => {
    if (group.href) {
      const isCurrent = group.href === currentFile;
      return `<a href="${group.href}" class="nav-home${isCurrent ? ' nav-current' : ''}"${isCurrent ? ' aria-current="page"' : ''}>${group.label}</a>`;
    }
    const hasCurrentChild = group.pages.some(p => p.href === currentFile);
    const links = group.pages.map(p => {
      const isCurrent = p.href === currentFile;
      return `<a href="${p.href}"${isCurrent ? ' class="nav-current" aria-current="page"' : ''}>${p.label}</a>`;
    }).join("");
    return `
      <div class="nav-dropdown${hasCurrentChild ? ' has-current' : ''}">
        <button class="nav-dropdown-btn" aria-haspopup="true" aria-expanded="false">
          ${group.label}<span class="nav-dropdown-caret">▼</span>
        </button>
        <div class="nav-dropdown-panel">${links}</div>
      </div>`;
  }).join("");

  const navHTML = `
    <nav class="site-nav" aria-label="Site navigation">
      <div class="site-nav-inner">${items}</div>
    </nav>`;

  /* ── Inject ── */
  const target = document.getElementById("site-header");
  if (!target) return;

  if (target.children.length === 0) {
    /* Mode A: empty — full injection, add class for background styles */
    target.classList.add("nav-full");
    target.innerHTML = `
      <div class="site-header-inner">
        <a href="index.html" class="site-header-wordmark">Exploring the Electrical Age Journal</a>
      </div>
      ${navHTML}`;
  } else {
    /* Mode B: has content (index.html) — append nav strip only, leave bg alone */
    target.insertAdjacentHTML("beforeend", navHTML);
  }

  /* ── Dropdown logic ── */
  target.querySelectorAll(".nav-dropdown").forEach(dropdown => {
    const btn = dropdown.querySelector(".nav-dropdown-btn");
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("open");
      target.querySelectorAll(".nav-dropdown.open").forEach(d => {
        d.classList.remove("open");
        d.querySelector(".nav-dropdown-btn").setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        dropdown.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.addEventListener("click", () => {
    target.querySelectorAll(".nav-dropdown.open").forEach(d => {
      d.classList.remove("open");
      d.querySelector(".nav-dropdown-btn").setAttribute("aria-expanded", "false");
    });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectSiteNav);
} else {
  injectSiteNav();
}
