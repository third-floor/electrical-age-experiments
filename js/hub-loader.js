/**
 * hub-loader.js
 * ─────────────────────────────────────────────────────────────
 * Reads NAV_PANELS (defined in nav-config.js) and builds the
 * three-panel hub UI.  Toggle open/close on click.
 * ─────────────────────────────────────────────────────────────
 */

(function () {
  const container = document.getElementById("hub-panels");
  if (!container) return;

  // Guard: nav-config.js must be loaded first
  if (typeof NAV_PANELS === "undefined" || typeof BASE_URL === "undefined") {
    container.innerHTML =
      '<p style="color:red">Error: nav-config.js not loaded.</p>';
    return;
  }

  /**
   * Build one panel element from a panel config object.
   */
  function buildPanel(panelConfig, index) {
    const panel = document.createElement("div");
    panel.className = `panel panel-${index + 1}`;

    // ── Button
    const btn = document.createElement("button");
    btn.className = "panel-btn";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", `drawer-${panelConfig.id}`);

    btn.innerHTML = `
      <span class="panel-num">${panelConfig.label}</span>
      ${escapeHTML(panelConfig.title)}
      <span class="panel-arrow" aria-hidden="true">▾</span>
    `;

    // ── Drawer
    const drawer = document.createElement("div");
    drawer.className = "link-drawer";
    drawer.id = `drawer-${panelConfig.id}`;
    drawer.setAttribute("role", "region");

    const ul = document.createElement("ul");

    panelConfig.links.forEach(function (link) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = BASE_URL + link.href;

      let inner = `<span class="link-label">${escapeHTML(link.label)}</span>`;
      if (link.desc) {
        inner += `<span class="link-desc">${escapeHTML(link.desc)}</span>`;
      }
      a.innerHTML = inner;

      li.appendChild(a);
      ul.appendChild(li);
    });

    drawer.appendChild(ul);

    // ── Toggle behaviour
    btn.addEventListener("click", function () {
      const isOpen = panel.classList.contains("open");

      // Close all panels first
      document.querySelectorAll(".panel.open").forEach(function (p) {
        p.classList.remove("open");
        p.querySelector(".panel-btn").setAttribute("aria-expanded", "false");
      });

      // Open this one if it was previously closed
      if (!isOpen) {
        panel.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });

    panel.appendChild(btn);
    panel.appendChild(drawer);
    return panel;
  }

  // ── Render all panels
  NAV_PANELS.forEach(function (panelConfig, i) {
    container.appendChild(buildPanel(panelConfig, i));
  });

  /**
   * Minimal HTML escaper to avoid XSS from config strings.
   */
  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
