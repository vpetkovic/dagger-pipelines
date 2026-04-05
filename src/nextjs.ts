/**
 * Next.js CI pipeline functions for Dagger
 *
 * Provides composable pipeline steps for Next.js applications: install,
 * lint, typecheck, build, and static export.
 */
import {
  Container,
  Directory,
  object,
  func,
} from "@dagger.io/dagger"

import { createNodeContainer, runCommand } from "./node-utils.js"

@object()
export class Nextjs {
  /**
   * Base container with Node.js, source mounted, and dependencies installed
   */
  @func()
  install(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
  ): Container {
    return createNodeContainer(source, nodeVersion, packageManager)
  }

  /**
   * Build the Next.js application
   */
  @func()
  build(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
  ): Container {
    return this.install(source, nodeVersion, packageManager)
      .withExec(runCommand(packageManager, "build"))
  }

  /**
   * Export a static build (output directory)
   *
   * Requires `output: 'export'` in next.config.
   * Returns the exported directory (typically `out/`).
   */
  @func()
  exportStatic(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    outputDir: string = "out",
  ): Directory {
    return this.build(source, nodeVersion, packageManager)
      .directory(`/app/${outputDir}`)
  }

  /**
   * Full CI pipeline: install → typecheck → lint → build
   */
  @func()
  ci(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    skipLint: boolean = false,
  ): Container {
    let container = this.install(source, nodeVersion, packageManager)

    container = container.withExec(["npx", "tsc", "--noEmit"])

    if (!skipLint) {
      container = container.withExec(runCommand(packageManager, "lint"))
    }

    container = container.withExec(runCommand(packageManager, "build"))

    return container
  }
}
