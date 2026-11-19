import "../styles/nexus-site.css";
import { validateRateTable } from "./security";

type SiteRoute = "overview" | "engine" | "cost-model" | "revit" | "workspace";
interface SiteActions { loadDemo: () => Promise<void>; openRates: () => void }
const routes: SiteRoute[] = ["overview", "engine", "cost-model", "revit", "workspace"];
const routeNames: Record<SiteRoute, string> = {
  overview: "Overview", engine: "Engine", "cost-model": "Cost Model", revit: "Revit Bridge", workspace: "Workspace",
};
const defaultPairs = [
  { name: "Structure × MEP", code: "03-23-01", low: 2500, high: 14000 },
  { name: "Structure × Structure", code: "03-30-00", low: 500, high: 3000 },
  { name: "MEP × MEP", code: "23-05-93", low: 700, high: 4500 },
  { name: "Architecture × MEP", code: "07-84-13", low: 1200, high: 6500 },
  { name: "Architecture × Structure", code: "03-30-00", low: 900, high: 5500 },
];
function currentPairs(): typeof defaultPairs {
  try {
    const saved = validateRateTable(JSON.parse(localStorage.getItem("aecNexus.settings.v1") ?? "null"));
    return defaultPairs.map((pair) => ({ ...pair, ...saved.bands[pair.name as keyof typeof saved.bands] }));
  } catch { return defaultPairs; }
}
const format = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
const mark = `<svg class="nx-site-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 27 14.2 5.5c.7-1.5 2.9-1.5 3.6 0L28 27M9 18h14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function routeFromHash(): SiteRoute {
  const value = location.hash.replace(/^#\/?/, "").split("?")[0];
  if (value === "workspace") return "workspace";
  return routes.includes(value as SiteRoute) ? value as SiteRoute : "overview";
}

export function setupNexusSite(actions: SiteActions): void {
  const root = document.createElement("div");
  root.id = "nx-site";
  document.body.append(root);

  const navigate = (route: SiteRoute, replace = false) => {
    const hash = `#/${route === "overview" ? "" : route}`;
    if (location.hash !== hash) history[replace ? "replaceState" : "pushState"]({}, "", `${location.pathname}${location.search}${hash}`);
    render(route);
  };
  const anchor = (route: SiteRoute, label: string, cls = "") => `<a class="${cls}" href="#/${route === "overview" ? "" : route}" data-route="${route}">${label}</a>`;
  const button = (route: SiteRoute, label: string, cls = "") => `<a class="nx-site-button ${cls}" href="#/${route === "overview" ? "" : route}" data-route="${route}">${label}</a>`;
  const nav = (active: SiteRoute) => `<header class="nx-site-nav"><div class="nx-site-nav-inner"><a class="nx-site-brand" href="#/" data-route="overview">${mark}<span>AEC NEXUS</span></a><nav aria-label="Main navigation">${(["overview", "engine", "cost-model", "revit"] as SiteRoute[]).map((route) => anchor(route, routeNames[route], active === route ? "is-active" : "")).join("")}</nav><div class="nx-site-nav-actions">${button("workspace", "Workspace", "nx-button-secondary")}${button("workspace", "Run Live Demo", "nx-button-primary")}</div><button class="nx-mobile-menu" aria-label="Open menu" type="button">Menu</button></div></header>`;
  const footer = () => `<footer class="nx-site-footer"><div class="nx-site-container nx-footer-inner"><a class="nx-site-brand" href="#/" data-route="overview">${mark}<span>AEC NEXUS</span></a><p>Models stay in your browser memory. Zero server upload.</p><p>MIT License</p></div></footer>`;
  const shell = (route: SiteRoute, content: string) => `${nav(route)}<main class="nx-site-main">${content}</main>${footer()}`;
  const title = (eyebrow: string, heading: string, copy: string) => `<section class="nx-page-intro"><p class="nx-eyebrow">${eyebrow}</p><h1>${heading}</h1><p>${copy}</p></section>`;

  const overview = () => shell("overview", `
    <section class="nx-hero nx-site-container"><div class="nx-hero-copy"><p class="nx-eyebrow">PRE-CONSTRUCTION FINANCIAL TRIAGE</p><h1>Price BIM clashes before concrete is poured.</h1><p class="nx-hero-lede">Load multi-discipline IFC models in your browser. Detect 3D intersections, map trade cost codes, and export executive cash-leak audits in seconds.</p><div class="nx-hero-actions">${button("workspace", "Run Live Demo", "nx-button-primary nx-button-large")}${button("workspace", "Launch Empty Workspace", "nx-button-secondary nx-button-large")}</div><p class="nx-hero-note">Client-side IFC analysis · Editable estimate bands · XLSX and PDF reports</p></div><div class="nx-hero-visual"><div class="nx-preview-top"><span>PROJECT / FEDERATED MODEL</span><span>LOCAL SESSION</span></div><div class="nx-preview-total"><span>ESTIMATED CASH LEAK <b>ESTIMATE</b></span><strong>$18,600 <i>–</i> $89,500</strong><small>Editable benchmark estimate range</small></div><div class="nx-preview-clash"><span class="nx-preview-dot"></span><div><strong>Structure × MEP</strong><small>Beam / HVAC duct · Hard intersect</small></div><code>03-23-01</code></div><div class="nx-preview-chart"><span>01</span><span>02</span><span>03</span><span>04</span><span>05</span><span>06</span><span>07</span><span>08</span></div><div class="nx-preview-bottom"><span>8 OPEN CLASHES</span><span>BVH TOLERANCE 0.005 M</span></div></div></section>
    <section class="nx-proof-band"><div class="nx-site-container nx-proof-grid"><div><strong>0.005m</strong><span>BVH tolerance</span></div><div><strong>100%</strong><span>Client-side IFC</span></div><div><strong>4 rules</strong><span>Deterministic severity factors</span></div><div><strong>XLSX + PDF</strong><span>Audit exports</span></div></div></section>
    <section class="nx-section nx-site-container"><div class="nx-section-head"><div><p class="nx-eyebrow">THE WORKFLOW</p><h2>From model federation to a priced action list.</h2></div>${anchor("engine", "Explore the engine →", "nx-inline-link")}</div><div class="nx-bento"><a class="nx-bento-card nx-bento-feature" href="#/engine" data-route="engine"><span class="nx-card-index">01 / ANALYSIS ENGINE</span><h3>One coordinated model.<br>One ranked clash register.</h3><p>Federate disciplines, detect spatial conflicts, and focus each issue in the 3D viewport.</p><span class="nx-card-visual nx-wireframe">STR <i>×</i> MEP</span></a><a class="nx-bento-card nx-bento-tall" href="#/cost-model" data-route="cost-model"><span class="nx-card-index">02 / COST MODEL</span><h3>Clear assumptions.<br>Editable estimate bands.</h3><p>See how clash type and trade rates shape each low–high range.</p><div class="nx-mini-rates"><span>Hard intersect <b>1.00×</b></span><span>Duplicate <b>0.70×</b></span><span>Touching <b>0.55×</b></span><span>Clearance <b>0.30×</b></span></div></a><a class="nx-bento-card nx-bento-wide" href="#/revit" data-route="revit"><span class="nx-card-index">03 / DROP-IN WORKFLOW</span><h3>Revit to IFC, then straight into Nexus.</h3><p>Drop one or more IFC files today. The planned Revit add-in and APS connector are documented for a future direct handoff.</p><span class="nx-arrow-link">See the Revit bridge →</span></a></div></section>
    <section class="nx-dark-band"><div class="nx-site-container nx-dark-inner"><div><p class="nx-eyebrow">BUILT FOR PRE-CONSTRUCTION TEAMS</p><h2>Make coordination risk visible before it reaches the site.</h2></div>${button("workspace", "Open the workspace", "nx-button-light")}</div></section>`);

  const engine = () => shell("engine", `${title("THE ANALYSIS ENGINE", "A traceable path from IFC geometry to a focused clash.", "AEC Nexus combines local model loading, geometric checks, discipline classification, and an editable cost estimate. Each stage feeds the next.")}
    <section class="nx-site-container nx-engine-layout"><div class="nx-engine-list"><article><span>01</span><div><h2>Federate the IFC models</h2><p>Load multiple IFC files in the browser. The workspace keeps model geometry in the local session.</p><small>WEBIFC · MULTI-MODEL VIEW</small></div></article><article><span>02</span><div><h2>Check spatial relationships</h2><p>The clash engine checks element geometry and classifies hard intersections, duplicates, touching cases, and clearance cases.</p><small>BVH · 0.005M TOLERANCE</small></div></article><article><span>03</span><div><h2>Rank and focus the issue</h2><p>Discipline pairs and severity set the triage order. Select a row to focus both elements in the 3D viewport.</p><small>CLASH REGISTER · 3D CAMERA FOCUS</small></div></article><article><span>04</span><div><h2>Price and export</h2><p>Editable low and high rate bands produce a range for each open clash. Export the register to Excel or print it to PDF.</p><small>EDITABLE ESTIMATES · XLSX · PDF</small></div></article></div><aside class="nx-engine-aside"><p class="nx-eyebrow">IN THE WORKSPACE</p><div class="nx-engine-screen"><div class="nx-screen-bar"><i></i><i></i><i></i><span>CLASH TRIAGE</span></div><div class="nx-screen-model"><span>STR</span><span>MEP</span><b>×</b></div><div class="nx-screen-row"><span>HIGH</span><strong>Structure × MEP</strong><code>$2,500 – $14,000</code></div><div class="nx-screen-row"><span>MED</span><strong>MEP × MEP</strong><code>$700 – $4,500</code></div></div><p>Estimates use the rates in the workspace. You can edit them at any time.</p>${button("workspace", "Launch workspace", "nx-button-primary")}</aside></section>
    <section class="nx-site-container nx-engine-note"><strong>Review each estimate.</strong><span>These values are editable benchmark estimates. They are not a construction quote or a substitute for coordination review.</span></section>`);

  const costModel = () => shell("cost-model", `${title("TRANSPARENT COST LOGIC", "An estimate you can inspect, change, and explain.", "AEC Nexus applies a fixed factor to editable trade rate bands. The result is a low–high range for each open clash.")}
    <section class="nx-site-container nx-cost-page-grid"><div class="nx-cost-main"><div class="nx-table-card"><div class="nx-table-title"><div><p class="nx-eyebrow">CLASH TYPE FACTORS</p><h2>Deterministic multipliers</h2></div><span class="nx-status-label">CURRENT ENGINE RULES</span></div><table class="nx-site-table"><thead><tr><th>Clash type</th><th>Factor</th><th>Applied to</th></tr></thead><tbody><tr><td>Hard intersect</td><td class="nx-mono">1.00×</td><td>Full trade band</td></tr><tr><td>Duplicate</td><td class="nx-mono">0.70×</td><td>Full trade band</td></tr><tr><td>Touching</td><td class="nx-mono">0.55×</td><td>Full trade band</td></tr><tr><td>Clearance</td><td class="nx-mono">0.30×</td><td>Full trade band</td></tr></tbody></table><p class="nx-table-foot">Per-clash estimate = discipline-pair rate band × clash-type factor.</p></div><div class="nx-table-card nx-rate-card"><div class="nx-table-title"><div><p class="nx-eyebrow">EDITABLE BENCHMARKS</p><h2>Rate bands by trade pair</h2></div>${button("workspace", "Edit in workspace", "nx-button-secondary nx-button-small")}</div><table class="nx-site-table"><thead><tr><th>Discipline pair</th><th>Low</th><th>High</th></tr></thead><tbody>${currentPairs().map((pair) => `<tr><td>${pair.name}</td><td class="nx-mono">${format(pair.low)}</td><td class="nx-mono">${format(pair.high)}</td></tr>`).join("")}</tbody></table><p class="nx-table-foot">Editable industry benchmark estimates.</p></div></div><aside class="nx-simulator"><p class="nx-eyebrow">LIVE ESTIMATE EXPLORER</p><h2>Test the cost logic</h2><label for="nx-sim-pair">Discipline pair</label><select id="nx-sim-pair">${currentPairs().map((pair, i) => `<option value="${i}">${pair.name}</option>`).join("")}</select><label for="nx-sim-type">Clash type</label><select id="nx-sim-type"><option value="1">Hard intersect · 1.00×</option><option value="0.7">Duplicate · 0.70×</option><option value="0.55">Touching · 0.55×</option><option value="0.3">Clearance · 0.30×</option></select><div class="nx-sim-count"><label for="nx-sim-count">Clash count</label><output id="nx-sim-count-label">8</output></div><input id="nx-sim-count" type="range" min="1" max="25" value="8"><div class="nx-sim-result"><span>ESTIMATED RANGE <b>ESTIMATE</b></span><strong id="nx-sim-total">$20,000 – $112,000</strong><small id="nx-sim-breakdown">8 × $2,500–$14,000 × 1.00</small></div><p class="nx-sim-disclaimer">Planning estimate only. Confirm rates, scope, and severity with your project team.</p></aside></section>
    <section class="nx-site-container nx-cost-code-note"><span class="nx-mono">CSI REFERENCE</span><p>Example trade codes appear in the workspace as reference labels. The current cost engine prices by discipline pair and clash type.</p></section>`);

  const revit = () => shell("revit", `${title("REVIT BRIDGE", "A direct path from Revit coordination to Nexus triage.", "Use IFC drop-in now. A Revit add-in and Autodesk Platform Services connector are planned. The current browser app does not parse RVT files.")}
    <section class="nx-site-container nx-revit-grid"><article class="nx-revit-card nx-revit-live"><div class="nx-revit-card-head"><span class="nx-step-no">01</span><span class="nx-live-tag"><i></i> AVAILABLE NOW</span></div><p class="nx-eyebrow">IFC DROP-IN</p><h2>Export once.<br>Analyze in your browser.</h2><ol><li>In Revit, select <b>File → Export → IFC</b>.</li><li>Drop one or more <code>.ifc</code> files into the Nexus workspace.</li><li>Review clashes, estimate ranges, and export reports.</li></ol>${button("workspace", "Open IFC workspace", "nx-button-primary")}</article><article class="nx-revit-card nx-revit-planned"><div class="nx-revit-card-head"><span class="nx-step-no">02</span><span class="nx-planned-tag">PLANNED</span></div><p class="nx-eyebrow">C# ADD-IN / APS CONNECTOR</p><h2>Push a model handoff from Revit.</h2><p class="nx-revit-copy">The planned connector will send model geometry and element metadata to the Nexus analysis workspace. Autodesk APS can provide a cloud translation path when direct Revit access is not available.</p><div class="nx-flow"><span>REVIT</span><i>→</i><span>ADD-IN / APS</span><i>→</i><span>NEXUS ENGINE</span></div><a class="nx-inline-link" href="/docs/REVIT_PLUGIN_SPEC.md" target="_blank" rel="noreferrer">Read the integration specification →</a></article></section>
    <section class="nx-site-container nx-revit-note"><div><p class="nx-eyebrow">CURRENT FILE SUPPORT</p><h2>IFC files load in the browser. RVT files need a translator.</h2></div><p>A dropped RVT file opens the workflow guide. Nexus does not claim to read proprietary RVT data without Revit or Autodesk APS.</p></section>
    <section class="nx-dark-band"><div class="nx-site-container nx-dark-inner"><div><p class="nx-eyebrow">START WITH THE DEMO</p><h2>See the analysis flow with two sample models.</h2></div>${button("workspace", "Run Live Demo", "nx-button-light")}</div></section>`);

  function setWorkspaceMode(show: boolean): void {
    document.body.classList.toggle("nx-landing-mode", !show);
    root.hidden = show;
    if (show) requestAnimationFrame(() => {
      const world = (window as unknown as { openBIM?: { world?: { renderer?: { resize?: () => void; three?: { render?: (scene: unknown, camera: unknown) => void } }; camera?: { updateAspect?: () => void; three?: unknown }; scene?: { three?: unknown } } } }).openBIM?.world;
      world?.renderer?.resize?.();
      world?.camera?.updateAspect?.();
      world?.renderer?.three?.render?.(world.scene?.three, world.camera?.three);
    });
  }

  function render(route: SiteRoute): void {
    const workspace = route === "workspace";
    setWorkspaceMode(workspace);
    if (workspace) return;
    root.innerHTML = route === "overview" ? overview() : route === "engine" ? engine() : route === "cost-model" ? costModel() : revit();
    if (route === "cost-model") bindSimulator();
  }

  function bindSimulator(): void {
    const pairInput = root.querySelector<HTMLSelectElement>("#nx-sim-pair");
    const typeInput = root.querySelector<HTMLSelectElement>("#nx-sim-type");
    const countInput = root.querySelector<HTMLInputElement>("#nx-sim-count");
    const update = () => {
      if (!pairInput || !typeInput || !countInput) return;
      const pair = currentPairs()[Number(pairInput.value)];
      const factor = Number(typeInput.value);
      const count = Number(countInput.value);
      root.querySelector("#nx-sim-count-label")!.textContent = String(count);
      root.querySelector("#nx-sim-total")!.textContent = `${format(pair.low * factor * count)} – ${format(pair.high * factor * count)}`;
      root.querySelector("#nx-sim-breakdown")!.textContent = `${count} × ${format(pair.low)}–${format(pair.high)} × ${factor.toFixed(2)}`;
    };
    pairInput?.addEventListener("change", update);
    typeInput?.addEventListener("change", update);
    countInput?.addEventListener("input", update);
    update();
  }

  root.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest(".nx-mobile-menu")) {
      root.querySelector(".nx-site-nav")?.classList.toggle("nx-menu-open");
      return;
    }
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-route]");
    if (!target) return;
    event.preventDefault();
    const route = target.dataset.route as SiteRoute;
    navigate(route);
    if (route === "workspace") {
      if (target.textContent?.toLowerCase().includes("demo")) void actions.loadDemo();
      if (target.textContent?.toLowerCase().includes("edit in workspace")) actions.openRates();
    }
  });
  document.getElementById("nx-home")?.addEventListener("click", (event) => { event.preventDefault(); navigate("overview"); });
  window.addEventListener("hashchange", () => render(routeFromHash()));
  window.addEventListener("popstate", () => render(routeFromHash()));
  navigate(routeFromHash(), true);
}
