# SecureLayer Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - CamDetection MVP Implementation

### Added
- **File Confidentiality Classification:**
  - Added `confidentialityLevel` field to the `File` schema (`NORMAL`, `CONFIDENTIAL`, `HIGHLY_CONFIDENTIAL`).
  - Added `PATCH /api/files/:id/confidentiality` endpoint for owners/admins to update classifications.
  - Display confidentiality badges and selection dropdown in the Dashboard file list.

- **CamDetection Module (Frontend):**
  - **`CamConsentDialog.jsx`**: Explicit opt-in dialog shown before accessing `HIGHLY_CONFIDENTIAL` files, detailing privacy and capabilities.
  - **`useCamDetection.js`**: React hook managing webcam stream lifecycle, `MediaPipe` face detection, and `COCO-SSD` object detection.
  - **`riskEngine.js`**: Stateless, threshold-based inference engine that processes detection signals (face absence, multiple faces, phone presence) with temporal smoothing and hysteresis.
  - **`SecureFileViewer.jsx`**: Main viewer component orchestrating the document render, dynamic watermark, and camera-based security overlays.
  - **`SecurityOverlay.jsx`**: Opaque overlay that hides document contents during `HIGH` risk states or camera failures.
  - **`CamStatusBadge.jsx`**: Ambient risk level and detector health indicator.

- **CamDetection Auditing (Backend):**
  - Added 7 new `CamDetection`-specific event types to the `AuditLog` enum.
  - Added `POST /api/cam/audit` endpoint to record structured, server-validated risk events without trusting client-side authorization.
  - Added `camAudit.js` on the frontend to report events in a fire-and-forget manner.

- **Dynamic Watermarking:**
  - Implemented a repeating, diagonal SVG watermark overlay in the `SecureFileViewer`.
  - Watermark contains viewer's email, timestamp, and a confidentiality notice.
  - Uses a white fill with a dark stroke to ensure visibility across varying background colors.

- **Security & UI:**
  - Added global keyboard blockers (`Ctrl+P`, `Ctrl+S`) within the viewer.
  - Added a "Refresh" button to `AccessRequests` and `GlobalFiles` panels.
  - Replaced incompatible `MailOff` icon with `Bell`/`BellOff` for the email notifications toggle.

### Changed
- Updated `authController.updatePreferences` to use `User.findByIdAndUpdate` directly to resolve an issue with `req.user.save()` failing on lean Mongoose objects.
- Migrated the PDF viewer to `react-pdf` for HTML5 `<canvas>` rendering to prevent native browser PDF viewers from allowing downloads.
