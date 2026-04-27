/**
 * nav-config.js
 * ─────────────────────────────────────────────────────────────
 * Edit this file to add, remove, or rename pages in the hub.
 *
 * Each panel has:
 *   id       – unique string (used as a CSS class, keep it simple)
 *   label    – small label shown above the title (e.g. "01")
 *   title    – big text on the button
 *   links    – array of page objects (see structure below)
 *
 * Each link object has:
 *   href     – filename, e.g. "people.html"  (base URL is added automatically)
 *   label    – bold link text shown in the drawer
 *   desc     – (optional) small grey description line
 * ─────────────────────────────────────────────────────────────
 */

const BASE_URL = "https://third-floor.github.io/electrical-age-experiments/";

const NAV_PANELS = [
  {
    id: "panel-1",
    label: "01",
    title: "Index & Guides",
    links: [
      {
        href: "people.html",
        label: "People",
        desc: "Individual profiles and biographical entries"
      },
      {
        href: "locations.html",
        label: "Locations",
        desc: "Places, sites, and geographical records"
      },
      {
        href: "articles.html",
        label: "Articles",
        desc: "Written pieces and reference texts"
      },
      // ── Add more links here, e.g.:
      // { href: "timeline.html", label: "Timeline", desc: "Chronological overview" },
    ]
  },

  {
    id: "panel-2",
    label: "02",
    title: "Explorers & Analysis",
    links: [
      {
        href: "persons_explorer.html",
        label: "Persons Explorer",
        desc: "Browse and filter the persons database"
      },
      {
        href: "person_network.html",
        label: "Person Network",
        desc: "Relationship graphs between individuals"
      },
      {
        href: "locations_explorer.html",
        label: "Locations Explorer",
        desc: "Interactive map and location browser"
      },
      {
        href: "connections_explorer.html",
        label: "Connections Explorer",
        desc: "Cross-entity link visualisation"
      },
      {
        href: "analysis.html",
        label: "Analysis",
        desc: "Statistical summaries and findings"
      },
      {
        href: "reports.html",
        label: "Reports",
        desc: "Field reports and development logs"
      },
      // ── Add more links here, e.g.:
      // { href: "search.html", label: "Search", desc: "Full-text search across all records" },
    ]
  },

  {
    id: "panel-3",
    label: "03",
    title: "Experiments",
    links: [
      {
        href: "experiments.html",
        label: "Experiments",
        desc: "Active and archived experiment logs"
      },
      {
        href: "portraits.html",
        label: "Portraits",
        desc: "AI-generated and sourced portrait gallery"
      },
      // ── Add more links here, e.g.:
      // { href: "sandbox.html", label: "Sandbox", desc: "Freeform testing area" },
    ]
  }
];
