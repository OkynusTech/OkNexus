/** @type {import('next').NextConfig} */
const nextConfig = {


    // Environment variables for transformers.js cache
    env: {
        TRANSFORMERS_CACHE: './.cache/transformers',
        NEXT_PUBLIC_TRANSFORMERS_CACHE: './.cache/transformers',
    },
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
    // Prevent bundling of native modules
    serverExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
    experimental: {
        serverComponentsExternalPackages: ['@xenova/transformers', 'onnxruntime-node'],
    },
};

export default nextConfig;
