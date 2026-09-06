/** @type {import('next').NextConfig} */
const repo = "gemeo.stackup.holdem-heroes-clean";
const isStaticExport =
  process.env.STATIC_EXPORT === "true" ||
  process.env.GITHUB_ACTIONS === "true" ||
  process.env.CF_PAGES === "1";
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig = {
  allowedDevOrigins: ["192.168.1.5"],
  ...(isStaticExport
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
        ...(isGitHubPages
          ? {
              basePath: `/${repo}`,
              assetPrefix: `/${repo}/`,
            }
          : {}),
      }
    : {}),
};

export default nextConfig;
