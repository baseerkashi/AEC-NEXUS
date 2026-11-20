import {
  focusClashByIndex,
  getClashState,
  listClashes,
  runElementClashDetection,
} from "./clash";
import { loadIfcFiles } from "./importer";
import { ctx } from "../core/context";
import * as THREE from "three";
import type { ElementClash } from "./clash-engine";
import { closeToolWindow } from "./tool-windows";
import { setupNexusSite } from "../nexus/site";
import { DEFAULT_RATE_TABLE, escapeHtml, sanitizeSpreadsheetCell, validateRateTable, validateUploadedFile } from "../nexus/security";

type PairKey = "Architecture × MEP" | "Structure × MEP" | "MEP × MEP" | "Architecture × Structure" | "Other";
interface Band { low: number; high: number }
interface Settings { bands: Record<PairKey, Band> }
interface PricedClash {
  index: number;
  clash: ElementClash;
  pair: PairKey;
  disciplineA: string;
  disciplineB: string;
  low: number;
  high: number;
  status: string;
  priority: "High" | "Medium" | "Low";
}

const STORAGE_KEY = "aecNexus.settings.v1";
const DEFAULT_SETTINGS: Settings = DEFAULT_RATE_TABLE;
const FACTOR: Record<ElementClash["kind"], number> = {
  intersect: 1,
  touching: 0.55,
  clearance: 0.3,
  duplicate: 0.7,
};

function readSettings(): Settings {
  try {
    return validateRateTable(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch { return structuredClone(DEFAULT_SETTINGS); }
}

let settings = readSettings();
let filter: "all" | "high" | "open" = "all";
let activeTab: "triage" | "matrix" = "triage";
let isOpen = false;

const panel = document.createElement("section");
panel.id = "aec-nexus-dashboard";
panel.setAttribute("aria-label", "AEC Nexus clash cost dashboard");
panel.className = "nx-dashboard";

document.body.appendChild(panel);



const topbar = document.createElement("header");
topbar.id = "nx-globalbar";
topbar.innerHTML = `<a href="/#/" class="brand-home" id="nx-home">AEC NEXUS</a><span class="count" id="nx-model-count">0 MODELS</span><button id="nx-load-demo" class="primary">Load Demo</button><button id="nx-upload">Upload IFC</button><button id="nx-export-excel">Export Excel</button><button id="nx-export-pdf">Export PDF</button><input id="nx-file-input" type="file" accept=".ifc,.rvt" multiple hidden>`;
document.body.appendChild(topbar);
const fileMessage = document.createElement("div");
fileMessage.id = "nx-file-message";
fileMessage.setAttribute("role", "alert");
fileMessage.setAttribute("aria-live", "polite");
fileMessage.hidden = true;
document.body.appendChild(fileMessage);
const dropOverlay = document.createElement("div");
dropOverlay.id = "nx-drop-overlay";
dropOverlay.setAttribute("aria-hidden", "true");
dropOverlay.textContent = "Drop IFC models to load and analyze";
document.body.appendChild(dropOverlay);
const rvtBackdrop = document.createElement("div");
rvtBackdrop.id = "nx-rvt-backdrop";
rvtBackdrop.innerHTML = `<section id="nx-rvt-dialog" role="dialog" aria-modal="true" aria-labelledby="nx-rvt-title">
  <button id="nx-rvt-close" class="nx-rvt-close" aria-label="Close Revit workflow">Close</button>
  <h2 id="nx-rvt-title">Revit workflow</h2>
  <h3>Immediate workflow</h3>
  <p>In Revit, choose File -&gt; Export -&gt; IFC. Drop the IFC file here for immediate clash and cost analysis.</p>
  <h3>Planned plugin workflow</h3>
  <p>The planned AEC Nexus Revit Add-in or Autodesk APS connector will send model geometry and element metadata to this workspace in one click.</p>
  <button id="nx-rvt-demo" class="primary">Run Live Demo</button>
</section>`;
document.body.appendChild(rvtBackdrop);
const controls = document.createElement("nav");
controls.id = "nx-controls";
controls.innerHTML = `<button data-discipline="STR" aria-pressed="true">STR</button><button data-discipline="MEP" aria-pressed="true">MEP</button><button data-discipline="ARC" aria-pressed="true">ARC</button><button id="nx-reset">Reset View</button><button id="nx-run">Run Clash</button>`;
document.body.appendChild(controls);

function discipline(category: string, name = ""): string {
  const value = `${category} ${name}`.toUpperCase();
  if (/DUCT|AIRTERMINAL|DAMPER|FAN|CHILLER|BOILER|HVAC|FLOWSEGMENT/.test(value)) return "MEP";
  if (/PIPE|SANITARY|WASTEWATER|PLUMB|VALVE|SPRINKLER|FIRESUPPRESS|FIRE/.test(value)) return "MEP";
  if (/CABLE|LIGHT|ELECTRIC|SWITCH|OUTLET|DISTRIBUTION|CONDUIT/.test(value)) return "MEP";
  if (/BEAM|COLUMN|FOOTING|SLAB|PILE|REBAR|MEMBER|REINFORC/.test(value)) return "Structure";
  if (/WALL|DOOR|WINDOW|ROOF|SPACE|STAIR|RAMP|CURTAIN|BUILDINGELEMENT/.test(value)) return "Architecture";
  return "Other";
}

function pairKey(a: string, b: string): PairKey {
  const pair = [a, b].sort().join("|");
  if (pair === "Architecture|MEP") return "Architecture × MEP";
  if (pair === "MEP|Structure") return "Structure × MEP";
  if (pair === "MEP|MEP") return "MEP × MEP";
  if (pair === "Architecture|Structure") return "Architecture × Structure";
  return "Other";
}

function money(value: number): string {
  const amount = Math.round(value);
  return `$${amount.toLocaleString()}`;
}

function priceClashes(): PricedClash[] {
  return listClashes().map((clash, index) => {
    const disciplineA = discipline(clash.a.cat, clash.a.name);
    const disciplineB = discipline(clash.b.cat, clash.b.name);
    const pair = pairKey(disciplineA, disciplineB);
    const band = settings.bands[pair];
    const factor = FACTOR[clash.kind] ?? 1;
    const state = getClashState(clash);
    const priority: PricedClash["priority"] = clash.kind === "intersect" && pair.includes("Structure")
      ? "High" : clash.kind === "intersect" || clash.kind === "touching" ? "Medium" : "Low";
    return {
      index, clash, pair, disciplineA, disciplineB,
      low: band.low * factor,
      high: band.high * factor,
      status: state.status,
      priority,
    };
  });
}

function persistSettings(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* local storage may be disabled */ }
}

function showFileMessage(message: string): void {
  fileMessage.textContent = message;
  fileMessage.hidden = !message;
}

function csvCell(value: unknown): string {
  const text = String(sanitizeSpreadsheetCell(value) ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function reportValues(rows: PricedClash[]): Array<Array<string | number>> {
  return [
    ["Priority", "Status", "Clash type", "Discipline pair", "Element A", "Category A", "Model A", "Element B", "Category B", "Model B", "Estimate low (USD)", "Estimate high (USD)", "Precision", "Rate source"],
    ...rows.map((row) => [
      row.priority, row.status, row.clash.kind, row.pair,
      row.clash.a.name, row.clash.a.cat, row.clash.a.modelId,
      row.clash.b.name, row.clash.b.cat, row.clash.b.modelId,
      Math.round(row.low), Math.round(row.high), row.clash.precision, "Editable demo band × clash factor",
    ]),
  ];
}

function exportCsv(rows: PricedClash[]): void {
  const lines = reportValues(rows);
  const blob = new Blob([lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, "aec-nexus-clash-estimates.csv");
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let demoLoadPromise: Promise<void> | null = null;
let demoLoaded = false;

async function loadDemoModels(): Promise<void> {
  if (demoLoadPromise) return demoLoadPromise;
  if (demoLoaded) {
    await runElementClashDetection("all");
    render();
    return;
  }
  demoLoadPromise = (async () => {
  const files = await Promise.all(["nexus-structural.ifc", "nexus-mep.ifc"].map(async (name) => {
    const response = await fetch(`/samples/${name}`);
    if (!response.ok) throw new Error(`Could not load ${name}`);
    return new File([await response.arrayBuffer()], name, { type: "application/x-step" });
  }));
  for (const file of files) {
    const validation = await validateUploadedFile(file);
    if (!validation.valid || validation.kind !== "ifc") throw new Error("A demo IFC file failed validation.");
  }
  const before = ctx.fragments.list.size;
  loadIfcFiles(files);
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (ctx.fragments.list.size >= before + 2) break;
  }
  if (ctx.fragments.list.size >= before + 2) {
    demoLoaded = true;
    await runElementClashDetection("all");
    applyNexusSceneTheme();
    await ctx.world?.camera?.fitToItems?.();
  }
  render();
  })();
  try {
    await demoLoadPromise;
  } finally {
    demoLoadPromise = null;
  }
}

function showRevitDrawer(): void {
  rvtBackdrop.style.display = "flex";
  document.getElementById("nx-rvt-close")?.focus();
}

function closeRevitDrawer(): void {
  rvtBackdrop.style.display = "none";
}

function waitForIfcImport(): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(() => {
      window.removeEventListener("openbim:ifc-import-finished", done);
      resolve();
    }, 180000);
    window.addEventListener("openbim:ifc-import-finished", done, { once: true });
  });
}

async function handleServiceFiles(files: File[]): Promise<void> {
  const ifcFiles: File[] = [];
  const errors: string[] = [];
  let hasRevit = false;
  for (const file of files) {
    const validation = await validateUploadedFile(file);
    if (!validation.valid) errors.push(`${file.name}: ${validation.message}`);
    else if (validation.kind === "rvt") hasRevit = true;
    else if (validation.kind === "ifc") ifcFiles.push(file);
  }
  showFileMessage(errors.join(" "));
  if (hasRevit) showRevitDrawer();
  if (!ifcFiles.length) return;

  const before = ctx.fragments.list.size;
  const finished = waitForIfcImport();
  loadIfcFiles(ifcFiles);
  await finished;
  if (ctx.fragments.list.size > before) {
    await runElementClashDetection("all");
    applyNexusSceneTheme();
    render();
  }
}

function setupFileDrop(): void {
  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  let dragDepth = 0;
  const showDrop = () => { dropOverlay.style.display = "flex"; };
  const hideDrop = () => { dragDepth = 0; dropOverlay.style.display = "none"; };
  window.addEventListener("dragenter", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth++;
    showDrop();
  }, true);
  window.addEventListener("dragover", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    showDrop();
  }, true);
  window.addEventListener("dragleave", (event) => {
    if (!hasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) dropOverlay.style.display = "none";
  }, true);
  window.addEventListener("drop", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    hideDrop();
    void handleServiceFiles(Array.from(event.dataTransfer?.files ?? []));
  }, true);
}

function xmlText(value: unknown): string {
  return escapeHtml(String(value ?? "")).replace(/&#39;/g, "&apos;");
}

async function exportExcel(rows: PricedClash[]): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const values = reportValues(rows);
  const column = (index: number): string => {
    let value = index + 1;
    let label = "";
    while (value > 0) {
      value--;
      label = String.fromCharCode(65 + value % 26) + label;
      value = Math.floor(value / 26);
    }
    return label;
  };
  const sheetRows = values.map((line, rowIndex) => {
    const cells = line.map((value, columnIndex) => {
      const ref = `${column(columnIndex)}${rowIndex + 1}`;
      const safeValue = sanitizeSpreadsheetCell(value);
      if (typeof safeValue === "number") return `<c r="${ref}"><v>${safeValue}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlText(String(safeValue ?? ""))}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const summary = rows.filter((row) => row.status !== "resolved");
  const low = Math.round(summary.reduce((total, row) => total + row.low, 0));
  const high = Math.round(summary.reduce((total, row) => total + row.high, 0));
  const summaryRows = [
    ["AEC Nexus — clash cost summary"],
    ["Open clashes", summary.length],
    ["Low estimate (USD)", low],
    ["High estimate (USD)", high],
    ["Rate source", "Editable demo bands. Replace with project rates."],
  ].map((line, rowIndex) => `<row r="${rowIndex + 1}">${line.map((value, colIndex) => {
    const ref = `${column(colIndex)}${rowIndex + 1}`;
    const safeValue = sanitizeSpreadsheetCell(value);
    return typeof safeValue === "number" ? `<c r="${ref}"><v>${safeValue}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${xmlText(String(safeValue ?? ""))}</t></is></c>`;
  }).join("")}</row>`).join("");
  const sheet = (body: string, lastColumn: string, count: number) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData><autoFilter ref="A1:${lastColumn}${Math.max(1, count)}"/></worksheet>`;
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clash register" sheetId="1" r:id="rId1"/><sheet name="Summary" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", sheet(sheetRows, "N", values.length));
  zip.file("xl/worksheets/sheet2.xml", sheet(summaryRows, "B", 5));
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, "aec-nexus-clash-report.xlsx");
}

function printReport(rows: PricedClash[]): void {
  const openRows = rows.filter((row) => row.status !== "resolved");
  const low = openRows.reduce((total, row) => total + row.low, 0);
  const high = openRows.reduce((total, row) => total + row.high, 0);
  const body = rows.map((row) => `<tr><td>${escapeHtml(row.priority)}</td><td>${escapeHtml(row.clash.kind)}</td><td>${escapeHtml(row.pair)}</td><td>${escapeHtml(row.clash.a.name)}<small>${escapeHtml(row.clash.a.cat)}</small></td><td>${escapeHtml(row.clash.b.name)}<small>${escapeHtml(row.clash.b.cat)}</small></td><td>${money(row.low)} – ${money(row.high)}</td><td>${escapeHtml(row.status)}</td></tr>`).join("");
  const markup = `<!doctype html><html><head><meta charset="utf-8"><title>AEC Nexus clash report</title></head><body><header><div><h1>AEC Nexus · Clash cost report</h1><p>Editable estimate · ${new Date().toLocaleDateString()}</p></div><button id="nx-print-action">Print or save as PDF</button><button id="nx-print-close">Close</button></header><div class="summary"><div class="metric"><div class="label">Estimated exposure · USD</div><div class="value">${money(low)} – ${money(high)} <span class="label">ESTIMATE</span></div></div><div class="metric"><div class="label">Open clashes</div><div class="value">${openRows.length}</div></div><div class="metric"><div class="label">High priority</div><div class="value">${openRows.filter((row) => row.priority === "High").length}</div></div></div><table><thead><tr><th>Priority</th><th>Type</th><th>Discipline pair</th><th>Element A</th><th>Element B</th><th>Estimate</th><th>Status</th></tr></thead><tbody>${body || `<tr><td colspan="7">No clashes are available.</td></tr>`}</tbody></table><p>Editable benchmark estimates.</p></body></html>`;
  const parsed = new DOMParser().parseFromString(markup, "text/html");
  const printView = document.createElement("section");
  printView.id = "nx-print-view";
  printView.innerHTML = parsed.body.innerHTML;
  document.body.append(printView);
  printView.querySelector<HTMLButtonElement>("#nx-print-action")!.onclick = () => window.print();
  printView.querySelector<HTMLButtonElement>("#nx-print-close")!.onclick = () => printView.remove();
}

function renderRates(): string {
  const rows = (Object.keys(settings.bands) as PairKey[]).map((key) => {
    const band = settings.bands[key];
    return `<div class="nx-rate-row"><span>${escapeHtml(key.replace(" × ", " x "))}</span><input class="nx-input nx-data" data-rate="${escapeHtml(key)}" data-bound="low" type="number" min="0" max="10000000" value="${band.low}" aria-label="${escapeHtml(key)} low estimate"><input class="nx-input nx-data" data-rate="${escapeHtml(key)}" data-bound="high" type="number" min="0" max="10000000" value="${band.high}" aria-label="${escapeHtml(key)} high estimate"></div>`;
  }).join("");
  return `<section class="nx-section nx-rates"><div class="nx-rate-title"><h2>Editable estimate bands</h2><button id="nx-reset-rates" class="nx-reset-rates" type="button">Reset Defaults</button></div><div class="nx-rate-row nx-rate-head"><span>Discipline pair</span><span>Low (USD)</span><span>High (USD)</span></div>${rows}<p class="nx-note">Editable industry benchmark estimates.</p></section>`;
}

function render(): void {
  const rows = priceClashes();
  const openCount = rows.filter((row) => row.status !== "resolved").length;
  const highCount = rows.filter((row) => row.priority === "High" && row.status !== "resolved").length;
  const exposure = rows.filter((row) => row.status !== "resolved");
  const totalLow = exposure.reduce((sum, row) => sum + row.low, 0);
  const totalHigh = exposure.reduce((sum, row) => sum + row.high, 0);
  const pairTotals = new Map<PairKey, { count: number; low: number; high: number }>();
  for (const row of exposure) {
    const total = pairTotals.get(row.pair) ?? { count: 0, low: 0, high: 0 };
    total.count++;
    total.low += row.low;
    total.high += row.high;
    pairTotals.set(row.pair, total);
  }
  const matrix = [...pairTotals.entries()].sort((a, b) => b[1].high - a[1].high).map(([key, item]) => `
    <div class="nx-matrix-row"><span>${escapeHtml(key.replace(" × ", " x "))}</span><span class="nx-data">${item.count}</span><span class="nx-pair-cost">${money(item.low)} – ${money(item.high)}</span></div>`).join("") || `<div class="nx-empty">No clash data is available.</div>`;
  const visible = rows.filter((row) => filter === "high" ? row.priority === "High" : filter === "open" ? row.status !== "resolved" : true);
  const table = visible.length ? `<div class="nx-table-wrap"><table><thead><tr><th>Risk</th><th>Clash</th><th>Elements / IFC IDs</th><th>Estimate</th><th>Status</th></tr></thead><tbody>${visible.map((row) => `
    <tr data-clash-index="${row.index}" title="Focus this clash in the model" tabindex="0">
      <td><span class="nx-risk"><i class="nx-dot ${row.priority.toLowerCase()}"></i>${row.priority}</span></td>
      <td><span class="nx-element">${escapeHtml(row.pair.replace(" × ", " x "))}</span><div class="nx-small">${escapeHtml(row.clash.kind)}</div></td>
      <td><span class="nx-element">${escapeHtml(row.clash.a.name)} / ${escapeHtml(row.clash.b.name)}</span><div class="nx-id">${escapeHtml(row.clash.a.modelId)}:${escapeHtml(String(row.clash.a.localId))} · ${escapeHtml(row.clash.b.modelId)}:${escapeHtml(String(row.clash.b.localId))}</div></td>
      <td class="nx-money">${money(row.low)} – ${money(row.high)}</td><td>${escapeHtml(row.status)}</td>
    </tr>`).join("")}</tbody></table></div>` : `<div class="nx-empty">No clashes match this filter.</div>`;
  panel.innerHTML = `<div class="nx-wrap">
    <div class="nx-metrics">
      <article class="nx-card"><div class="nx-label">Estimated exposure <span class="nx-estimate">ESTIMATE</span></div><div class="nx-value">${money(totalLow)} – ${money(totalHigh)}</div><div class="nx-note">Open issues · USD</div></article>
      <article class="nx-card"><div class="nx-label">Open clashes</div><div class="nx-value nx-data">${openCount}</div><div class="nx-note">Resolved issues are excluded</div></article>
      <article class="nx-card"><div class="nx-label">High risk</div><div class="nx-value nx-data">${highCount}</div><div class="nx-note">Open structural intersections</div></article>
      <article class="nx-card"><div class="nx-label">Loaded models</div><div class="nx-value nx-data">${ctx.fragments.list.size}</div><div class="nx-note">IFC models in viewport</div></article>
    </div>
    <div class="nx-tabs" role="tablist" aria-label="Nexus views">
      <button class="nx-tab" role="tab" id="nx-tab-triage" aria-selected="${activeTab === "triage"}">Clash Triage</button>
      <button class="nx-tab" role="tab" id="nx-tab-matrix" aria-selected="${activeTab === "matrix"}">Matrix &amp; Rates</button>
    </div>
    ${activeTab === "triage" ? `<section class="nx-tab-panel" role="tabpanel" aria-labelledby="nx-tab-triage"><div class="nx-section"><div class="nx-list-head"><h2>Ranked clashes</h2>
      <button class="nx-filter" data-filter="all" data-active="${filter === "all" ? 1 : 0}">All</button><button class="nx-filter" data-filter="open" data-active="${filter === "open" ? 1 : 0}">Open</button><button class="nx-filter" data-filter="high" data-active="${filter === "high" ? 1 : 0}">High</button></div>${table}</div></section>`
      : `<section class="nx-tab-panel" role="tabpanel" aria-labelledby="nx-tab-matrix"><section class="nx-section"><h2>Discipline matrix</h2>${matrix}</section>${renderRates()}</section>`}
  </div>`;

  panel.querySelector<HTMLButtonElement>("#nx-tab-triage")!.onclick = () => { activeTab = "triage"; render(); };
  panel.querySelector<HTMLButtonElement>("#nx-tab-matrix")!.onclick = () => { activeTab = "matrix"; render(); };
  panel.querySelector<HTMLButtonElement>("#nx-reset-rates")?.addEventListener("click", () => {
    settings = structuredClone(DEFAULT_SETTINGS);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* local storage may be disabled */ }
    render();
  });
  panel.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.onclick = () => { filter = button.dataset.filter as typeof filter; render(); };
  });
  panel.querySelectorAll<HTMLInputElement>("[data-rate]").forEach((input) => {
    input.oninput = () => {
      const key = input.dataset.rate as PairKey;
      const bound = input.dataset.bound as keyof Band;
      const parsed = Number(input.value);
      if (!Number.isFinite(parsed)) return;
      const value = Math.min(10_000_000, Math.max(0, parsed));
      settings.bands[key][bound] = value;
      settings.bands[key].high = Math.max(settings.bands[key].low, settings.bands[key].high);
      persistSettings();
      render();
    };
  });
  panel.querySelectorAll<HTMLTableRowElement>("[data-clash-index]").forEach((row) => {
    row.onclick = async () => {
      const index = Number(row.dataset.clashIndex);
      await focusClashByIndex(index);
    };
  });
}

export function openNexusDashboard(): void {
  closeToolWindow("clash");
  closeToolWindow("import");
  isOpen = true;
  panel.style.display = "block";
  render();
}

export function closeNexusDashboard(): void {
  isOpen = false;
  panel.style.display = "none";
}

export function toggleNexusDashboard(): void {
  if (isOpen) closeNexusDashboard(); else openNexusDashboard();
}

function applyNexusSceneTheme(): void {
  const world = ctx.world;
  if (!world) return;
  const background = getComputedStyle(document.documentElement).getPropertyValue("--nx-bg").trim();
  world.scene.three.background = new THREE.Color(background);
  world.renderer.three.setClearColor(new THREE.Color(background), 1);
  world.renderer.needsUpdate = true;
}

export function setupNexusDashboard(): void {
  let navigationHint = document.getElementById("nx-nav-hint");
  if (!navigationHint) {
    navigationHint = document.createElement("div");
    navigationHint.id = "nx-nav-hint";
    navigationHint.textContent = "Drag: Orbit · Right-Drag: Pan · Scroll: Zoom · R: Reset";
    document.body.appendChild(navigationHint);
  }
  document.body.classList.add("aec-nexus-mode");
  try { applyNexusSceneTheme(); } catch { /* viewer may not be ready */ }
  try { (ctx as any).grid.visible = false; } catch { /* grid may not be ready */ }
  const viewport = document.getElementById("viewport");
  viewport?.parentElement?.classList.add("nx-app-shell");
  viewport?.previousElementSibling?.classList.add("nx-legacy-pane");
  isOpen = true;
  panel.style.display = "block";
  requestAnimationFrame(() => {
    ctx.world?.renderer?.resize?.();
    ctx.world?.camera?.updateAspect?.();
    try { applyNexusSceneTheme(); } catch { /* viewer may not be ready */ }
    void ctx.world?.camera?.fitToItems?.();
  });
  const count = document.getElementById("nx-model-count");
  const updateCount = () => { if (count) count.textContent = `${ctx.fragments.list.size} MODEL${ctx.fragments.list.size === 1 ? "" : "S"}`; };
  updateCount();
  window.setInterval(updateCount, 900);
  const fileInput = document.getElementById("nx-file-input") as HTMLInputElement;
  document.getElementById("nx-upload")!.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    if (fileInput.files?.length) void handleServiceFiles(Array.from(fileInput.files));
    fileInput.value = "";
  });
  document.getElementById("nx-load-demo")!.addEventListener("click", () => { void loadDemoModels(); });
  document.getElementById("nx-rvt-close")!.addEventListener("click", closeRevitDrawer);
  rvtBackdrop.addEventListener("click", (event) => {
    if (event.target === rvtBackdrop) closeRevitDrawer();
  });
  document.getElementById("nx-rvt-demo")!.addEventListener("click", () => {
    closeRevitDrawer();
    void loadDemoModels();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && rvtBackdrop.style.display === "flex") closeRevitDrawer();
  });
  setupFileDrop();
  document.getElementById("nx-export-excel")!.addEventListener("click", () => { void exportExcel(priceClashes()); });
  document.getElementById("nx-export-pdf")!.addEventListener("click", () => printReport(priceClashes()));
  document.getElementById("nx-run")!.addEventListener("click", async () => { await runElementClashDetection("all"); render(); });
  document.getElementById("nx-reset")!.addEventListener("click", () => {
    void ctx.world?.camera?.fitToItems?.();
  });
  document.querySelectorAll<HTMLButtonElement>("#nx-controls [data-discipline]").forEach((button) => {
    button.addEventListener("click", () => {
      const active = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(active));
      const structuralVisible = ["STR", "ARC"].some((key) => document.querySelector<HTMLButtonElement>(`[data-discipline="${key}"]`)?.getAttribute("aria-pressed") === "true");
      const mepVisible = document.querySelector<HTMLButtonElement>('[data-discipline="MEP"]')?.getAttribute("aria-pressed") === "true";
      for (const [id, model] of ctx.fragments.list) model.object.visible = /mep/i.test(id) ? mepVisible : structuralVisible;
      ctx.world?.renderer?.three?.render?.(ctx.world.scene.three, ctx.world.camera.three);
    });
  });
  window.addEventListener("openbim:clashes-updated", () => {
    render();
  });
  render();
  setupNexusSite({
    loadDemo: loadDemoModels,
    openRates: () => document.getElementById("nx-tab-matrix")?.click(),
  });
}
