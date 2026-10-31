'use client';

// Canvas overlay for pose landmarks visualization.
// Mirrors the video horizontally to match CSS scale-x-[-1].

interface PropsOverlay {
  lebar: number;
  tinggi: number;
}

export default function Overlay({ lebar, tinggi }: PropsOverlay) {
  // Placeholder — landmark drawing will be wired when pose engine is integrated
  return (
    <canvas
      width={lebar}
      height={tinggi}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ transform: 'scaleX(-1)' }}
      aria-hidden="true"
    />
  );
}
