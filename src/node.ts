/**
 * Reusable Node.js CI pipeline functions for Dagger
 *
 * Foundation module for all JS/TS projects. Provides composable pipeline steps:
 * install, typecheck, lint, test, and build. Supports npm, pnpm, and bun.
 */
import {
  Container,
  Directory,
  object,
  func,
} from "@dagger.io/dagger"

import { createNodeContainer, runCommand } from "./node-utils.js"

@object()
export class NodeCi {
  /**
   * Base Node.js container with source mounted and dependencies installed
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
   * Run TypeScript type checking (tsc --noEmit)
   */
  @func()
  async typecheck(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    tsconfigPath: string = "",
  ): Promise<string> {
    const args = ["npx", "tsc", "--noEmit"]
    if (tsconfigPath) {
      args.push("-p", tsconfigPath)
    }
    return this.install(source, nodeVersion, packageManager)
      .withExec(args)
      .stdout()
  }

  /**
   * Run linter (defaults to "npm run lint")
   */
  @func()
  async lint(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    lintScript: string = "lint",
  ): Promise<string> {
    return this.install(source, nodeVersion, packageManager)
      .withExec(runCommand(packageManager, lintScript))
      .stdout()
  }

  /**
   * Run tests (defaults to "npm test")
   */
  @func()
  async test(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    testScript: string = "test",
  ): Promise<string> {
    return this.install(source, nodeVersion, packageManager)
      .withExec(runCommand(packageManager, testScript))
      .stdout()
  }

  /**
   * Run build (defaults to "npm run build")
   */
  @func()
  build(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    buildScript: string = "build",
  ): Container {
    return this.install(source, nodeVersion, packageManager)
      .withExec(runCommand(packageManager, buildScript))
  }

  /**
   * Full CI pipeline: install → typecheck → lint → test → build
   *
   * Skips lint/test steps if skipLint/skipTest are set.
   */
  @func()
  async ci(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    buildScript: string = "build",
    lintScript: string = "lint",
    testScript: string = "test",
    skipLint: boolean = false,
    skipTest: boolean = false,
  ): Promise<Container> {
    let container = this.install(source, nodeVersion, packageManager)

    container = container.withExec(["npx", "tsc", "--noEmit"])

    if (!skipLint) {
      container = container.withExec(runCommand(packageManager, lintScript))
    }

    if (!skipTest) {
      container = container.withExec(runCommand(packageManager, testScript))
    }

    container = container.withExec(runCommand(packageManager, buildScript))

    return container
  }
}
