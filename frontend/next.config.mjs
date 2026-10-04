// TODO: Optimize large public images (pattern.png, hero.jpg, hero-mobile.jpg)
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  allowedDevOrigins: ['10.236.99.145', 'localhost:3000'],
};

export default nextConfig;
