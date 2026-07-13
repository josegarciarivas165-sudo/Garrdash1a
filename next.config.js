/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  trailingSlash: true,
  // CRUCIAL: Rutas relativas para APK/AAB en Android/iOS
  assetPrefix: './',
  // Asegura que los chunks se carguen con rutas relativas
  basePath: '',
};

module.exports = nextConfig;
