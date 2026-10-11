# SecureLayer: CamDetection Module
## In-Depth Technical Architecture & ML Report

### 1. Executive Summary
The **CamDetection** module is a client-side, privacy-first computer vision layer embedded within the SecureLayer React application. Its primary directive is to mitigate data exfiltration risks (specifically screen photography and unauthorized shoulder-surfing) when a user views `HIGHLY_CONFIDENTIAL` documents. 

By executing all machine learning inference directly within the browser (Edge AI), the system guarantees that zero video frames or biometric data ever leave the user's device.

### 2. Detection Vectors
The module tracks and detects three primary threat vectors:
1. **Primary User Absence:** The authorized user has stepped away from the screen, leaving the confidential document exposed to passersby.
2. **Multiple Faces (Shoulder Surfing):** An unauthorized secondary person has entered the camera frame and is viewing the screen alongside the user.
3. **Recording Devices:** A phone, camera, or tablet is being held up to the screen to photograph the document.

---

### 3. Machine Learning Models & Tech Stack

#### A. Face Detection Engine
*   **Library:** `@mediapipe/tasks-vision` (Google MediaPipe WebAssembly)
*   **Model:** BlazeFace (Short-range)
*   **Architecture:** Lightweight Single Shot MultiBox Detector (SSD) customized for mobile/web GPU inference. It uses a modified MobileNet backbone.
*   **Training Data:** Trained on a proprietary dataset by Google containing thousands of images with varied facial features, angles, and lighting conditions.
*   **Implementation Details:**
    *   **Polling Rate:** ~6 FPS (150ms interval).
    *   **Privacy:** The model performs *Face Detection* (finding bounding boxes), not *Face Recognition* (identifying who the person is). No biometric templates (embeddings) are generated or stored.
    *   **Logic:** The system simply counts the number of bounding boxes returned. `count === 0` triggers absence risk. `count >= 2` triggers shoulder-surfing risk.

#### B. Object Detection Engine
*   **Library:** `@tensorflow/tfjs` and `@tensorflow-models/coco-ssd`
*   **Model Base:** `lite_mobilenet_v2`
*   **Architecture:** MobileNetV2 (a highly efficient convolutional neural network utilizing depthwise separable convolutions) paired with an SSD head.
*   **Training Data:** Trained on the **MS COCO (Common Objects in Context)** dataset, which contains over 330k images and 80 object categories.
*   **Implementation Details:**
    *   **Polling Rate:** ~6 FPS (150ms interval).
    *   **Target Classes:** We explicitly filter the 80 COCO classes down to a subset of recording-capable devices: `['cell phone', 'remote', 'laptop', 'tablet']`.
    *   **Confidence Thresholding:** The confidence threshold is aggressively tuned down to **0.20 (20%)**. Because `lite_mobilenet_v2` sacrifices accuracy for speed, its confidence on small, blurry webcam objects drops significantly. A 20% threshold ensures high sensitivity to phones being rapidly held up, prioritizing security over perfect accuracy.

---

### 4. Algorithmic Risk Engine (`riskEngine.js`)
Raw ML predictions are inherently noisy and prone to "flickering" (e.g., a phone drops from 22% to 18% confidence for a single frame). To make the UI usable and prevent the security overlay from strobing, we implemented a custom state-smoothing engine.

#### Temporal Smoothing & Hysteresis
Instead of reacting to single frames, the system requires **Temporal Persistence**:
*   **Phone/Camera:** Requires **2 consecutive positive frames** to trigger the lock.
*   **Multiple Faces:** Requires **3 consecutive positive frames** to trigger.
*   **Face Absence:** Requires **8 consecutive negative frames** (~1.2 seconds) to trigger, allowing the user to briefly look away or sneeze without being locked out.

#### The "Schmitt Trigger" Lock
Once a threat is confirmed and the risk boolean flips to `true`, the UI is locked by the `SecurityOverlay`. The system employs an asymmetric unlock mechanism:
If the model loses track of a phone for a single frame, the persistence counter simply decrements (e.g., from 2 down to 1). **The UI remains locked.** The boolean risk state will only flip back to `false` when the persistence counter reaches exactly `0`. This guarantees that the document remains shielded until the threat has definitively and confidently left the camera frame.

---

### 5. Application Integration & Security
*   **React Integration:** The detection loops operate via `useRef` rather than `useState` to accumulate frame counts. This prevents React from initiating a "re-render storm" at 12 FPS. The UI is only re-rendered when the computed Risk Level actually changes.
*   **Browser Throttling Bypass:** Modern browsers pause video playback and WebGL contexts for hidden elements. To bypass this, the `<video>` element is rendered at `640x480` (optimal resolution for the ML models) but is visually hidden using `opacity: 0.001` and `pointer-events: none` rather than `display: none`.
*   **Audit Logging:** Every time the risk level elevates to `HIGH` or drops to `LOW`, a cryptographically signed telemetry event (`CAMDETECTION_RESUMED`, `RISK_ELEVATED`) is dispatched to the backend audit log (`camAudit.js`). No images or bounding boxes are sent—only the string reason codes (e.g., `PHONE_DETECTED`), maintaining GDPR and privacy compliance.
