/**
 * Frontend monorepo CI pipeline functions for Dagger
 *
 * Tailored to pnpm-workspace + Turborepo frontends where the root scripts
 * (typecheck / test / build) fan out across every package and app via
 * `turbo run <task>`. A single `ci()` therefore validates the whole graph,
 * so any individual app stays buildable regardless of which package changed.
 *
 * Differs from the generic `node` (NodeCi) module, which hardcodes
 * `npx tsc --noEmit` for type checking — that does not fit a Turborepo root
 * whose type checking is delegated per-package through `turbo run typecheck`.
 */
import {
  dag,
  Container,
  Directory,
  object,
  func,
} from "@dagger.io/dagger"

import { runCommand } from "./node-utils.js"

@object()
export class Frontend {
  /**
   * Base container: Node + corepack-pinned pnpm, source mounted, deps installed.
   *
   * Uses corepack so the pnpm version declared in the workspace's
   * `package.json` "packageManager" field is honored. Installing pnpm globally
   * via npm would pull the latest pnpm and can break `--frozen-lockfile`
   * against a lockfile produced by a pinned, older pnpm.
   */
  @func()
  install(source: Directory, nodeVersion: string = "22"): Container {
    // Strip host build artifacts so the container always resolves its own
    // platform's binaries. A mounted node_modules from another platform
    // (e.g. a developer's macOS checkout) leaks the wrong esbuild/turbo
    // native binaries and breaks `--frozen-lockfile` installs.
    const cleanSource = dag.directory().withDirectory("/", source, {
      exclude: ["**/node_modules", "**/dist", "**/.turbo"],
    })

    return dag
      .container()
      .from(`node:${nodeVersion}`)
      .withExec(["corepack", "enable"])
      .withMountedDirectory("/app", cleanSource)
      .withWorkdir("/app")
      .withExec(["pnpm", "install", "--frozen-lockfile"])
  }

  /**
   * Type-check the whole workspace (`pnpm run typecheck` → `turbo run typecheck`).
   */
  @func()
  async typecheck(source: Directory, nodeVersion: string = "22"): Promise<string> {
    return this.install(source, nodeVersion)
      .withExec(runCommand("pnpm", "typecheck"))
      .stdout()
  }

  /**
   * Run the whole workspace test suite (`pnpm run test` → `turbo run test`).
   */
  @func()
  async test(source: Directory, nodeVersion: string = "22"): Promise<string> {
    return this.install(source, nodeVersion)
      .withExec(runCommand("pnpm", "test"))
      .stdout()
  }

  /**
   * Build every package and app (`pnpm run build` → `turbo run build`).
   */
  @func()
  build(source: Directory, nodeVersion: string = "22"): Container {
    return this.install(source, nodeVersion)
      .withExec(runCommand("pnpm", "build"))
  }

  /**
   * Full CI pipeline: install → typecheck → test → build (whole graph).
   *
   * Returns the built container. Because the root scripts delegate to
   * `turbo run`, this validates that every package and app is type-safe,
   * tested, and buildable — the guarantee that no single change silently
   * breaks another app.
   */
  @func()
  ci(source: Directory, nodeVersion: string = "22"): Container {
    return this.install(source, nodeVersion)
      .withExec(runCommand("pnpm", "typecheck"))
      .withExec(runCommand("pnpm", "test"))
      .withExec(runCommand("pnpm", "build"))
  }

  /**
   * Build the workspace and export a single app's output directory.
   *
   * Returns the built output as a `Directory`, ready to hand to a deploy step
   * (e.g. `preview-deploy deploy`). Defaults to the showcase app's Vite `dist`.
   */
  @func()
  buildDir(
    source: Directory,
    outputPath: string = "apps/showcase/dist",
    nodeVersion: string = "22",
  ): Directory {
    return this.build(source, nodeVersion).directory(`/app/${outputPath}`)
  }
}
