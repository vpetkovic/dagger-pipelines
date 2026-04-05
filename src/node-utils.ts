/**
 * Shared utilities for Node.js-based Dagger pipeline modules
 */
import {
  dag,
  Container,
  Directory,
} from "@dagger.io/dagger"

/**
 * Get the install command for a given package manager
 */
export function installCommand(packageManager: string): string[] {
  switch (packageManager) {
    case "pnpm":
      return ["pnpm", "install", "--frozen-lockfile"]
    case "bun":
      return ["bun", "install", "--frozen-lockfile"]
    default:
      return ["npm", "ci"]
  }
}

/**
 * Get the run-script command for a given package manager
 */
export function runCommand(packageManager: string, script: string): string[] {
  switch (packageManager) {
    case "pnpm":
      return ["pnpm", "run", script]
    case "bun":
      return ["bun", "run", script]
    default:
      return ["npm", "run", script]
  }
}

/**
 * Create a Node.js container with source mounted, package manager installed,
 * and dependencies installed. Used by NodeCi, Nextjs, and NpmPackage modules.
 */
export function createNodeContainer(
  source: Directory,
  nodeVersion: string,
  packageManager: string,
): Container {
  let container = dag
    .container()
    .from(`node:${nodeVersion}`)
    .withMountedDirectory("/app", source)
    .withWorkdir("/app")

  if (packageManager === "bun") {
    container = container.withExec(["sh", "-c", "npm install -g bun"])
  } else if (packageManager === "pnpm") {
    container = container.withExec(["sh", "-c", "npm install -g pnpm"])
  }

  return container.withExec(installCommand(packageManager))
}
