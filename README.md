# AEC Nexus

AEC Nexus is a browser-based, local-first BIM coordination workspace designed to price building clashes before concrete is poured. It combines multi-discipline IFC model federation, accelerated spatial intersection detection, deterministic cost modeling, and executive audit report generation.

Zero install required. Models remain in client browser memory. Open architecture standards (IFC, BCF, IDS).

---

## Architecture Diagram

```
+-------------------------------------------------------------------------+
|                               Browser Client                             |
|                                                                         |
|  +--------------------+     +-------------------+     +--------------+  |
|  |  Revit IFC Export  | --> |  Drag-and-Drop    | --> |   ISO-10303  |  |
|  |  or C# Connector   |     |  Service Ingest   |     |  STEP Parser |  |
|  +--------------------+     +-------------------+     +--------------+  |
|                                                              |          |
|                                                              v          |
|  +-------------------------------------------------------------------+  |
|  |             Three.js WebGL + web-ifc WebAssembly Engine            |  |
|  |                                                                   |  |
|  |  +----------------------+             +------------------------+  |  |
|  |  |  Spatial Index Tree  | ----------> | Dedicated Web Worker   |  |  |
|  |  |  (BVH Accelerators)  |             | (0.005m Tolerance)     |  |  |
|  |  +----------------------+             +------------------------+  |  |
|  |                                                   |               |  |
|  |                                                   v               |  |
|  |  +-------------------------------------------------------------+  |  |
|  |  |               Discipline Categorization Engine              |  |  |
|  |  |            Structure (STR) · Mechanical (MEP) · ARC         |  |  |
|  |  +-------------------------------------------------------------+  |  |
|  +-------------------------------------------------------------------+  |
|                                  |                                      |
|                                  v                                      |
|  +-------------------------------------------------------------------+  |
|  |                 Deterministic Financial Triage Matrix              |  |
|  |          Discipline Rate Schedule × Severity Multipliers           |  |
|  +-------------------------------------------------------------------+  |
|              |                                           |              |
|              v                                           v              |
|  +------------------------+                 +------------------------+  |
|  |  Excel (.xlsx) Export  |                 |   PDF Executive Brief  |  |
|  |  Formula-Sanitized     |                 |   Print-Ready Audit    |  |
|  +------------------------+                 +------------------------+  |
+-------------------------------------------------------------------------+
```

---

## Deterministic Cost Model

AEC Nexus computes clash risk ranges using baseline discipline pair rate schedules combined with geometric severity factors.

```
Clash Cost Range = (Discipline Rate Band) × (Severity Factor) × (Clash Count)
```

### Severity Multipliers

| Clash Type | Factor | Description |
|---|---|---|
| Hard Intersect | 1.00× | Direct volumetric intersection requiring field rework or redesign |
| Duplicate Element | 0.70× | Duplicate modeled geometry leading to double-counting and material waste |
| Touching | 0.55× | Direct surface contact violating clearance or insulation envelopes |
| Clearance Violation | 0.30× | Soft spatial violation impacting maintenance access or tolerance zones |

### Baseline Discipline Rate Bands

| Discipline Pair | CSI MasterFormat | Baseline Low (USD) | Baseline High (USD) |
|---|---|---|---|
| Structure × MEP | CSI 03-23-01 | $2,500 | $14,000 |
| Structure × Structure | CSI 03-30-00 | $500 | $3,000 |
| MEP × MEP | CSI 23-05-93 | $700 | $4,500 |
| Architecture × MEP | CSI 07-84-13 | $1,200 | $6,500 |
| Architecture × Structure | CSI 03-30-00 | $900 | $5,500 |
| Other Combinations | CSI 01-31-00 | $500 | $3,000 |

All rate bands can be customized and calibrated directly inside the Matrix & Rates tab.

---

## Security Model

1. **Local-First Boundary**:
   - 100% client-side memory execution.
   - Zero model geometry, metadata, or telemetry sent to remote servers.
   - Zero external tracking scripts.

2. **File Ingestion Security**:
   - Strict file type allowlist (`.ifc` and `.rvt`).
   - 100 MB per-file memory safety ceiling.
   - Header inspection: Validates ISO-10303-21 signature in the first 128 bytes before invoking WebAssembly parsers.
   - Safe `.rvt` routing: Proprietary binary RVT files are rejected from raw parsing and routed cleanly to the workflow guide modal.

3. **Spreadsheet Formula Injection Defense**:
   - Cells in `.xlsx` and `.csv` exports starting with `=`, `+`, `-`, `@`, `\t`, or `\r` are sanitized with single-quote prefixing (`'`).

4. **DOM Cross-Site Scripting (XSS) Mitigation**:
   - All dynamic IFC entity strings, user inputs, and rate keys pass through HTML entity escaping before rendering into the DOM or printable audit sheets.

5. **Security Headers**:
   - Strict Content Security Policy allowing only `self`, WebAssembly eval, blob workers, and Google Fonts.
   - `X-Content-Type-Options: nosniff` enabled.
   - `Referrer-Policy: no-referrer` enabled.

---

## Quick Start

### Requirements
- Node.js 20 or newer
- Modern web browser (Chrome, Edge, Firefox, Safari)

### Installation and Launch

```bash
# Clone the repository
git clone https://github.com/amdghedy/openBIMstudio.git
cd openBIMstudio

# Install dependencies
npm install

# Start development server
npm run dev
```

Open `http://localhost:3000` in your web browser.

### Production Build and Preview

```bash
# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Autodesk Revit Integration

AEC Nexus supports two integration workflows with Autodesk Revit:

1. **Immediate Workflow (Available Now)**:
   - In Revit, go to **File -> Export -> IFC**.
   - Select IFC2x3 Coordination View 2.0 or IFC4.
   - Drag and drop exported `.ifc` files directly into the AEC Nexus viewport.

2. **Planned Plugin Architecture (In Specification)**:
   - C# Revit Ribbon Add-in for 1-click model synchronization.
   - Autodesk Platform Services (APS) cloud translation connector.
   - Technical specification available in `docs/REVIT_PLUGIN_SPEC.md`.

---

## Roadmap

- **Phase 1: Precision Triage (Current)**:
  - Multi-discipline IFC federation and BVH collision detection.
  - Interactive cost simulation and editable rate schedules.
  - Formula-sanitized Excel and PDF audit export.

- **Phase 2: Native Revit Add-in**:
  - Direct Revit 2024/2025 C# ribbon integration.
  - Two-way BCF issue exchange and element selection sync.

- **Phase 3: Extended Trade Catalogs**:
  - Regional cost schedules (UK NRM, EU DIN 276, US RSMeans).
  - Embodied carbon calculation per clash resolution.

---

## License

MIT License. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.
