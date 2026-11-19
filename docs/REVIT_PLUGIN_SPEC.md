# AEC Nexus Revit Connector

Status: Planned. The current browser app does not read RVT files.

## Architecture

1. Build a signed C# Revit Add-in for supported Revit versions.
2. Read element IDs, categories, disciplines, transforms, and shared coordinates.
3. Export the model as IFC. Preserve element IDs and property data.
4. Send IFC and a JSON manifest to the Nexus Ingest API.
5. Use Autodesk APS when cloud translation or cloud storage is required.
6. APS stores the RVT, creates an IFC derivative, and reports job status.
7. The Ingest API validates the upload and creates a model version.
8. A Nexus worker converts IFC through the existing web-ifc pipeline.
9. The worker sends geometry and metadata to the clash engine.
10. The engine returns clash pairs, element IDs, and clash types.
11. The cost service applies editable discipline-pair rate bands.
12. The workspace receives model status, clash results, and cost ranges.

## Upload Contract

- Use `POST /api/nexus/v1/models` to create a model version.
- Return a short-lived upload URL and a model version ID.
- Upload IFC and manifest through the signed URL.
- Use `POST /api/nexus/v1/models/{id}/complete` after upload.
- Include source version, Revit version, coordinate system, and units.
- Include each element's stable ID, category, discipline, and transform.
- Include geometry in IFC. Do not send Revit-only binary geometry.
- Return validation errors before starting clash analysis.

## Security and Results

- Keep Autodesk credentials on the connector or API server.
- Use OAuth with the least required scopes for APS access.
- Encrypt uploads in transit and at rest.
- Keep model versions isolated by project and workspace.
- Record upload, conversion, analysis, and deletion events.
- Show conversion errors and source model IDs in the workspace.
- Mark all cost values as editable estimates.
- Require user action before replacing an existing model version.
