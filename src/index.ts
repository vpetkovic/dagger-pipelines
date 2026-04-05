/**
 * Reusable CI/CD pipeline functions for Dagger
 *
 * Multi-language module with composable pipeline steps for:
 * - .NET: restore, build, test, pack, NuGet publish
 * - Node.js: install, typecheck, lint, test, build (npm/pnpm/bun)
 * - VS Code Extensions: build, package VSIX, publish to Marketplace
 * - Next.js: lint, typecheck, build, static export
 * - npm Packages: typecheck, test, pack, publish to npm
 * - Cloudflare Workers: typecheck, deploy via wrangler
 *
 * Each sub-module can be accessed via its factory function:
 *   dagger call node ci --source=.
 *   dagger call vscode-extension ci --source=.
 *   dagger call nextjs ci --source=.
 *   dagger call npm-package ci --source=.
 *   dagger call cloudflare-worker ci --source=.
 *
 * .NET functions remain on the root object for backward compatibility:
 *   dagger call build --source=. --solution="MyLib.sln"
 */
import {
  dag,
  Container,
  Directory,
  Secret,
  object,
  func,
} from "@dagger.io/dagger"

import { NodeCi } from "./node.js"
import { VscodeExtension } from "./vscode-extension.js"
import { Nextjs } from "./nextjs.js"
import { NpmPackage } from "./npm-package.js"
import { CloudflareWorker } from "./cloudflare-worker.js"

export { NodeCi } from "./node.js"
export { VscodeExtension } from "./vscode-extension.js"
export { Nextjs } from "./nextjs.js"
export { NpmPackage } from "./npm-package.js"
export { CloudflareWorker } from "./cloudflare-worker.js"

@object()
export class DaggerPipelines {
  // ── Sub-module accessors ────────────────────────────────────────────

  /**
   * Node.js CI pipeline (install, typecheck, lint, test, build)
   */
  @func()
  node(): NodeCi {
    return new NodeCi()
  }

  /**
   * VS Code Extension pipeline (build, package VSIX, publish)
   */
  @func()
  vscodeExtension(): VscodeExtension {
    return new VscodeExtension()
  }

  /**
   * Next.js pipeline (lint, typecheck, build, static export)
   */
  @func()
  nextjs(): Nextjs {
    return new Nextjs()
  }

  /**
   * npm Package pipeline (typecheck, test, pack, publish)
   */
  @func()
  npmPackage(): NpmPackage {
    return new NpmPackage()
  }

  /**
   * Cloudflare Worker pipeline (typecheck, deploy)
   */
  @func()
  cloudflareWorker(): CloudflareWorker {
    return new CloudflareWorker()
  }

  // ── .NET pipeline functions ─────────────────────────────────────────
  /**
   * Base .NET SDK container with source mounted and restored
   */
  @func()
  restore(
    source: Directory,
    solution: string,
    dotnetVersion: string = "8.0",
  ): Container {
    return dag
      .container()
      .from(`mcr.microsoft.com/dotnet/sdk:${dotnetVersion}`)
      .withMountedDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["dotnet", "restore", solution])
  }

  /**
   * Build in Release configuration
   */
  @func()
  build(
    source: Directory,
    solution: string,
    dotnetVersion: string = "8.0",
    configuration: string = "Release",
  ): Container {
    return this.restore(source, solution, dotnetVersion).withExec([
      "dotnet",
      "build",
      solution,
      "--no-restore",
      "--configuration",
      configuration,
    ])
  }

  /**
   * Run tests for a specific test project or the full solution
   */
  @func()
  async test(
    source: Directory,
    solution: string,
    dotnetVersion: string = "8.0",
    configuration: string = "Release",
    testProject: string = "",
  ): Promise<string> {
    const target = testProject || solution
    return this.build(source, solution, dotnetVersion, configuration)
      .withExec([
        "dotnet",
        "test",
        target,
        "--no-build",
        "--configuration",
        configuration,
        "--verbosity",
        "normal",
      ])
      .stdout()
  }

  /**
   * Pack one or more projects into NuGet packages
   *
   * Pass a single .csproj path or comma-separated list for multi-package solutions.
   * Example: "src/Lib/Lib.csproj" or "src/A/A.csproj,src/B/B.csproj"
   */
  @func()
  pack(
    source: Directory,
    solution: string,
    projects: string,
    version: string = "1.0.0",
    dotnetVersion: string = "8.0",
    configuration: string = "Release",
  ): Container {
    const built = this.build(source, solution, dotnetVersion, configuration)
    const projectList = projects.split(",").map((p) => p.trim())

    let container = built
    for (const project of projectList) {
      container = container.withExec([
        "dotnet",
        "pack",
        project,
        "--no-build",
        "--configuration",
        configuration,
        "--output",
        "/packages",
        `/p:Version=${version}`,
      ])
    }

    return container
  }

  /**
   * Push all .nupkg files from /packages to NuGet.org
   */
  @func()
  async publish(
    container: Container,
    nugetApiKey: Secret,
    nugetSource: string = "https://api.nuget.org/v3/index.json",
  ): Promise<string> {
    return container
      .withSecretVariable("NUGET_API_KEY", nugetApiKey)
      .withExec([
        "sh",
        "-c",
        `dotnet nuget push "/packages/*.nupkg" --api-key "$NUGET_API_KEY" --source "${nugetSource}" --skip-duplicate`,
      ])
      .stdout()
  }

  /**
   * Full CI pipeline: restore → build → test → pack
   *
   * Returns the container with .nupkg files in /packages ready for publish.
   */
  @func()
  async ci(
    source: Directory,
    solution: string,
    projects: string,
    version: string = "1.0.0",
    dotnetVersion: string = "8.0",
    configuration: string = "Release",
    testProject: string = "",
  ): Promise<Container> {
    const built = this.build(source, solution, dotnetVersion, configuration)

    // Run tests — fail fast before packing
    const target = testProject || solution
    await built
      .withExec([
        "dotnet",
        "test",
        target,
        "--no-build",
        "--configuration",
        configuration,
        "--verbosity",
        "normal",
      ])
      .stdout()

    // Pack from the same built container
    const projectList = projects.split(",").map((p) => p.trim())
    let container = built
    for (const project of projectList) {
      container = container.withExec([
        "dotnet",
        "pack",
        project,
        "--no-build",
        "--configuration",
        configuration,
        "--output",
        "/packages",
        `/p:Version=${version}`,
      ])
    }

    return container
  }

  /**
   * Full release pipeline: ci (build → test → pack) → publish to NuGet
   *
   * CLI-friendly function that combines ci + publish in one call.
   * Use this from GitHub Actions or local CLI when you want to build, test,
   * pack, and push to NuGet in a single command.
   */
  @func()
  async release(
    source: Directory,
    solution: string,
    projects: string,
    nugetApiKey: Secret,
    version: string = "1.0.0",
    dotnetVersion: string = "8.0",
    configuration: string = "Release",
    testProject: string = "",
    nugetSource: string = "https://api.nuget.org/v3/index.json",
  ): Promise<string> {
    const packed = await this.ci(
      source,
      solution,
      projects,
      version,
      dotnetVersion,
      configuration,
      testProject,
    )

    return this.publish(packed, nugetApiKey, nugetSource)
  }

  // ── Test functions ──────────────────────────────────────────────────
  // Run against the testdata/ fixture project to validate pipeline steps.
  // Usage: dagger call test-restore, dagger call test-build, etc.

  /**
   * Verify NuGet restore succeeds against the test fixture
   */
  @func()
  async testRestore(): Promise<string> {
    const source = dag.currentModule().source().directory("testdata")
    const container = this.restore(source, "TestProject.sln")
    return container
      .withExec(["dotnet", "restore", "TestProject.sln", "--verbosity", "minimal"])
      .stdout()
  }

  /**
   * Verify build succeeds against the test fixture
   */
  @func()
  async testBuild(): Promise<string> {
    const source = dag.currentModule().source().directory("testdata")
    return this.build(source, "TestProject.sln")
      .withExec(["sh", "-c", "echo BUILD_OK"])
      .stdout()
  }

  /**
   * Verify tests pass against the test fixture
   */
  @func()
  async testTest(): Promise<string> {
    const source = dag.currentModule().source().directory("testdata")
    return this.test(source, "TestProject.sln")
  }

  /**
   * Verify pack produces .nupkg files in /packages
   */
  @func()
  async testPack(): Promise<string> {
    const source = dag.currentModule().source().directory("testdata")
    return this.pack(
      source,
      "TestProject.sln",
      "src/TestLib/TestLib.csproj",
      "0.0.0-test",
    )
      .withExec(["sh", "-c", "ls /packages/*.nupkg && echo PACK_OK"])
      .stdout()
  }

  /**
   * Verify the full CI pipeline (restore → build → test → pack) end-to-end
   */
  @func()
  async testCi(): Promise<string> {
    const source = dag.currentModule().source().directory("testdata")
    const container = await this.ci(
      source,
      "TestProject.sln",
      "src/TestLib/TestLib.csproj",
      "0.0.0-test",
    )
    return container
      .withExec(["sh", "-c", "ls /packages/*.nupkg && echo CI_OK"])
      .stdout()
  }
}
