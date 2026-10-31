import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Header cache immutable untuk aset MediaPipe (NFR-8, F18)
  async headers() {
    return [
      {
        source: '/mediapipe/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig
