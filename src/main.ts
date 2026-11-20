import { APP_VERSION } from "./version";
import "./styles/nexus-tokens.css";

/**
 * AEC Nexus — main entry point.
 * Local-first multi-discipline BIM clash triage and pre-construction cost modeling.
 */
import { setupViewer } from "./core/setup";
import { installEscapeAll } from "./core/escape-all";
import { setupInputRouter } from "./core/input-router";
import { setupCameraTools, computeSceneBounds } from "./features/camera-tools";
import { setupNavigation } from "./features/navigation";
import { setupImporter } from "./features/importer";
import { setupClash } from "./features/clash";
import { setupNexusDashboard } from "./features/nexus-dashboard";
import { ctx } from "./core/context";
import { installGlobalErrorHandlers, renderBootFailure } from "./core/errors";

// Install global error handlers before boot
installGlobalErrorHandlers();

const errOverlay = document.createElement("div");
errOverlay.style.cssText =
  "position:fixed;inset:auto 12px 12px 12px;z-index:99999;display:none;" +
  "background:#3b0d0d;color:#ffd7d7;border:1px solid #ef4444;border-radius:8px;" +
  "padding:10px 14px;font:12px/1.5 monospace;white-space:pre-wrap;max-height:45vh;overflow:auto";
document.body.appendChild(errOverlay);

const BENIGN = [
  /Fragments\s*:?\s*Model not found/i,
  /ResizeObserver loop/i,
  /Loading CSS chunk/i,
  /Script error\.?/i,
  /cancelled/i,
  /AbortError/i,
];

function isBenign(msg: string) {
  return BENIGN.some((re) => re.test(msg));
}

function showError(title: string, err: unknown) {
  const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
  if (isBenign(msg)) {
    console.warn(`[suppressed] ${title}: ${msg.split("\n")[0]}`);
    return;
  }
  console.error(`[AEC Nexus] ${title}`, err);
  errOverlay.style.display = "block";
  errOverlay.innerHTML = "";
  const pre = document.createElement("pre");
  pre.style.cssText = "margin:0;white-space:pre-wrap;font:inherit";
  pre.textContent = `[Error] ${title}\n${msg}`;
  const dismiss = document.createElement("button");
  dismiss.textContent = "Dismiss";
  dismiss.style.cssText =
    "margin-top:8px;background:#7f1d1d;color:#fecaca;border:1px solid #ef4444;" +
    "border-radius:6px;padding:4px 10px;cursor:pointer;font:12px system-ui";
  dismiss.onclick = () => {
    errOverlay.style.display = "none";
    errOverlay.innerHTML = "";
  };
  errOverlay.append(pre, dismiss);
}

window.addEventListener("error", (e) => {
  const msg = String(e.error?.message ?? e.message ?? "");
  if (isBenign(msg)) {
    e.preventDefault();
    return;
  }
  showError("Unhandled error", e.error ?? e.message);
});

window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
  const reason: any = e.reason;
  const msg =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
      ? reason
      : String(reason?.message ?? reason ?? "");
  if (isBenign(msg)) {
    console.warn("[suppressed benign] " + msg);
    e.preventDefault();
    return;
  }
  e.preventDefault();
  showError("Background task failed (app continues)", reason);
});

async function step(name: string, fn: () => unknown | Promise<unknown>) {
  try {
    await fn();
    console.log(`[AEC Nexus boot] OK ${name}`);
  } catch (err) {
    showError(`Step failed: ${name}`, err);
  }
}

await step("setupViewer", async () => {
  if (!document.getElementById("app")) {
    throw new Error('index.html has no <div id="app"> — check your HTML entry.');
  }
  try {
    await setupViewer();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isWorker = /worker|wasm|fragments/i.test(message);
    renderBootFailure({
      title: "AEC Nexus failed to start",
      message: "The 3D viewer could not initialize in your browser.",
      hint: isWorker
        ? "The Fragments worker failed to load. Check that web-ifc.wasm is reachable in your browser."
        : "Check browser console for stack trace.",
      details: err instanceof Error ? err.stack ?? message : message,
    });
    throw err;
  }
});

if (!ctx.world) {
  console.error("[AEC Nexus] Viewer failed to initialize — aborting remaining boot steps.");
  throw new Error("Boot aborted: viewer is not available.");
}

await step("escape-all", () => installEscapeAll());
await step("input-router", () => setupInputRouter());
await step("camera-tools", () => setupCameraTools());
await step("navigation", () => setupNavigation());
await step("importer", () => setupImporter());
await step("clash", () => setupClash());
await step("nexus-dashboard", () => setupNexusDashboard());

window.dispatchEvent(new Event("resize"));
computeSceneBounds();

console.log(`[AEC Nexus ${APP_VERSION}] ready`);

export type RootState = any;
export type AppDispatch = any;

void ctx;
