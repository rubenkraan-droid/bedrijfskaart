import type { NextConfig } from 'next';

/**
 * Deze toepassing wordt als statische site gebouwd en op GitHub Pages gezet.
 * Er is dus geen server die meedraait: alles gebeurt in de browser, en de
 * database beschermt zichzelf met Row Level Security.
 *
 * basePath is nodig als de site onder een submap staat, zoals
 * rubenkraan-droid.github.io/bedrijfskaart. Bij een eigen domein
 * (kaart.recraparcs.nl) staat hij op de hoofdmap en blijft dit leeg.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
