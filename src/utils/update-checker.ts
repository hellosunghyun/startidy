import { createRequire } from "module";

const require = createRequire(import.meta.url);

interface NpmRegistryResponse {
  "dist-tags": {
    latest: string;
  };
}

/**
 * Compare two semver versions
 * Returns true if latest is newer than current
 */
function isNewerVersion(current: string, latest: string): boolean {
  const currentParts = current.replace(/^v/, "").split(".").map(Number);
  const latestParts = latest.replace(/^v/, "").split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const curr = currentParts[i] || 0;
    const lat = latestParts[i] || 0;
    if (lat > curr) return true;
    if (lat < curr) return false;
  }
  return false;
}

/**
 * Check if a newer version is available on npm
 */
export async function checkForUpdates(): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    const pkg = require("../../package.json");
    const packageName = pkg.name;
    const currentVersion = pkg.version;

    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    const response = await fetch(
      `https://registry.npmjs.org/${packageName}/latest`,
      {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return; // Silently fail if package not found or other error
    }

    const data = (await response.json()) as { version: string };
    const latestVersion = data.version;

    if (isNewerVersion(currentVersion, latestVersion)) {
      console.log();
      console.log(
        `\x1b[33m╭───────────────────────────────────────────────────────────╮\x1b[0m`
      );
      console.log(
        `\x1b[33m│\x1b[0m  Update available! \x1b[90m${currentVersion}\x1b[0m → \x1b[32m${latestVersion}\x1b[0m                        \x1b[33m│\x1b[0m`
      );
      console.log(
        `\x1b[33m│\x1b[0m  Run \x1b[36mnpm update -g ${packageName}\x1b[0m to update       \x1b[33m│\x1b[0m`
      );
      console.log(
        `\x1b[33m╰───────────────────────────────────────────────────────────╯\x1b[0m`
      );
      console.log();
    }
  } catch {
    // Silently fail - don't block CLI usage due to network issues
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
