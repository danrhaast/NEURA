/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // capas de vídeo vêm do YouTube
    remotePatterns: [
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
    ],
  },
};

export default nextConfig;