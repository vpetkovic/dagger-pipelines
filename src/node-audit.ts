/**
 * Node.js dependency audit pipeline functions for Dagger
 *
 * Runs vulnerability checks using the native audit command for the chosen
 * package manager (npm audit / pnpm audit / bun audit). Only mounts source
 * and runs audit — skips full dependency install since audit commands work
 * from the lockfile alone.
 */
import {
  dag,
  Directory,
  object,
  func,
} from "@dagger.io/dagger"

@object()
export class NodeAudit {
  /**
   * Run dependency audit for a Node.js project
   */
  @func()
  async audit(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
  ): Promise<string> {
    let container = dag
      .container()
      .from(`node:${nodeVersion}`)
      .withMountedDirectory("/app", source)
      .withWorkdir("/app")

    if (packageManager === "pnpm") {
      container = container.withExec(["npm", "install", "-g", "pnpm"])
    } else if (packageManager === "bun") {
      container = container.withExec(["npm", "install", "-g", "bun"])
    }

    let auditCmd: string[]
    switch (packageManager) {
      case "pnpm":
        auditCmd = ["pnpm", "audit", "--no-exit-code"]
        break
      case "bun":
        auditCmd = ["bun", "audit"]
        break
      default:
        auditCmd = ["npm", "audit", "--audit-level=moderate"]
        break
    }

    return container.withExec(auditCmd).stdout()
  }
}
