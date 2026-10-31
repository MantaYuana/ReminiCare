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
  video.srcObject = stream;
  await new Promise<void>(res => { video.onloadedmetadata = () => res(); });
  await video.play();

  // 2. Load MediaPipe
  const { PoseLandmarker, FilesetResolver, RunningMode } = await import('@mediapipe/tasks-vision');

  const vision = await FilesetResolver.forVisionTasks(`${BASE_URL}/wasm`);

  let landmarker: InstanceType<typeof PoseLandmarker> | null = null;
  let delegate: 'GPU' | 'CPU' = 'GPU';

  try {
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `${BASE_URL}/pose_landmarker_lite.task`,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO' as unknown as typeof RunningMode.VIDEO,
      numPoses: 1,
    });
  } catch {
    // Fallback ke CPU bila GPU tidak tersedia
    delegate = 'CPU';
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `${BASE_URL}/pose_landmarker_lite.task`,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO' as unknown as typeof RunningMode.VIDEO,
      numPoses: 1,
    });
  }

  let berjalan = true;
  let animId = 0;

  function loop(timestamp: number) {
    if (!berjalan || !landmarker) return;

    const result = landmarker.detectForVideo(video, timestamp) as LandmarkResult;
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
    animId = requestAnimationFrame(loop);
  }

  animId = requestAnimationFrame(loop);

  return {
    delegate,
    berhenti() {
      berjalan = false;
      cancelAnimationFrame(animId);
      landmarker?.close();
      stream.getTracks().forEach(t => t.stop());
    },
  };
}
