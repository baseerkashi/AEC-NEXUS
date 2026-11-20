import "../styles/nexus-site.css";
import { validateRateTable } from "./security";

type SiteRoute = "overview" | "engine" | "cost-model" | "revit" | "workspace";
interface SiteActions { loadDemo: () => Promise<void>; openRates: () => void }

const routes: SiteRoute[] = ["overview", "engine", "cost-model", "revit", "workspace"];
const routeNames: Record<SiteRoute, string> = {
  overview: "Overview",
  engine: "Engine",
  "cost-model": "Cost Model",
  revit: "Revit Bridge",
  workspace: "Workspace",
};

interface DisciplinePairMeta {
  name: string;
  code: string;
  low: number;
  high: number;
}

const defaultPairs: DisciplinePairMeta[] = [
  { name: "Structure × MEP", code: "03-23-01", low: 2500, high: 14000 },
  { name: "Structure × Structure", code: "03-30-00", low: 500, high: 3000 },
  { name: "MEP × MEP", code: "23-05-93", low: 700, high: 4500 },
  { name: "Architecture × MEP", code: "07-84-13", low: 1200, high: 6500 },
  { name: "Architecture × Structure", code: "03-30-00", low: 900, high: 5500 },
];

function currentPairs(): DisciplinePairMeta[] {
  try {
    const saved = validateRateTable(JSON.parse(localStorage.getItem("aecNexus.settings.v1") ?? "null"));
    return defaultPairs.map((pair) => ({
      ...pair,
      ...(saved.bands[pair.name as keyof typeof saved.bands] ?? {}),
    }));
  } catch {
    return defaultPairs;
  }
}

const format = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

const mark = `<svg class="nx-site-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M4 27 14.2 5.5c.7-1.5 2.9-1.5 3.6 0L28 27M9 18h14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const iconArrow = `<svg class="nx-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const iconCheck = `<svg class="nx-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.5 3.5 6.5-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const iconShield = `<svg class="nx-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2l5 2v4c0 3.5-2.5 5.5-5 6-2.5-.5-5-2.5-5-6V4l5-2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const iconFile = `<svg class="nx-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h5l4 4v8H4V2zM9 2v4h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function routeFromHash(): SiteRoute {
  const value = location.hash.replace(/^#\/?/, "").split("?")[0];
  if (value === "workspace") return "workspace";
  return routes.includes(value as SiteRoute) ? (value as SiteRoute) : "overview";
}

export function setupNexusSite(actions: SiteActions): void {
  const root = document.createElement("div");
  root.id = "nx-site";
  document.body.append(root);

  const navigate = (route: SiteRoute, replace = false) => {
    const hash = `#/${route === "overview" ? "" : route}`;
    if (location.hash !== hash) {
      history[replace ? "replaceState" : "pushState"]({}, "", `${location.pathname}${location.search}${hash}`);
    }
    render(route);
  };

  const anchor = (route: SiteRoute, label: string, cls = "") =>
    `<a class="${cls}" href="#/${route === "overview" ? "" : route}" data-route="${route}">${label}</a>`;

  const button = (route: SiteRoute, label: string, cls = "") =>
    `<a class="nx-site-button ${cls}" href="#/${route === "overview" ? "" : route}" data-route="${route}">${label}</a>`;

  const nav = (active: SiteRoute) => `
    <header class="nx-site-nav">
      <div class="nx-site-nav-inner">
        <a class="nx-site-brand" href="#/" data-route="overview">
          ${mark}
          <span>AEC NEXUS</span>
        </a>
        <nav aria-label="Main navigation">
          ${(["overview", "engine", "cost-model", "revit"] as SiteRoute[])
            .map((route) => anchor(route, routeNames[route], active === route ? "is-active" : ""))
            .join("")}
        </nav>
        <div class="nx-site-nav-actions">
          ${button("workspace", "Launch Workspace", "nx-button-secondary nx-nav-btn")}
          ${button("workspace", "Run Live Demo", "nx-button-primary nx-nav-btn")}
        </div>
        <button class="nx-mobile-menu" aria-label="Open menu" type="button">Menu</button>
      </div>
    </header>`;

  const footer = () => `
    <footer class="nx-site-footer">
      <div class="nx-site-container nx-footer-inner">
        <div class="nx-footer-col">
          <a class="nx-site-brand" href="#/" data-route="overview">
            ${mark}
            <span>AEC NEXUS</span>
          </a>
          <p class="nx-footer-desc">Professional pre-construction financial intelligence and multi-discipline BIM clash triage in your browser.</p>
          <p class="nx-footer-note">Client-side processing. Zero server upload. MIT License.</p>
        </div>
        <div class="nx-footer-nav">
          <div class="nx-footer-links">
            <span class="nx-footer-heading">Platform</span>
            ${anchor("overview", "Overview")}
            ${anchor("engine", "Engine Architecture")}
            ${anchor("cost-model", "Cost Intelligence")}
            ${anchor("revit", "Revit Bridge")}
          </div>
          <div class="nx-footer-links">
            <span class="nx-footer-heading">Workspace</span>
            ${button("workspace", "Launch Workspace", "nx-footer-action")}
            ${button("workspace", "Run Live Demo", "nx-footer-action")}
            <a href="https://github.com/amdghedy/openBIMstudio" target="_blank" rel="noreferrer" class="nx-footer-action">GitHub Source</a>
          </div>
        </div>
      </div>
      <div class="nx-site-container nx-footer-bottom">
        <span>AEC Nexus v1.0. Zero install. Local first.</span>
        <span>Open Architecture Standards (IFC · BCF · IDS)</span>
      </div>
    </footer>`;

  const shell = (route: SiteRoute, content: string) => `${nav(route)}<main class="nx-site-main">${content}</main>${footer()}`;

  const title = (eyebrow: string, heading: string, copy: string) => `
    <section class="nx-page-intro">
      <div class="nx-site-container">
        <p class="nx-eyebrow">${eyebrow}</p>
        <h1>${heading}</h1>
        <p class="nx-page-copy">${copy}</p>
      </div>
    </section>`;

  const overview = () =>
    shell(
      "overview",
      `
    <section class="nx-hero">
      <div class="nx-site-container nx-hero-grid">
        <div class="nx-hero-copy">
          <p class="nx-eyebrow">PRE-CONSTRUCTION FINANCIAL INTELLIGENCE</p>
          <h1>Price BIM clashes before concrete is poured.</h1>
          <p class="nx-hero-lede">Load multi-discipline IFC models in your browser. Detect 3D intersections, map trade cost codes, and export executive cash-leak audits in seconds.</p>
          <div class="nx-hero-actions">
            ${button("workspace", "Run Live Demo", "nx-button-primary nx-button-hero")}
            ${anchor("cost-model", "Explore Cost Model", "nx-site-button nx-button-secondary nx-button-hero")}
          </div>
          <div class="nx-hero-features">
            <span>${iconShield} 100% Client-Side Memory</span>
            <span>${iconFile} Native IFC2x3 and IFC4</span>
            <span>${iconCheck} Editable Rate Bands</span>
          </div>
        </div>

        <div class="nx-hero-visual">
          <div class="nx-preview-frame">
            <div class="nx-preview-top">
              <span class="nx-preview-label">PROJECT / FEDERATED MODEL</span>
              <span class="nx-preview-badge">LOCAL-FIRST SESSION</span>
            </div>
            <div class="nx-preview-telemetry">
              <div class="nx-telemetry-header">
                <span>ESTIMATED CASH LEAK</span>
                <span class="nx-pill-estimate">ESTIMATE</span>
              </div>
              <strong class="nx-telemetry-total">$18,600 <i>–</i> $89,500</strong>
              <small class="nx-telemetry-sub">Deterministic benchmark range · 8 active clashes</small>
            </div>
            <div class="nx-preview-items">
              <div class="nx-preview-row nx-row-critical">
                <span class="nx-dot-crimson"></span>
                <div class="nx-row-info">
                  <strong>5 STR × MEP Critical</strong>
                  <small>Structural beams intersecting HVAC supply ducts</small>
                </div>
                <code>CSI 03-23-01</code>
              </div>
              <div class="nx-preview-row nx-row-medium">
                <span class="nx-dot-copper"></span>
                <div class="nx-row-info">
                  <strong>3 ARC × MEP Moderate</strong>
                  <small>Architectural wall penetrations without fire sleeves</small>
                </div>
                <code>CSI 07-84-13</code>
              </div>
            </div>
            <div class="nx-preview-meta">
              <span>BVH TOLERANCE 0.005m</span>
              <span>TRIANGLES TESTED 84,200</span>
            </div>
            <div class="nx-preview-actions">
              ${button("workspace", "Enter 3D Workspace", "nx-site-button nx-button-primary nx-preview-cta")}
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="nx-proof-band">
      <div class="nx-site-container nx-proof-grid">
        <div class="nx-proof-item">
          <strong>0.005m</strong>
          <span>Triangle Tolerance</span>
        </div>
        <div class="nx-proof-item">
          <strong>4</strong>
          <span>Severity Multipliers</span>
        </div>
        <div class="nx-proof-item">
          <strong>100%</strong>
          <span>Client-Side Memory</span>
        </div>
        <div class="nx-proof-item">
          <strong>&lt; 3s</strong>
          <span>Multi-Model Triage</span>
        </div>
      </div>
    </section>

    <section class="nx-section">
      <div class="nx-site-container">
        <div class="nx-section-head">
          <div>
            <p class="nx-eyebrow">THE PLATFORM</p>
            <h2>Precision clash detection meets financial discipline.</h2>
          </div>
          ${anchor("engine", `Inspect Architecture ${iconArrow}`, "nx-inline-link")}
        </div>
        <div class="nx-bento-grid">
          <article class="nx-bento-card nx-bento-flagship">
            <span class="nx-card-index">01 / FINANCIAL TRIAGE</span>
            <h3>Financial Triage First</h3>
            <p>Traditional clash matrixes produce hundreds of unranked lines. AEC Nexus groups spatial conflicts by discipline pairs and prices potential delay exposure before trade contractors arrive on site.</p>
            <div class="nx-exposure-bars">
              <div class="nx-bar-item">
                <div class="nx-bar-head">
                  <span>Structure × MEP</span>
                  <code>$12,500 – $70,000</code>
                </div>
                <div class="nx-bar-track">
                  <div class="nx-bar-fill nx-fill-crimson" style="width: 78%;"></div>
                </div>
              </div>
              <div class="nx-bar-item">
                <div class="nx-bar-head">
                  <span>Architecture × MEP</span>
                  <code>$3,600 – $19,500</code>
                </div>
                <div class="nx-bar-track">
                  <div class="nx-bar-fill nx-fill-copper" style="width: 42%;"></div>
                </div>
              </div>
              <div class="nx-bar-item">
                <div class="nx-bar-head">
                  <span>MEP × MEP</span>
                  <code>$2,500 – $12,000</code>
                </div>
                <div class="nx-bar-track">
                  <div class="nx-bar-fill nx-fill-teal" style="width: 28%;"></div>
                </div>
              </div>
            </div>
          </article>

          <article class="nx-bento-card nx-bento-tall">
            <span class="nx-card-index">02 / COMPUTE ENGINE</span>
            <h3>Zero-Install WebIFC Engine</h3>
            <p>Runs entirely inside your browser using WebAssembly. Geometry parsing, BVH spatial tree generation, and triangle-to-triangle clash detection occur on background workers without transferring proprietary model files over the internet.</p>
            <div class="nx-tech-pills">
              <span>web-ifc 0.0.77</span>
              <span>BVH Tree</span>
              <span>Three.js Shaded</span>
              <span>Web Worker Isolation</span>
            </div>
            ${anchor("engine", `Read engine specs ${iconArrow}`, "nx-arrow-link")}
          </article>

          <article class="nx-bento-card nx-bento-wide">
            <div class="nx-bento-wide-copy">
              <span class="nx-card-index">03 / AUDIT DELIVERY</span>
              <h3>1-Click .xlsx &amp; .pdf Executive Handoff</h3>
              <p>Convert technical 3D conflicts into clean executive briefing sheets. Export structured multi-sheet Excel reports with sanitized formulas or formatted PDF audit summaries with a single click.</p>
              <div class="nx-format-badges">
                <span class="nx-badge-format">.XLSX WORKBOOK</span>
                <span class="nx-badge-format">.PDF EXECUTIVE AUDIT</span>
                <span class="nx-badge-format">.CSV INTEGRATION</span>
              </div>
            </div>
            <div class="nx-bento-wide-action">
              ${button("workspace", "Try Demo Handoff", "nx-site-button nx-button-secondary")}
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="nx-dark-band">
      <div class="nx-site-container nx-dark-inner">
        <div>
          <p class="nx-eyebrow nx-eyebrow-dark">PRE-CONSTRUCTION ASSURANCE</p>
          <h2>Stop cash leaks before trade contracts are executed.</h2>
          <p class="nx-dark-sub">Open your IFC models or load the live benchmark demo in 2 seconds.</p>
        </div>
        <div class="nx-dark-actions">
          ${button("workspace", "Launch 3D Workspace", "nx-button-light nx-button-large")}
        </div>
      </div>
    </section>`
    );

  const engine = () =>
    shell(
      "engine",
      `${title(
        "ENGINE & ARCHITECTURE",
        "Deterministic pipeline from raw IFC to priced action.",
        "AEC Nexus executes multi-discipline model federation, spatial triangle analysis, category mapping, and cost modeling directly on client hardware."
      )}
    <section class="nx-section nx-engine-section">
      <div class="nx-site-container">
        <h2 class="nx-section-title">Visual 4-Stage Analysis Pipeline</h2>
        <div class="nx-pipeline-grid">
          <div class="nx-pipeline-card">
            <span class="nx-pipeline-step">STAGE 01</span>
            <h3>IFC Federation</h3>
            <p>Streams and parses ISO-10303-21 STEP schemas via WebAssembly. Retains element classifications, global IDs, and spatial hierarchical structures in local memory.</p>
            <div class="nx-pipeline-meta">
              <code>WEB-IFC WASM</code>
              <span>IFC2x3 · IFC4</span>
            </div>
          </div>
          <div class="nx-pipeline-card">
            <span class="nx-pipeline-step">STAGE 02</span>
            <h3>BVH Triangle Check</h3>
            <p>Constructs bounded volume hierarchy trees for each discipline mesh. Tests triangle coplanarity and penetration with a strict 0.005m tolerance threshold.</p>
            <div class="nx-pipeline-meta">
              <code>CLASH WORKER</code>
              <span>0.005m Tolerance</span>
            </div>
          </div>
          <div class="nx-pipeline-card">
            <span class="nx-pipeline-step">STAGE 03</span>
            <h3>Discipline Classifier</h3>
            <p>Categorizes IFC entities into Structure, Mechanical/Electrical/Plumbing (MEP), and Architecture. Classifies severity into Hard Intersects, Duplicates, and Touching.</p>
            <div class="nx-pipeline-meta">
              <code>DISCIPLINE MAPPING</code>
              <span>STR · MEP · ARC</span>
            </div>
          </div>
          <div class="nx-pipeline-card">
            <span class="nx-pipeline-step">STAGE 04</span>
            <h3>Cost Engine &amp; Audit</h3>
            <p>Applies calibrated industry trade rate bands and deterministic severity factors. Generates real-time financial triage tables and sanitized XLSX/PDF exports.</p>
            <div class="nx-pipeline-meta">
              <code>CSI TRADE MATRIX</code>
              <span>XLSX · PDF · CSV</span>
            </div>
          </div>
        </div>

        <div class="nx-specs-wrap">
          <h2 class="nx-section-title">Verified Technical Specifications</h2>
          <table class="nx-site-table nx-specs-table">
            <thead>
              <tr>
                <th>System Subsystem</th>
                <th>Verified Specification</th>
                <th>Implementation Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Parser Engine</td>
                <td class="nx-mono">web-ifc 0.0.77</td>
                <td>Version-pinned WebAssembly module compiled with memory bounds checks</td>
              </tr>
              <tr>
                <td>Spatial Intersection</td>
                <td class="nx-mono">0.005m Tolerance</td>
                <td>Three-mesh BVH spatial accelerated triangle penetration detection</td>
              </tr>
              <tr>
                <td>Concurrency Model</td>
                <td class="nx-mono">Dedicated Web Worker</td>
                <td>Off-main-thread geometry intersection computing without UI frame drops</td>
              </tr>
              <tr>
                <td>Coordinate Precision</td>
                <td class="nx-mono">Millimeter Real World</td>
                <td>Preserves true world coordinate placement and elevation offsets</td>
              </tr>
              <tr>
                <td>Supported Input</td>
                <td class="nx-mono">.IFC, .RVT (Bridge)</td>
                <td>ISO-10303-21 header validation; Revit export guidelines and C# spec</td>
              </tr>
              <tr>
                <td>Export Artifacts</td>
                <td class="nx-mono">.XLSX, .PDF, .CSV</td>
                <td>Client-side XML spreadsheet generation with formula injection prevention</td>
              </tr>
              <tr>
                <td>Data Boundary</td>
                <td class="nx-mono">100% Client-Side</td>
                <td>Zero model geometry or metadata transmitted to external cloud servers</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="nx-privacy-card">
          <div class="nx-privacy-head">
            ${iconShield}
            <div>
              <h3>Local-First Privacy Architecture</h3>
              <p>Model geometry and proprietary trade rates never leave your browser.</p>
            </div>
          </div>
          <p class="nx-privacy-body">Building information models contain sensitive structural designs, security layouts, and intellectual property. AEC Nexus executes the entire geometric evaluation and financial calculation locally in client memory. All files are loaded directly into browser memory buffers, processed through local Web Workers, and saved only when you download an export report.</p>
        </div>
      </div>
    </section>`
    );

  const costModel = () =>
    shell(
      "cost-model",
      `${title(
        "COST INTELLIGENCE",
        "Deterministic cost logic engineering teams can trust.",
        "AEC Nexus pairs geometric clash severity with customizable trade rate schedules. Low–high ranges communicate realistic project risk without artificial single-dollar certainty."
      )}
    <section class="nx-section nx-cost-section">
      <div class="nx-site-container">
        <div class="nx-rationale-box">
          <h3>Why Estimate Ranges Build Engineering Trust</h3>
          <p>Single-dollar estimates on construction clashes create false precision and invite skepticism from trade superintendents. An intersection between a 600mm structural beam and a main chilled water supply duct carries very different consequences than a drywall stud clip conflict. Low–high ranges reflect realistic variable site conditions, access difficulties, pre-pour versus post-pour remediation costs, and schedule delay exposure.</p>
        </div>

        <div class="nx-cost-page-grid">
          <div class="nx-cost-main">
            <div class="nx-table-card">
              <div class="nx-table-title">
                <div>
                  <p class="nx-eyebrow">SEVERITY COEFFICIENTS</p>
                  <h2>Deterministic Multipliers</h2>
                </div>
                <span class="nx-status-label">ENGINE RULES</span>
              </div>
              <table class="nx-site-table">
                <thead>
                  <tr>
                    <th>Clash Type</th>
                    <th>Factor</th>
                    <th>Application Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Hard Intersect</td>
                    <td class="nx-mono">1.00×</td>
                    <td>Direct volumetric collision requiring full physical reroute or redesign</td>
                  </tr>
                  <tr>
                    <td>Duplicate Element</td>
                    <td class="nx-mono">0.70×</td>
                    <td>Double-modeled item causing duplicate material takeoffs and ordering</td>
                  </tr>
                  <tr>
                    <td>Touching / Clearance Deficit</td>
                    <td class="nx-mono">0.55×</td>
                    <td>Zero-clearance contact preventing insulation or seismic movement</td>
                  </tr>
                  <tr>
                    <td>Soft Clearance Violation</td>
                    <td class="nx-mono">0.30×</td>
                    <td>Maintenance access or code clearance zone infringement</td>
                  </tr>
                </tbody>
              </table>
              <p class="nx-table-foot">Clash Cost Range = (Discipline Pair Rate Band) × (Clash Type Factor) × (Clash Count)</p>
            </div>

            <div class="nx-table-card nx-rate-card">
              <div class="nx-table-title">
                <div>
                  <p class="nx-eyebrow">TRADE RATE SCHEDULE</p>
                  <h2>Benchmark Cost Bands</h2>
                </div>
                ${button("workspace", "Calibrate Rates in Workspace", "nx-site-button nx-button-secondary nx-button-small")}
              </div>
              <table class="nx-site-table">
                <thead>
                  <tr>
                    <th>Discipline Pair</th>
                    <th>Trade Code</th>
                    <th>Low Estimate (USD)</th>
                    <th>High Estimate (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  ${currentPairs()
                    .map(
                      (pair) => `
                    <tr>
                      <td><strong>${pair.name}</strong></td>
                      <td><code>${pair.code}</code></td>
                      <td class="nx-mono">${format(pair.low)}</td>
                      <td class="nx-mono">${format(pair.high)}</td>
                    </tr>`
                    )
                    .join("")}
                </tbody>
              </table>
              <p class="nx-table-foot">Rates reflect baseline industry benchmarks. Edit these live in the workspace at any time.</p>
            </div>
          </div>

          <aside class="nx-simulator">
            <p class="nx-eyebrow">INTERACTIVE COST SIMULATOR</p>
            <h2>Calculate Exposure</h2>
            
            <label for="nx-sim-pair">Discipline Pair</label>
            <select id="nx-sim-pair">
              ${currentPairs()
                .map((pair, i) => `<option value="${i}">${pair.name} (${pair.code})</option>`)
                .join("")}
            </select>

            <label for="nx-sim-type">Clash Severity</label>
            <select id="nx-sim-type">
              <option value="1">Hard Intersect · 1.00×</option>
              <option value="0.7">Duplicate · 0.70×</option>
              <option value="0.55">Touching · 0.55×</option>
              <option value="0.3">Clearance · 0.30×</option>
            </select>

            <div class="nx-sim-count">
              <label for="nx-sim-count">Clash Count</label>
              <output id="nx-sim-count-label">8</output>
            </div>
            <input id="nx-sim-count" type="range" min="1" max="25" value="8">

            <div class="nx-sim-result">
              <div class="nx-sim-header">
                <span>ESTIMATED CASH EXPOSURE</span>
                <span class="nx-pill-estimate">ESTIMATE</span>
              </div>
              <strong id="nx-sim-total">$20,000 – $112,000</strong>
              <div class="nx-sim-details">
                <span id="nx-sim-code">Trade Code: CSI 03-23-01</span>
                <code id="nx-sim-breakdown">8 × ($2,500 – $14,000) × 1.00</code>
              </div>
            </div>
            
            <p class="nx-sim-disclaimer">Planning estimate range only. Confirm trade rates and site specific conditions with project managers.</p>
          </aside>
        </div>
      </div>
    </section>`
    );

  const revit = () =>
    shell(
      "revit",
      `${title(
        "DROP-IN SERVICE & REVIT BRIDGE",
        "Seamless workflow from Autodesk Revit to AEC Nexus.",
        "Analyze Revit models today via zero-overhead IFC export, with a direct 1-click C# Add-in and Autodesk Platform Services connector currently specified."
      )}
    <section class="nx-section nx-revit-section">
      <div class="nx-site-container">
        <div class="nx-revit-comparison-grid">
          <article class="nx-revit-card nx-revit-available">
            <div class="nx-revit-card-head">
              <span class="nx-revit-badge-live">${iconCheck} AVAILABLE TODAY</span>
              <span class="nx-step-no">WORKFLOW A</span>
            </div>
            <h2>Standard IFC Drop-In</h2>
            <p>Export standard IFC files directly from Revit and drag them into the AEC Nexus viewport for instant analysis.</p>
            <ol class="nx-revit-steps">
              <li>In Autodesk Revit, click <strong>File → Export → IFC</strong>.</li>
              <li>Select standard coordination setup (IFC2x3 Coordination View 2.0 or IFC4).</li>
              <li>Drop the exported <code>.ifc</code> files directly onto the AEC Nexus browser window.</li>
              <li>View automatic multi-discipline federation, clash triage, and dollar exposure.</li>
            </ol>
            <div class="nx-revit-actions">
              ${button("workspace", "Open IFC Workspace", "nx-site-button nx-button-primary")}
            </div>
          </article>

          <article class="nx-revit-card nx-revit-planned">
            <div class="nx-revit-card-head">
              <span class="nx-revit-badge-planned">PLANNED SPECIFICATION</span>
              <span class="nx-step-no">WORKFLOW B</span>
            </div>
            <h2>Direct C# Add-in &amp; APS Bridge</h2>
            <p>1-click Revit ribbon plugin and Autodesk Platform Services cloud ingestion connector without manual file exports.</p>
            <ul class="nx-revit-features">
              <li>Native C# Add-in tab inside Autodesk Revit 2024 / 2025.</li>
              <li>Extracts element IDs, categories, and shared coordinates automatically.</li>
              <li>Autodesk APS Model Derivative translation for cloud-hosted worksharing.</li>
              <li>Synchronizes live model changes directly into AEC Nexus sessions.</li>
            </ul>
            <div class="nx-flow-diagram">
              <span class="nx-flow-node">REVIT</span>
              <span class="nx-flow-arrow">→</span>
              <span class="nx-flow-node">C# / APS BRIDGE</span>
              <span class="nx-flow-arrow">→</span>
              <span class="nx-flow-node">AEC NEXUS</span>
            </div>
            <div class="nx-revit-actions">
              <a class="nx-site-button nx-button-secondary" href="/docs/REVIT_PLUGIN_SPEC.md" target="_blank" rel="noreferrer">
                Read Plugin Specification ${iconArrow}
              </a>
            </div>
          </article>
        </div>

        <div class="nx-handoff-breakdown">
          <h2 class="nx-section-title">Executive Handoff Deliverables</h2>
          <div class="nx-handoff-grid">
            <div class="nx-handoff-card">
              <div class="nx-handoff-icon">${iconFile}</div>
              <h3>Excel (.xlsx) Multi-Sheet Register</h3>
              <p>Generated entirely in browser memory. Sheet 1 contains the complete ranked clash register with element IDs, categories, and low–high costs. Sheet 2 includes executive financial rollups with formula injection protection.</p>
            </div>
            <div class="nx-handoff-card">
              <div class="nx-handoff-icon">${iconFile}</div>
              <h3>PDF Executive Audit Brief</h3>
              <p>Clean printable audit brief with clean typography, exposure breakdown, trade risk categorizations, and complete element identifiers for field coordination reviews.</p>
            </div>
          </div>
        </div>

        <div class="nx-dark-band nx-revit-cta-band">
          <div class="nx-site-container nx-dark-inner">
            <div>
              <p class="nx-eyebrow nx-eyebrow-dark">READY TO AUDIT</p>
              <h2>Test the workflow with our two-model live demo.</h2>
            </div>
            <div class="nx-dark-actions">
              ${button("workspace", "Run Live Demo", "nx-button-light nx-button-large")}
            </div>
          </div>
        </div>
      </div>
    </section>`
    );

  function setWorkspaceMode(show: boolean): void {
    document.body.classList.toggle("nx-landing-mode", !show);
    root.hidden = show;
    if (show) {
      requestAnimationFrame(() => {
        const world = (
          window as unknown as {
            openBIM?: {
              world?: {
                renderer?: { resize?: () => void; three?: { render?: (scene: unknown, camera: unknown) => void } };
                camera?: { updateAspect?: () => void; three?: unknown };
                scene?: { three?: unknown };
              };
            };
          }
        ).openBIM?.world;
        world?.renderer?.resize?.();
        world?.camera?.updateAspect?.();
        world?.renderer?.three?.render?.(world.scene?.three, world.camera?.three);
      });
    }
  }

  function render(route: SiteRoute): void {
    const workspace = route === "workspace";
    setWorkspaceMode(workspace);
    if (workspace) return;
    root.innerHTML =
      route === "overview" ? overview() : route === "engine" ? engine() : route === "cost-model" ? costModel() : revit();
    if (route === "cost-model") bindSimulator();
  }

  function bindSimulator(): void {
    const pairInput = root.querySelector<HTMLSelectElement>("#nx-sim-pair");
    const typeInput = root.querySelector<HTMLSelectElement>("#nx-sim-type");
    const countInput = root.querySelector<HTMLInputElement>("#nx-sim-count");

    const update = () => {
      if (!pairInput || !typeInput || !countInput) return;
      const pair = currentPairs()[Number(pairInput.value)] ?? currentPairs()[0];
      const factor = Number(typeInput.value);
      const count = Number(countInput.value);

      const countLabel = root.querySelector("#nx-sim-count-label");
      if (countLabel) countLabel.textContent = String(count);

      const totalDisplay = root.querySelector("#nx-sim-total");
      if (totalDisplay) {
        totalDisplay.textContent = `${format(pair.low * factor * count)} – ${format(pair.high * factor * count)}`;
      }

      const codeDisplay = root.querySelector("#nx-sim-code");
      if (codeDisplay) {
        codeDisplay.textContent = `Trade Code: CSI ${pair.code}`;
      }

      const breakdownDisplay = root.querySelector("#nx-sim-breakdown");
      if (breakdownDisplay) {
        breakdownDisplay.textContent = `${count} × (${format(pair.low)} – ${format(pair.high)}) × ${factor.toFixed(2)}`;
      }
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
      const text = target.textContent?.toLowerCase() ?? "";
      if (text.includes("demo")) void actions.loadDemo();
      if (text.includes("calibrate") || text.includes("edit")) actions.openRates();
    }
  });

  document.getElementById("nx-home")?.addEventListener("click", (event) => {
    event.preventDefault();
    navigate("overview");
  });

  window.addEventListener("hashchange", () => render(routeFromHash()));
  window.addEventListener("popstate", () => render(routeFromHash()));
  navigate(routeFromHash(), true);
}
