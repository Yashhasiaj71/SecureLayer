/**
 * useCamDetection.js
 * 
 * React hook managing the full CamDetection lifecycle:
 * - Camera stream acquisition (only after explicit user consent)
 * - MediaPipe FaceDetector for face presence and face count
 * - TensorFlow COCO-SSD for phone/camera-object detection
 * - Inference scheduling with throttling for low-power targets
 * - Risk engine integration
 * - Cleanup on unmount
 * 
 * PERFORMANCE TARGETS (i5-8350U / Intel UHD 620):
 * - Face detection: 5–10 inferences/s
 * - Object detection: 1–2 inferences/s
 * - Camera resolution: 640×480 (downscalable)
 * 
 * PRIVACY:
 * - Raw frames are NEVER sent to any network endpoint
 * - No biometric templates are stored
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { computeRisk } from './riskEngine';
import { reportCamEvent } from './camAudit';

// ─── Detection intervals ────────────────────────────────────────────────────────
const FACE_INTERVAL_MS = 150;  // ~6fps face analysis
const OBJ_INTERVAL_MS = 150;  // ~6fps object detection

// ─── Phone-like COCO-SSD classes ───────────────────────────────────────────────
const PHONE_CLASSES = new Set(['cell phone', 'remote', 'laptop', 'tablet']);

/**
 * @typedef {'IDLE'|'REQUESTING_PERMISSION'|'INITIALIZING'|'RUNNING'|'PERMISSION_DENIED'|'UNAVAILABLE'|'ERROR'} CamStatus
 */

/**
 * @param {string|null} fileId - File being viewed (for audit events)
 * @returns {{
 *   camStatus: CamStatus,
 *   riskAssessment: Object,
 *   videoRef: React.RefObject,
 *   startCam: () => Promise<void>,
 *   stopCam: () => void,
 *   diagnostics: Object,
 * }}
 */
export function useCamDetection(fileId = null) {
  const [camStatus, setCamStatus] = useState('IDLE');
  const [riskAssessment, setRiskAssessment] = useState({
    riskScore: 0,
    riskLevel: 'LOW',
    reasonCodes: [],
    lastUpdatedAt: null,
    detectorHealth: 'OK',
  });
  const [diagnostics, setDiagnostics] = useState({
    faceDetectorReady: false,
    objDetectorReady: false,
    faceLatencyMs: null,
    objLatencyMs: null,
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const objDetectorRef = useRef(null);
  const faceTimerRef = useRef(null);
  const objTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const riskRef = useRef(riskAssessment); // For stable closure access
  const isObjRunningRef = useRef(false);

  // Mutable detection counters — these accumulate between inference ticks
  const stateRef = useRef({
    faceAbsentFrames: 0,
    multipleFaceFrames: 0,
    phoneFrames: 0,
    facePresent: true,
    faceCount: 1,
    phoneDetected: false,
    faceAbsent: false,
    multipleFacesDetected: false,
    detectorHealthy: false,
  });

  // Keep riskRef in sync for reporting
  useEffect(() => {
    riskRef.current = riskAssessment;
  }, [riskAssessment]);

  // Ensure the video element gets the stream once it mounts (after consent phase)
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => { });
    }
  });

  // ─── Cleanup ──────────────────────────────────────────────────────────────────
  const stopCam = useCallback(() => {
    clearInterval(faceTimerRef.current);
    clearInterval(objTimerRef.current);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (faceDetectorRef.current?.close) faceDetectorRef.current.close();
    if (objDetectorRef.current?.dispose) objDetectorRef.current.dispose();

    faceDetectorRef.current = null;
    objDetectorRef.current = null;

    if (mountedRef.current) {
      setCamStatus('IDLE');
      stateRef.current.detectorHealthy = false;
    }
  }, []);

  // Unmount cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCam();
    };
  }, [stopCam]);

  // ─── Risk Engine Tick ─────────────────────────────────────────────────────────
  const updateRisk = useCallback((fileIdArg) => {
    const assessment = computeRisk(stateRef.current, riskRef.current.riskLevel);
    if (!mountedRef.current) return;
    setRiskAssessment(assessment);

    // Report significant transitions to the backend (fire-and-forget)
    if (assessment.riskLevel === 'HIGH' && riskRef.current.riskLevel !== 'HIGH') {
      reportCamEvent({
        eventType: 'CAMDETECTION_HIGH_RISK',
        fileId: fileIdArg,
        riskLevel: assessment.riskLevel,
        reasonCodes: assessment.reasonCodes,
      });
    } else if (assessment.riskLevel === 'ELEVATED' && riskRef.current.riskLevel === 'LOW') {
      reportCamEvent({
        eventType: 'CAMDETECTION_ELEVATED_RISK',
        fileId: fileIdArg,
        riskLevel: assessment.riskLevel,
        reasonCodes: assessment.reasonCodes,
      });
    }
  }, []);

  // ─── Face Detection Loop ──────────────────────────────────────────────────────
  const runFaceDetection = useCallback(async (fileIdArg) => {
    const detector = faceDetectorRef.current;
    const video = videoRef.current;

    if (!detector || !video || video.readyState < 2) return;

    const t0 = performance.now();
    try {
      const results = detector.detectForVideo(video, performance.now());
      const faces = results?.detections || [];
      const count = faces.length;

      stateRef.current.faceCount = count;
      stateRef.current.facePresent = count > 0;

      if (count === 0) {
        stateRef.current.faceAbsentFrames++;
        if (stateRef.current.faceAbsentFrames >= 8) { // minPersistenceFrames
          stateRef.current.faceAbsent = true;
        }
        
        stateRef.current.multipleFaceFrames = Math.max(0, stateRef.current.multipleFaceFrames - 1);
        if (stateRef.current.multipleFaceFrames === 0) {
          stateRef.current.multipleFacesDetected = false;
        }
      } else {
        stateRef.current.faceAbsentFrames = Math.max(0, stateRef.current.faceAbsentFrames - 1);
        if (stateRef.current.faceAbsentFrames === 0) {
          stateRef.current.faceAbsent = false;
        }

        if (count >= 2) {
          stateRef.current.multipleFaceFrames++;
          if (stateRef.current.multipleFaceFrames >= 3) {
            stateRef.current.multipleFacesDetected = true;
          }
        } else {
          stateRef.current.multipleFaceFrames = Math.max(0, stateRef.current.multipleFaceFrames - 1);
          if (stateRef.current.multipleFaceFrames === 0) {
            stateRef.current.multipleFacesDetected = false;
          }
        }
      }

      const latency = performance.now() - t0;
      if (mountedRef.current) {
        setDiagnostics((prev) => ({ ...prev, faceLatencyMs: Math.round(latency) }));
      }
    } catch {
      // Inference error — mark detector unhealthy
      stateRef.current.detectorHealthy = false;
    }

    updateRisk(fileIdArg);
  }, [updateRisk]);

  // ─── Object Detection Loop ────────────────────────────────────────────────────
  const runObjDetection = useCallback(async () => {
    if (isObjRunningRef.current) return;

    const model = objDetectorRef.current;
    const video = videoRef.current;

    if (!model || !video || video.readyState < 2) return;

    isObjRunningRef.current = true;
    const t0 = performance.now();
    try {
      const predictions = await model.detect(video);
      const hasPhone = predictions.some(
        (p) => PHONE_CLASSES.has(p.class) && p.score > 0.20
      );
      
      const topClasses = predictions.filter(p => p.score > 0.15).map(p => p.class);

      if (hasPhone) {
        stateRef.current.phoneFrames++;
        if (stateRef.current.phoneFrames >= 2) { // minPersistenceFrames for phone
          stateRef.current.phoneDetected = true;
        }
      } else {
        stateRef.current.phoneFrames = Math.max(0, stateRef.current.phoneFrames - 1);
        if (stateRef.current.phoneFrames === 0) {
          stateRef.current.phoneDetected = false;
        }
      }

      const latency = performance.now() - t0;
      if (mountedRef.current) {
        setDiagnostics((prev) => ({ ...prev, objLatencyMs: Math.round(latency), lastClasses: topClasses }));
      }
    } catch {
      // Non-fatal — COCO-SSD inference errors don't stop face detection
    } finally {
      isObjRunningRef.current = false;
    }
  }, []);

  // ─── Initialization ───────────────────────────────────────────────────────────
  const startCam = useCallback(async () => {
    if (camStatus === 'RUNNING' || camStatus === 'INITIALIZING') return;

    setCamStatus('REQUESTING_PERMISSION');

    // 1. Request camera — ONLY called after explicit user action
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
    } catch (err) {
      if (mountedRef.current) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setCamStatus('PERMISSION_DENIED');
          reportCamEvent({ eventType: 'CAMDETECTION_PERMISSION_DENIED', fileId, riskLevel: 'LOW', reasonCodes: [] });
        } else {
          setCamStatus('UNAVAILABLE');
        }
      }
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => { });
    }

    setCamStatus('INITIALIZING');

    // 2. Load MediaPipe FaceDetector
    let faceDetector = null;
    try {
      const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        minDetectionConfidence: 0.5,
        minSuppressionThreshold: 0.3,
      });
      faceDetectorRef.current = faceDetector;
      stateRef.current.detectorHealthy = true;
      if (mountedRef.current) setDiagnostics((p) => ({ ...p, faceDetectorReady: true }));
    } catch (err) {
      // MediaPipe failed — cam must stop, document stays hidden
      if (mountedRef.current) {
        setCamStatus('ERROR');
        reportCamEvent({
          eventType: 'CAMDETECTION_INIT_FAILED',
          fileId,
          riskLevel: 'LOW',
          reasonCodes: ['FACE_DETECTOR_INIT_FAILED'],
        });
      }
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    // 3. Load COCO-SSD (best-effort — failure doesn't block viewing)
    try {
      const [tf, cocoSsd] = await Promise.all([
        import('@tensorflow/tfjs'),
        import('@tensorflow-models/coco-ssd'),
      ]);
      await tf.ready();
      const objModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      objDetectorRef.current = objModel;
      if (mountedRef.current) setDiagnostics((p) => ({ ...p, objDetectorReady: true }));
    } catch {
      // Object detection unavailable — face detection still runs
      if (mountedRef.current) setDiagnostics((p) => ({ ...p, objDetectorReady: false }));
    }

    if (!mountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    // 4. Start inference loops
    faceTimerRef.current = setInterval(() => runFaceDetection(fileId), FACE_INTERVAL_MS);
    if (objDetectorRef.current) {
      objTimerRef.current = setInterval(() => runObjDetection(), OBJ_INTERVAL_MS);
    }

    setCamStatus('RUNNING');

    reportCamEvent({
      eventType: 'CAMDETECTION_SESSION_STARTED',
      fileId,
      riskLevel: 'LOW',
      reasonCodes: [],
    });
  }, [camStatus, fileId, runFaceDetection, runObjDetection]);

  // ─── Tab visibility — pause when hidden ──────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && camStatus === 'RUNNING') {
        clearInterval(faceTimerRef.current);
        clearInterval(objTimerRef.current);
      } else if (!document.hidden && camStatus === 'RUNNING' && faceDetectorRef.current) {
        faceTimerRef.current = setInterval(() => runFaceDetection(fileId), FACE_INTERVAL_MS);
        if (objDetectorRef.current) {
          objTimerRef.current = setInterval(() => runObjDetection(), OBJ_INTERVAL_MS);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [camStatus, fileId, runFaceDetection, runObjDetection]);

  return {
    camStatus,
    riskAssessment,
    videoRef,
    startCam,
    stopCam,
    diagnostics,
  };
}
