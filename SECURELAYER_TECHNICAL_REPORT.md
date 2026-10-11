# SecureLayer: Comprehensive Architectural & Technical Report

---

## Executive Project Overview

**SecureLayer** is a zero-trust, privacy-first digital rights management and secure document distribution platform. Its primary objective is to eliminate document leakage, unauthorized snooping, and visual data exfiltration (such as photographing screens with mobile phones or shoulder-surfing).

The architecture is divided into four tightly coordinated pillars:
1. **Access Request & Single-Use Allowance Architecture** (Zero-trust document discovery and single-consumption viewing permissions)
2. **Frontend Secure File Viewing Module** (Forensic watermarking, anti-screenshot/print blocking, and isolated in-memory rendering)
3. **Computer Vision CamDetection Threat Mitigation Module** (Browser-based Edge AI tracking user presence, shoulder-surfers, and recording devices)
4. **Hardened Backend Architecture** (Passwordless cryptographic OTP, token rotation, multi-tier rate limiting, AES-256-GCM authenticated encryption, and immutable audit logging)

```
+-------------------------------------------------------------------------------+
|                        CLIENT BROWSER (React + Edge AI)                       |
|                                                                               |
|   +-----------------------+     +--------------------+                        |
|   | Global Directory & UI | --> |   View File Call   |                        |
|   +-----------------------+     +---------+----------+                        |
|                                           | (Auth Session Header)             |
|                                           v                                   |
|   +--------------------------------------------------+                        |
|   | SecureFileViewer (Canvas / In-Memory Decryption) |                        |
|   +--------------------------------------------------+                        |
|        ^                           ^                                          |
|        | (Forensic Stamp)          | (Opaque Shield on Threat)                |
|   +----+---------------+      +----+------------------+                       |
|   | Dynamic SVG        |      | SecurityOverlay       |                       |
|   | Watermark Layer    |      | (Blocking Modal)      |                       |
|   +--------------------+      +----+------------------+                       |
|                                    ^                                          |
|                                    | (Schmitt Trigger Lock)                   |
|   +--------------------------------+-----------------+                        |
|   | Risk Engine (Temporal Smoothing & Hysteresis)    |                        |
|   +--------------------------------+-----------------+                        |
|                                    ^                                          |
|           +------------------------+------------------------+                 |
|           |                                                 |                 |
|   +-------+--------------------+            +---------------+---------------+ |
|   | MediaPipe BlazeFace        |            | TensorFlow COCO-SSD           | |
|   | (~6 FPS Face Detection)    |            | (~6 FPS Object / Phone)       | |
|   +----------------------------+            +-------------------------------+ |
+-------------------------------------------------------------------------------+
                                    |
                         (REST API / HttpOnly Cookie)
                                    v
+-------------------------------------------------------------------------------+
|                       BACKEND GATEWAY (Node.js / Express)                     |
|                                                                               |
|   +--------------------+      +-------------------+      +----------------+   |
|   | Helmet CSP / CORS  | ---> | Tiered Rate Limit | ---> | JWT & RBAC     |   |
|   +--------------------+      +-------------------+      +--------+-------+   |
|                                                                   |           |
|                                                                   v           |
|   +--------------------+      +-------------------+      +--------+-------+   |
|   | Private UUID Disk  | <--- | AES-256-GCM       | <--- | Single-Use     |   |
|   | Storage Layer      |      | Decryption Stream |      | Expiry Guard   |   |
|   +--------------------+      +-------------------+      +----------------+   |
|                                                                   |           |
|                                                                   v           |
|                                                          +----------------+   |
|                                                          | Immutable Audit|   |
|                                                          | Log (MongoDB)  |   |
|                                                          +----------------+   |
+-------------------------------------------------------------------------------+
```

---

## 1. Access Request & Allowance Architecture

The sharing architecture of SecureLayer follows a **Zero-Trust, One-Time Allowance** principle. Unlike traditional platforms where sharing creates persistent permissions or public URLs, SecureLayer treats every access grant to another user's file as ephemeral and consumable.

### 1.1 The Global Directory Discovery Model
* **Isolated Visibility:** Through the Global Directory (`GlobalFiles.jsx`), users can view metadata of documents uploaded across the organization without having access to their decrypted contents.
* **Metadata Filtering:** The backend (`shareController.getGlobalFiles`) filters out the user's own files and returns only safe metadata: filename, MIME type, size, creation date, owner email, file confidentiality rating, and the current user's existing request status (`PENDING`, `APPROVED`, `DENIED`, or `EXPIRED`). All internal storage keys and encryption parameters are strictly stripped.

### 1.2 Access Request Lifecycle
* **Request Submission:** When a user requests access (`shareController.requestAccess`), the system verifies the file exists and confirms the requester is not the file owner.
* **State Transition:** The request is recorded in the database (`FileAccessRequest`) with a `PENDING` status. If a previous request was denied or expired, the user can re-request access, resetting the status back to `PENDING`.
* **Owner Notification:** When a request is logged, an automated notification is dispatched to the file owner via the notification provider (`emailProvider.sendAccessRequestEmail`), detailing the requester's identity and the document name. The owner can opt out of email alerts via their dashboard preferences.
* **Audit Trail:** Every access request generates a `FILE_ACCESS_REQUESTED` audit log with the client's IP address and User-Agent.

### 1.3 Approval & Denial Workflow
* **Owner Inbox:** The file owner accesses incoming requests via `AccessRequests.jsx` powered by `shareController.getIncomingRequests`.
* **Owner-Authorized Grant:** Only the true owner of a file (or a system administrator) can approve or deny a request.
* **Instant Delivery Notification:** Upon approval (`shareController.approveRequest`), the requester receives an email informing them that the document is unlocked for viewing.

### 1.4 Single-Use (One-Time) Allowance Enforcement
* **Server-Side Revocation on Stream:** This is one of the most critical security features in the project. When the authorized user clicks to view the file (`fileController.getFile`), the server verifies the `APPROVED` record, reads and decrypts the file, and streams it to the client. Immediately after sending the decrypted payload, the server updates the request status to `EXPIRED`.
* **Prevention of Replay Attacks:** If the user refreshes the page, attempts to fetch the document again, or reuses their network session token, the endpoint returns a `403 Forbidden` error because the approval has already been consumed.
* **Optimistic UI Invalidation:** The frontend immediately flags the item as `EXPIRED` in memory once the viewing stream begins, preventing double-clicks and confusing UI states.

---

## 2. Frontend Secure File Viewing Module

The viewing module (`SecureFileViewer.jsx`) prevents documents from being copied, downloaded, printed, or inspected once decrypted.

### 2.1 Dynamic In-Memory Rendering Architecture
* **Direct-to-Memory Decryption:** Files are requested with binary blob responses using authenticated session headers. They are never written to disk or the browser cache.
* **Canvas-Isolated PDF Rendering:** SecureLayer uses `react-pdf` to convert PDF pages into pure HTML5 `<canvas>` elements.
  * **Text Layer Disabled:** The text selection layer is completely disabled. Users cannot drag, highlight, select, or copy text strings out of the viewer.
  * **Annotation Layer Disabled:** External hyperlinks, form inputs, and interactive widgets are stripped, preventing embedded URL phishing or data leakage.
* **Image Shielding:** For image files (PNG, JPEG), images are rendered with drag-and-drop and user-selection turned off, preventing users from dragging images into another tab or their desktop.
* **Ephemeral Object URL Lifecycle:** When a document is loaded, a temporary local blob URL is generated. The moment the viewer modal is closed or unmounted, the application explicitly revokes the object URL via `URL.revokeObjectURL()`, freeing memory and destroying the local reference.

### 2.2 Forensic Dynamic Watermarking
* **SVG Matrix Overlay:** The viewer superimposes an unclickable, high z-index repeating SVG watermark overlay across the entire document area.
* **Forensic Metadata:** The watermark prints two pieces of provenance data rotated at a -30-degree angle across the screen:
  1. The authenticated user’s exact email address.
  2. The exact local timestamp (date, hour, minute, second) when the file was opened.
* **High-Contrast Readability:** The SVG uses a semi-transparent white fill combined with a contrasting dark outline stroke. This ensures the watermark remains legible whether the underlying document is dark-themed, white paper, or photographic.
* **Tamper Resistance:** The overlay has non-interactive pointer properties, so scrolling and navigation pass through smoothly while ensuring the watermark cannot be highlighted or deleted via browser element inspection.

### 2.3 Exfiltration Prevention & Browser Hardening
* **Context Menu Lockdown:** Right-clicking is intercepted and suppressed across the entire viewport, disabling "Save Image As", "Inspect Element", and "Print".
* **Keyboard Shortcut Interception:** Global keydown listeners intercept and block standard exfiltration shortcuts:
  * `Ctrl + P` / `Cmd + P` (Print / Save as PDF)
  * `Ctrl + S` / `Cmd + S` (Save Page / Save Document)
  * `F12` and `Ctrl + Shift + I` / `Cmd + Option + I` (Developer Tools)
* **Visual Isolation:** The viewer renders as a full-screen fixed modal with a near-opaque backdrop and heavy background blur, shielding any background dashboard information from screen capture.
* **One-Time Session Footer:** A security banner warns the user that their current session is monitored, single-use, and that screen captures violate security policies.

---

## 3. Computer Vision CamDetection Threat Mitigation Module

When a document is classified as `HIGHLY_CONFIDENTIAL`, SecureLayer activates **CamDetection** (`useCamDetection.js` and `riskEngine.js`). This browser-native, Edge AI computer vision engine monitors the user's physical viewing environment for visual security risks.

```
+-------------------------------------------------------------------------------+
|                       CAMDETECTION STATE MACHINE                              |
|                                                                               |
|   [Idle]                                                                      |
|     |                                                                         |
|     v (User opens HIGHLY_CONFIDENTIAL file)                                   |
|   [CamConsentDialog]                                                          |
|     |                                                                         |
|     +---> (User Declines) ----> [Viewer Closed]                               |
|     |                                                                         |
|     +---> (User Consents)                                                     |
|             |                                                                 |
|             v                                                                 |
|   [Initializing WebAssembly / GPU Models]                                     |
|             |                                                                 |
|             +---> (Failure) ---> [Error State / View Blocked]                 |
|             |                                                                 |
|             +---> (Success)                                                   |
|                     |                                                         |
|                     v                                                         |
|   +---------------------------------------------------------+                 |
|   |                     RUNNING STATE                       |                 |
|   |                                                         |                 |
|   |   +---------------------+     Threat Discovered         |                 |
|   |   | LOW RISK (Normal)   | ------------------------+     |                 |
|   |   +---------------------+                         |     |                 |
|   |              ^                                    v     |                 |
|   |              | Schmitt Trigger Lock         +---------+ |                 |
|   |              | (Persistence Drops to 0)     | HIGH    | |                 |
|   |              +----------------------------- | RISK    | |                 |
|   |                                             +---------+ |                 |
|   |                                                  |      |                 |
|   +--------------------------------------------------+------+                 |
|                                                      |                        |
|                                                      v                        |
|                                      [SecurityOverlay Opaque Shield]          |
|                                      (Document Canvas Obscured)               |
+-------------------------------------------------------------------------------+
```

### 3.1 Edge AI & Privacy-First Architecture
* **Zero Video Streaming:** All machine learning inference runs 100% locally on the client's GPU/CPU using WebAssembly and WebGL. **Zero camera frames, video feeds, or biometric facial templates ever leave the device.**
* **Anonymous Telemetry:** The only data transmitted to the backend audit log is high-level event strings (e.g., `CAMDETECTION_HIGH_RISK`, `PHONE_DETECTED`).

### 3.2 Machine Learning Models & Ingestion Pipeline
1. **Face Detection Engine:**
   * **Framework:** Google MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) WebAssembly runtime.
   * **Model Architecture:** BlazeFace Short-Range, a lightweight Single Shot MultiBox Detector (SSD) optimized for web and mobile GPUs.
   * **Purpose:** Locates face bounding boxes in the webcam feed. It does not perform facial recognition (who the person is), only facial presence (how many human faces are in front of the screen).
   * **Inference Rate:** Runs on a dedicated interval loop at approximately 6 frames per second (150 ms).
2. **Object & Device Detection Engine:**
   * **Framework:** TensorFlow.js (`@tensorflow/tfjs`) with `@tensorflow-models/coco-ssd`.
   * **Model Architecture:** MobileNetV2 (`lite_mobilenet_v2`) paired with an SSD detection head.
   * **Target Class Filtering:** Rather than evaluating all 80 COCO categories, SecureLayer strictly filters for recording-capable hardware: `['cell phone', 'remote', 'laptop', 'tablet']`.
   * **Tuned Confidence Threshold:** Object confidence is calibrated down to **20% (0.20)**. Because low-power webcam frames are often motion-blurred or poorly lit, this aggressive threshold ensures high sensitivity to phones being quickly raised toward the screen.

### 3.3 Detection Vectors & Threat Scenarios
The module monitors three primary physical security threats:
1. **Primary User Absence (`FACE_ABSENT`):** The authorized user steps away from their computer, leaving confidential data exposed to passersby.
2. **Shoulder-Surfing / Multiple Faces (`MULTIPLE_FACES`):** An unauthorized secondary individual looks at the screen alongside the user.
3. **Recording Devices (`PHONE_DETECTED`):** A smartphone, camera, or tablet is aimed at the display to photograph or record confidential material.

### 3.4 Algorithmic Risk Engine (`riskEngine.js`)
Raw computer vision inferences frequently experience single-frame flickers (e.g., a phone drops from 21% confidence to 19% for a split second). If the system reacted to individual frames, the screen shield would strobe uncontrollably. SecureLayer solves this with a two-part stabilization engine:

#### A. Temporal Frame Persistence
A threat must persist across consecutive frames before it is validated:
* **Phone / Recording Device:** Requires **2 consecutive positive frames** (~300 ms).
* **Multiple Faces:** Requires **3 consecutive positive frames** (~450 ms).
* **Face Absence:** Requires **8 consecutive negative frames** (~1.2 seconds), allowing the user to sneeze, glance down, or adjust their posture without triggering a false alarm.

#### B. The "Schmitt Trigger" Hysteresis Lock
Once a threat triggers a `HIGH` risk state and locks the screen, recovery requires an asymmetric return to safety:
* When a phone is lowered, the frame persistence counter decrements slowly frame by frame.
* The screen remains locked until the persistence counter drops all the way back to **0**.
* Risk scores apply hysteresis boundaries: shifting from `LOW` to `HIGH` requires a score of 60+, but dropping back down requires falling well below the entry threshold.

### 3.5 UI Shielding & Hardware Integration
* **`CamConsentDialog`:** Before the webcam is powered on, the user is presented with a clear privacy modal explaining why the camera is required, that no video is recorded, and what threats are monitored. Access is paused until explicit consent is given.
* **`SecurityOverlay`:** When risk reaches `HIGH` or the detector becomes unavailable, this component instantly covers the viewport with an opaque, blurred shield (`rgba(30, 0, 0, 0.97)`), completely blocking the document canvas from sight while keeping viewer state intact.
* **Browser Video Optimization:** Browsers often pause or throttle video elements with `display: none`. SecureLayer circumvents this by sizing the feed to `640x480` and styling it with `opacity: 0.001` and `pointer-events: none`. This keeps GPU video pipelines running smoothly in the background.
* **Developer HUD:** In development mode, an ambient on-screen HUD displays real-time inference latency (in milliseconds), live risk scores (0–100), active triggers, and detected object classes.

---

## 4. Backend Architecture: Authentication, Security & Storage

The backend is built as a zero-trust, layered Express application backed by MongoDB, strictly enforcing security across every inbound request.

```
+-------------------------------------------------------------------------------+
|                        BACKEND SECURITY INGRESS & PIPELINE                    |
|                                                                               |
|   1. INGRESS SECURITY HEADERS                                                 |
|      - Helmet: Restrictive Content Security Policy (CSP)                      |
|      - HSTS: 1-Year Max-Age, Subdomains Included, Preload                      |
|      - Cross-Origin Isolation & MIME-Sniffing Prevention                      |
|                                                                               |
|   2. CORS VALIDATION                                                          |
|      - Strict origin allowlist (Frontend origin, localhost:5173, etc.)        |
|      - Rejection of wildcard (*) origins for authenticated sessions           |
|                                                                               |
|   3. LAYERED RATE LIMITERS                                                    |
|      - Global API: 100 requests / 15 minutes / IP                             |
|      - OTP Request: 3 requests / 1 hour / normalized email                    |
|      - Auth Verify: 20 attempts / 15 minutes / IP                             |
|                                                                               |
|   4. PASSWORDLESS CRYPTOGRAPHIC AUTHENTICATION                                |
|      - 6-digit CSPRNG OTP generation                                          |
|      - Bcrypt hashing (10 rounds) before DB persistence                       |
|      - 5-minute TTL auto-expiration; max 5 attempts before self-deletion      |
|                                                                               |
|   5. DUAL-TOKEN LIFECYCLE & ROTATION                                          |
|      - Short-lived Access JWT (15 min) in client memory (no localStorage)     |
|      - Opaque 64-byte Refresh Token in HttpOnly, SameSite=Strict cookie       |
|      - SHA-256 hashed storage in DB; full rotation on every refresh call      |
|                                                                               |
|   6. ROLE-BASED ACCESS CONTROL (RBAC) & AUTHORIZATION                         |
|      - USER: file.read, file.upload, file.download, file.delete.own           |
|      - ADMIN: file.*, user.read, user.manage, audit.read                      |
|      - Resource-level ownership checks on all private document endpoints      |
|                                                                               |
|   7. MILITARY-GRADE ENCRYPTED STORAGE (AES-256-GCM)                           |
|      - 256-bit Master Key loaded strictly from environment memory             |
|      - Unique 12-byte IV generated per file upload                            |
|      - 16-byte GCM Authentication Tag verifying ciphertext integrity          |
|      - Path-traversal proof: UUID keys (uuid.enc) in private storage folder   |
|                                                                               |
|   8. IMMUTABLE AUDIT LOGGING                                                  |
|      - Append-only collection in MongoDB (AuditLog)                           |
|      - Logs who, what, when, IP address, user-agent, and status               |
|      - Zero passwords, OTPs, or encryption keys ever logged                   |
+-------------------------------------------------------------------------------+
```

### 4.1 Passwordless Cryptographic Authentication Pipeline
SecureLayer removes traditional passwords, eliminating credential-stuffing and database rainbow table attacks:
* **Cryptographic OTP Generation:** OTPs are generated using a Cryptographically Secure Pseudorandom Number Generator (CSPRNG via `crypto.randomInt`), producing an unpredictable 6-digit number.
* **Bcrypt Storage Hashing:** Plaintext OTPs are never stored in the database. SecureLayer hashes them using Bcrypt (10 rounds) before saving them to MongoDB (`OTPVerification`).
* **Strict Expiration & Attempt Throttling:**
  * OTPs expire after 5 minutes (enforced via database Time-To-Live auto-deletion indexes).
  * A maximum of 5 verification attempts are allowed per OTP. Exceeding this instantly deletes the record.
  * Successful verification deletes the OTP immediately (single-use guarantee).
* **Decoupled Delivery Provider:** The email service (`emailProvider.js`) is injected via an abstract interface, allowing easy switching between SMTP, Ethereal test mailers, or third-party SMS APIs without modifying core authentication logic.

### 4.2 Dual-Token Session Architecture & Rotation
* **Access Tokens:** Short-lived JSON Web Tokens (15 minutes) signed with `HS256`. Stored strictly in client memory (React application state), shielding them from persistent XSS storage harvesting.
* **Refresh Tokens:** Long-lived (7-day), opaque 64-byte cryptographically random strings stored in database records (`RefreshToken`) as SHA-256 hashes.
* **HttpOnly Cookie Delivery:** Refresh tokens are delivered in cookies configured with:
  * `HttpOnly = true` (inaccessible to JavaScript)
  * `SameSite = strict` (prevents Cross-Site Request Forgery)
  * `Secure = true` in production (enforces HTTPS)
  * `Path = /api/auth` (limits cookie transmission strictly to auth routes)
* **Automatic Token Rotation:** Every time `/api/auth/refresh` is called, the old refresh token is revoked and an entirely new refresh token is issued. If a compromised refresh token is reused, the rotation mismatch invalidates the session chain.
* **Account Revocation Check:** When verifying access tokens (`auth.js`), the middleware re-verifies user status against the live database, ensuring deactivated users are booted immediately mid-session.

### 4.3 Multi-Tiered Rate Limiting Strategy
Rate limits are applied across different risk levels (`rateLimiter.js`):
1. **Global API Limiter:** Limits general endpoints to 100 requests per 15-minute window per IP to stop scrapers and traffic floods.
2. **OTP Generation Limiter:** Enforces a strict ceiling of **3 OTP requests per hour**, keyed specifically by normalized email address (`otp:user@example.com`). This stops email bombing and SMS spamming costs.
3. **Authentication Verification Limiter:** Restricts login/verification attempts to **20 requests per 15 minutes** per IP, preventing brute-force code guessing.

### 4.4 Role-Based Access Control (RBAC)
* **Centralized Permission Matrix:** Permissions are defined centrally in `rbacDefinitions.js` rather than scattered as inline strings:
  * `USER`: Standard capabilities (`file.read`, `file.upload`, `file.download`, `file.delete.own`).
  * `ADMIN`: Elevated administrative control (`user.manage`, `file.share`, `file.delete`, `audit.read`).
* **Server-Side Enforcement:** Frontend checks are strictly cosmetic. Every route enforces permissions via the `requirePermission` middleware.
* **Resource-Level Authorization:** In addition to role permissions, resource controllers verify ownership: regular users can only interact with files they own or files with explicit, valid access approvals.

### 4.5 Military-Grade AES-256-GCM Envelope Encryption
All files are encrypted before touching disk storage (`encryptionService.js`):
* **Algorithm:** Advanced Encryption Standard in Galois/Counter Mode (`aes-256-gcm`).
* **Unique IV per File:** A fresh 12-byte (96-bit) Initialization Vector (IV) is generated via CSPRNG for every single upload. An IV is never reused with the master key.
* **Cryptographic Authentication Tag:** Each encryption generates a 16-byte (128-bit) GCM authentication tag. During decryption, the tag verifies the ciphertext's integrity; if a single byte has been modified or corrupted on disk, decryption immediately aborts.
* **Master Key Isolation:** The 256-bit encryption key is loaded strictly from environment variables at startup and is never stored in database records.
* **Path-Traversal-Proof Storage:** Encrypted payloads are saved under UUID filenames (`<uuid>.enc`) inside private folders. Original filenames are never used in filesystem paths, completely eliminating directory traversal attacks (`storageService.js`).

### 4.6 HTTP Header Hardening & Global Error Handling
* **Helmet Security Suite:** Configures a restrictive Content Security Policy (CSP), turns off cross-origin embedding, enables HTTP Strict Transport Security (HSTS) with domain preloading, and prevents MIME sniffing.
* **CORS Restrictions:** Uses explicit origin whitelisting (`localhost:5173`, `localhost:3000`, and production URLs) with credentials enabled. Wildcard (`*`) configurations are strictly rejected.
* **Information Leak Prevention:** The centralized error handler (`errorHandler.js`) logs stack traces server-side, but returns sanitised, generic error codes to clients in production so attackers cannot map internal database schemas.
* **Immutable Audit Trail:** All critical operations—logins, failed attempts, file uploads, views, deletions, permission denials, and camera events—are recorded to an append-only collection (`AuditLog.js`), ensuring full accountability and compliance.

### 4.7 Buffer & In-Memory Data Pipeline Architecture
SecureLayer implements a strict **RAM-Only Ingestion & Decryption Buffer Pipeline**, avoiding intermediate plaintext storage on disk or external caches (such as Redis):
* **Upload Ingestion (`multer.memoryStorage()`):** During file upload, incoming multi-part byte streams are buffered directly into volatile Node.js heap memory (`req.file.buffer`). Plaintext files never touch temporary disk directories (e.g., `/tmp` or OS temp folders), eliminating the risk of lingering unencrypted artifacts from dirty shutdowns or unlinked file leaks.
* **In-Memory Cryptographic Transformation:** The raw Node.js `Buffer` is passed straight into the cryptographic engine (`Buffer.concat([cipher.update, cipher.final])`). The buffer is encrypted with AES-256-GCM entirely in RAM; only the resulting ciphertext buffer is written to the private storage directory.
* **Decryption & Stream Buffer Pipeline:** When a document is requested for viewing, the server reads the encrypted disk file into a memory buffer, decrypts it into a transient plaintext `Buffer`, and immediately pipes it to the HTTP response (`res.send(plainBuffer)`). The plaintext buffer is de-referenced immediately after response delivery and collected by Node.js garbage collection—it is never written to disk or saved to intermediate caching services.
* **Frontend ArrayBuffer & Blob Memory Lifecycle:** The client receives the raw binary payload into browser memory as an immutable `Blob`. An ephemeral pointer is generated via `window.URL.createObjectURL()`. When viewing terminates, `window.URL.revokeObjectURL()` explicitly releases the browser heap allocation, preventing memory retention or secondary access.
* **In-Process Memory Rate Limiting:** Rate limit state counters are maintained using Node.js process-level volatile memory (`MemoryStore`), keeping architecture self-contained without requiring external Redis infrastructure for single-node deployments.

---

## 5. Security & Threat Mitigation Summary Matrix

| Threat Vector | Vulnerability Scenario | SecureLayer Technical Defense |
| :--- | :--- | :--- |
| **Physical Screen Photography** | A user or bystander holds up a smartphone to photograph a confidential screen. | **CamDetection COCO-SSD Model:** Detects phones with 2-frame persistence at 20% confidence, instantly covering the screen with an opaque `SecurityOverlay`. |
| **Shoulder Surfing / Eavesdropping** | A secondary unauthorized person walks up behind the viewer. | **CamDetection BlazeFace Model:** Detects multiple faces (count >= 2) across 3 consecutive frames, shielding the document until the bystander departs. |
| **Unattended Screen Exposure** | User leaves their computer while viewing sensitive files. | **CamDetection Face Absence Detector:** Detects 0 faces across 8 frames (~1.2s), immediately obscuring document contents. |
| **Screen Capture / Printing** | Viewer uses `Ctrl+P`, `Ctrl+S`, or right-click context menus. | **Client Event Interception:** Suppresses right-clicks, disables developer tools shortcuts, and cancels print/save dialogs with alerts. |
| **Text Scraping / Clipboard Theft** | User highlights and copies sensitive paragraphs. | **Canvas Isolation via `react-pdf`:** Renders PDF pages directly to HTML5 canvas elements with `renderTextLayer={false}`. |
| **Document Leaks / Backdoor Screenshots** | Document is captured via external camera. | **Forensic SVG Watermarking:** Embeds non-removable, high-contrast repeating watermark of viewer's email and timestamp. |
| **Replay & Stolen Link Sharing** | User shares a document link or attempts to re-view an approved file. | **Single-Use Allowance:** The backend marks the access record as `EXPIRED` during the initial binary stream. |
| **Database Compromise (Data at Rest)** | Attacker gains direct access to the database or storage drive. | **AES-256-GCM Encryption:** Files are stored as encrypted blobs with distinct IVs and AuthTags; master keys exist only in server memory. |
| **Credential Stuffing & Password Cracking** | Attacker uses breached password lists. | **Passwordless OTP:** 6-digit CSPRNG codes hashed with Bcrypt, expiring in 5 minutes with a 5-attempt limit. |
| **Session Hijacking & XSS Token Theft** | Malicious scripts harvest `localStorage` tokens. | **In-Memory JWT & HttpOnly Cookies:** Access tokens exist only in JavaScript memory; refresh tokens reside in protected, rotating HttpOnly cookies. |
| **Brute-Force & Denial of Service** | Automated bots flood authentication endpoints. | **Multi-Tier Rate Limiting:** Global IP limits, auth attempt throttles, and a strict limit of 3 OTP requests per hour per email. |

---

## Conclusion

The **SecureLayer** architecture establishes a unified security model spanning client-side computer vision, hardened frontend isolation, and a cryptographic, zero-trust backend. By pairing Edge AI threat detection with single-use authorization and authenticated encryption, SecureLayer ensures that sensitive files remain protected—not just in transit and at rest, but even while actively rendered on the user's screen.
