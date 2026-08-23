/** @type {import('next').NextConfig} */
const nextConfig = {
  // Deliberately NOT ignoring type errors. The tree is clean as of the Supabase
  // migration; silencing tsc here is what let `liff.isReady` (a property the
  // LIFF SDK never defined) disable getIDToken, login, logout and QR scanning
  // in production. Run `pnpm typecheck` before pushing.
  images: {
    unoptimized: true,
  },
}

export default nextConfig
