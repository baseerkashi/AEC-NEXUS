export type NexusRateKey =
  | "Architecture × MEP"
  | "Structure × MEP"
  | "MEP × MEP"
  | "Architecture × Structure"
  | "Other";

export interface NexusRateBand { low: number; high: number }
export interface NexusRateTable { bands: Record<NexusRateKey, NexusRateBand> }

export const DEFAULT_RATE_TABLE: NexusRateTable = {
  bands: {
    "Architecture × MEP": { low: 1200, high: 6500 },
    "Structure × MEP": { low: 2500, high: 14000 },
    "MEP × MEP": { low: 700, high: 4500 },
    "Architecture × Structure": { low: 900, high: 5500 },
    Other: { low: 500, high: 3000 },
  },
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[char]!);
}

export function sanitizeSpreadsheetCell(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export type UploadedFileResult =
  | { valid: true; kind: "ifc" | "rvt" }
  | { valid: false; message: string };

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const STEP_HEADER = "ISO-10303-21;";

export async function validateUploadedFile(file: File): Promise<UploadedFileResult> {
  if (file.size > MAX_FILE_BYTES) {
    return { valid: false, message: "File exceeds the 100 MB limit." };
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (extension === ".rvt") return { valid: true, kind: "rvt" };
  if (extension !== ".ifc") {
    return { valid: false, message: "Use an .ifc file. RVT files open the Revit workflow guide." };
  }
  const header = new TextDecoder().decode(await file.slice(0, 128).arrayBuffer());
  if (!header.trimStart().startsWith(STEP_HEADER)) {
    return { valid: false, message: "This IFC file has no valid ISO-10303-21 header." };
  }
  return { valid: true, kind: "ifc" };
}

const RATE_KEYS: NexusRateKey[] = [
  "Architecture × MEP", "Structure × MEP", "MEP × MEP", "Architecture × Structure", "Other",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateRateTable(raw: unknown): NexusRateTable {
  const fallback = (): NexusRateTable => structuredClone(DEFAULT_RATE_TABLE);
  if (!isRecord(raw) || Object.keys(raw).length !== 1 || !isRecord(raw.bands)) return fallback();
  const bands = raw.bands;
  const valid: Partial<Record<NexusRateKey, NexusRateBand>> = {};
  for (const key of RATE_KEYS) {
    const band = bands[key];
    if (!isRecord(band) || Object.keys(band).length !== 2 || !("low" in band) || !("high" in band)) return fallback();
    const { low, high } = band;
    if (typeof low !== "number" || typeof high !== "number"
      || !Number.isFinite(low) || !Number.isFinite(high)
      || low < 0 || high < 0 || low > 10_000_000 || high > 10_000_000 || low > high) {
      return fallback();
    }
    valid[key] = { low, high };
  }
  if (Object.keys(bands).length !== RATE_KEYS.length) return fallback();
  return { bands: valid as Record<NexusRateKey, NexusRateBand> };
}
