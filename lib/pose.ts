// lib/pose.ts
// Camera + MediaPipe PoseLandmarker wrapper.
// Calls getUserMedia (640×480) and passes raw errors (NotAllowedError, NotFoundError, etc.)
// to the caller without wrapping them.

import type { FrameMentah } from './kinematik/tipe.ts';

// MediaPipe version baked at build time — must match the folder in public/mediapipe/
const MP_VERSION = '1.2.0';
const BASE_URL = `/mediapipe/${MP_VERSION}`;

type LandmarkResult = {
  landmarks: Array<Array<{ x: number; y: number; z?: number; visibility?: number }>>;
  worldLandmarks: Array<Array<{ x: number; y: number; z: number }>>;
};

export async function mulaiPose(
  video: HTMLVideoElement,
  onFrame: (f: FrameMentah) => void,
): Promise<{ delegate: 'GPU' | 'CPU'; berhenti(): void }> {
  // 1. Minta kamera — biarkan error asli menjalar ke caller
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: 'user' },
  });
  const hentikanStream = () => {
    stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  };

  // 2. Load MediaPipe — bila gagal (mis. luring, aset tidak terunduh) kamera wajib dimatikan lagi
  type Landmarker = Awaited<ReturnType<typeof import('@mediapipe/tasks-vision').PoseLandmarker.createFromOptions>>;
  let buatLandmarker: (d: 'GPU' | 'CPU') => Promise<Landmarker>;
  let landmarker: Landmarker | null = null;
  let delegate: 'GPU' | 'CPU' = 'GPU';

  try {
    video.srcObject = stream;
    await new Promise<void>(res => { video.onloadedmetadata = () => res(); });
    await video.play();

    const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(`${BASE_URL}/wasm`);
    buatLandmarker = (d) => PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: `${BASE_URL}/pose_landmarker_lite.task`, delegate: d },
      runningMode: 'VIDEO',
      numPoses: 1,
    });

    try {
      landmarker = await buatLandmarker('GPU');
    } catch {
      // Fallback ke CPU bila GPU tidak tersedia
      delegate = 'CPU';
      landmarker = await buatLandmarker('CPU');
    }
  } catch (err) {
    hentikanStream();
    throw err;
  }

  let berjalan = true;
  let animId = 0;
  let lastTime = -1;
  let isProcessing = false;

  async function loop(timestamp: number) {
    if (!berjalan) return;
    animId = requestAnimationFrame(loop);

    if (!landmarker || video.currentTime === lastTime || isProcessing) return;
    lastTime = video.currentTime;
    isProcessing = true;

    try {
      let result: LandmarkResult;
      try {
        result = landmarker.detectForVideo(video, timestamp) as LandmarkResult;
      } catch (err) {
        if (delegate === 'GPU') {
          // lepas landmarker lama dulu, supaya berhenti() tidak menutupnya dua kali
          const lama = landmarker;
          landmarker = null;
          try { lama?.close(); } catch {}
          delegate = 'CPU';
          const baru = await buatLandmarker('CPU');
          if (!berjalan) {
            baru.close();
            return;
          }
          landmarker = baru;
          result = baru.detectForVideo(video, timestamp) as LandmarkResult;
        } else {
          throw err;
        }
      }

      const lm = result.landmarks?.[0] ?? null;
      const world = result.worldLandmarks?.[0] ?? null;

      const frame: FrameMentah = {
        t: timestamp,
        W: video.videoWidth,
        H: video.videoHeight,
        lm: lm
          ? lm.map(p => ({ x: p.x, y: p.y, visibility: p.visibility }))
          : null,
        world: world
          ? world.map(p => ({ x: p.x, y: p.y, z: p.z }))
          : null,
      };

      onFrame(frame);
    } catch (e) {
      console.error('Error during pose detection:', e);
    } finally {
      isProcessing = false;
    }
  }

  animId = requestAnimationFrame(loop);

  return {
    get delegate() {
      return delegate;
    },
    berhenti() {
      berjalan = false;
      cancelAnimationFrame(animId);
      hentikanStream();                          // kamera mati dulu, apa pun hasil close()
      try { landmarker?.close(); } catch {}
      landmarker = null;
    },
  };
}
