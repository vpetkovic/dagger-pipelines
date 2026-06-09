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
 * - Node Audit: Node.js dependency vulnerability checks
 * - .NET Audit: .NET dependency vulnerability checks
 * - GitHub Release: create releases with artifact uploads
 * - Docker: build from Dockerfile, push to any OCI registry
 * - Preview Deploy: PR preview deployments to Cloudflare Pages
 * - DB Migrations: EF Core migration validation
 * - Changelog: conventional commit parsing to markdown
 *
 * Each sub-module can be accessed via its factory function:
 *   dagger call node ci --source=.
 *   dagger call vscode-extension ci --source=.
 *   dagger call nextjs ci --source=.
 *   dagger call npm-package ci --source=.
 *   dagger call cloudflare-worker ci --source=.
 *   dagger call node-audit audit --source=.
 *   dagger call dotnet-audit audit --source=. --solution="MyLib.sln"
 *   dagger call github-release create --tag=v1.0.0 --repo=user/repo
 *   dagger call docker ci --source=.
 *   dagger call preview-deploy deploy --source=./out --project-name=my-site
 *   dagger call dotnet-migrations validate --source=. --project=src/MyApp
 *   dagger call changelog generate --commits="feat: ..."
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
import { Frontend } from "./frontend.js"
import { VscodeExtension } from "./vscode-extension.js"
import { Nextjs } from "./nextjs.js"
import { NpmPackage } from "./npm-package.js"
import { CloudflareWorker } from "./cloudflare-worker.js"
import { Versioning } from "./versioning.js"
import { NodeAudit } from "./node-audit.js"
import { DotnetAudit } from "./dotnet-audit.js"
import { GithubRelease } from "./github-release.js"
import { Docker } from "./docker.js"
import { PreviewDeploy } from "./preview-deploy.js"
import { DotnetMigrations } from "./dotnet-migrations.js"
import { Changelog } from "./changelog.js"

export { NodeCi } from "./node.js"
export { Frontend } from "./frontend.js"
export { VscodeExtension } from "./vscode-extension.js"
export { Nextjs } from "./nextjs.js"
export { NpmPackage } from "./npm-package.js"
export { CloudflareWorker } from "./cloudflare-worker.js"
export { Versioning } from "./versioning.js"
export { NodeAudit } from "./node-audit.js"
export { DotnetAudit } from "./dotnet-audit.js"
export { GithubRelease } from "./github-release.js"
export { Docker } from "./docker.js"
export { PreviewDeploy } from "./preview-deploy.js"
export { DotnetMigrations } from "./dotnet-migrations.js"
export { Changelog } from "./changelog.js"

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
   * Frontend monorepo CI pipeline (Turborepo + pnpm: typecheck, test, build, export)
   */
  @func()
  frontend(): Frontend {
    return new Frontend()
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

  /**
   * Version resolver (NerdBank-style semver from branch context)
   */
  @func()
  versioning(): Versioning {
    return new Versioning()
  }

  /**
   * Node.js dependency audit pipeline
   */
  @func()
  nodeAudit(): NodeAudit {
    return new NodeAudit()
  }

  /**
   * .NET dependency audit pipeline
   */
  @func()
  dotnetAudit(): DotnetAudit {
    return new DotnetAudit()
  }

  /**
   * GitHub Release pipeline (create releases with artifact uploads)
   */
  @func()
  githubRelease(): GithubRelease {
    return new GithubRelease()
  }

  /**
   * Docker build and push pipeline (Dockerfile → registry)
   */
  @func()
  docker(): Docker {
    return new Docker()
  }

  /**
   * PR preview deploy pipeline (Cloudflare Pages)
   */
  @func()
  previewDeploy(): PreviewDeploy {
    return new PreviewDeploy()
  }

  /**
   * EF Core migration validation pipeline
   */
  @func()
  dotnetMigrations(): DotnetMigrations {
    return new DotnetMigrations()
  }

  /**
   * Changelog generation from conventional commits
   */
  @func()
  changelog(): Changelog {
    return new Changelog()
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

  // ── Versioning test functions ───────────────────────────────────────

  /**
   * Verify PR version produces correct prerelease suffix
   */
  @func()
  testVersionPr(): string {
    const v = this.versioning()
    const withPr = v.resolve("1.2.0", "pull/47/merge", "156", "pr", "47")
    const withoutPr = v.resolve("1.2.0", "main", "156", "pr", "")
    const autoExtract = v.resolve("1.2.0", "pull/47/merge", "156")
    const expected1 = "1.2.0-pr.47.156"
    const expected2 = "1.2.0-ci.156"
    const expected3 = "1.2.0-pr.47.156"
    if (withPr !== expected1) {
      throw new Error(`PR version: expected ${expected1}, got ${withPr}`)
    }
    if (withoutPr !== expected2) {
      throw new Error(`CI version: expected ${expected2}, got ${withoutPr}`)
    }
    if (autoExtract !== expected3) {
      throw new Error(`Auto-extract PR: expected ${expected3}, got ${autoExtract}`)
    }
    return `PR_OK: ${withPr} | ${withoutPr} | auto=${autoExtract}`
  }

  /**
   * Verify dev/stage branches produce correct prerelease suffixes
   */
  @func()
  testVersionDev(): string {
    const v = this.versioning()
    const dev = v.resolve("2.0.0", "dev", "42")
    const develop = v.resolve("2.0.0", "develop", "42")
    const stage = v.resolve("2.0.0", "stage", "10")
    const staging = v.resolve("2.0.0", "staging", "10")
    const feature = v.resolve("2.0.0", "feature/my-thing", "5")

    if (dev !== "2.0.0-dev.42") throw new Error(`dev: expected 2.0.0-dev.42, got ${dev}`)
    if (develop !== "2.0.0-dev.42") throw new Error(`develop: expected 2.0.0-dev.42, got ${develop}`)
    if (stage !== "2.0.0-rc.10") throw new Error(`stage: expected 2.0.0-rc.10, got ${stage}`)
    if (staging !== "2.0.0-rc.10") throw new Error(`staging: expected 2.0.0-rc.10, got ${staging}`)
    if (feature !== "2.0.0-dev.5") throw new Error(`feature: expected 2.0.0-dev.5, got ${feature}`)

    return `DEV_OK: dev=${dev} | develop=${develop} | stage=${stage} | staging=${staging} | feature=${feature}`
  }

  /**
   * Verify main/master/tag produce clean versions
   */
  @func()
  testVersionRelease(): string {
    const v = this.versioning()
    const main = v.resolve("3.1.0", "main", "0")
    const master = v.resolve("3.1.0", "master", "0")
    const vPrefix = v.resolve("v3.1.0", "main", "0")
    const zeroHeight = v.resolve("3.1.0", "feature/x", "0")

    if (main !== "3.1.0") throw new Error(`main: expected 3.1.0, got ${main}`)
    if (master !== "3.1.0") throw new Error(`master: expected 3.1.0, got ${master}`)
    if (vPrefix !== "3.1.0") throw new Error(`v-prefix: expected 3.1.0, got ${vPrefix}`)
    if (zeroHeight !== "3.1.0") throw new Error(`zero-height: expected 3.1.0, got ${zeroHeight}`)

    return `RELEASE_OK: main=${main} | master=${master} | v-prefix=${vPrefix} | zero-height=${zeroHeight}`
  }

  // ── New module test functions ───────────────────────────────────────

  /**
   * Verify changelog generates correct markdown from conventional commits
   */
  @func()
  testChangelog(): string {
    const c = this.changelog()
    const commits = [
      "abc1234 feat: add user authentication",
      "def5678 fix: resolve login redirect loop",
      "aaa9012 docs: update API reference",
      "bbb3456 feat(auth): add OAuth2 support",
      "ccc7890 chore: bump dependencies",
    ].join("\n")

    const result = c.generate(commits, "1.0.0", "2026-05-07")

    if (!result.includes("## 1.0.0 (2026-05-07)")) {
      throw new Error(`Missing version header, got: ${result.substring(0, 100)}`)
    }
    if (!result.includes("### Features")) {
      throw new Error("Missing Features section")
    }
    if (!result.includes("### Bug Fixes")) {
      throw new Error("Missing Bug Fixes section")
    }
    if (!result.includes("### Documentation")) {
      throw new Error("Missing Documentation section")
    }
    if (!result.includes("**auth:** add OAuth2 support")) {
      throw new Error("Missing scoped feat entry")
    }
    if (!result.includes("### Chores")) {
      throw new Error("Missing Chores section")
    }

    return `CHANGELOG_OK: ${result.split("\n").length} lines generated`
  }

  /**
   * Verify .NET audit runs against the test fixture
   */
  @func()
  async testDotnetAudit(): Promise<string> {
    const source = dag.currentModule().source().directory("testdata")
    const result = await this.dotnetAudit().audit(source, "TestProject.sln")
    return `DOTNET_AUDIT_OK: ${result.length} chars output`
  }

  /**
   * Verify Node.js audit runs against a minimal fixture
   */
  @func()
  async testNodeAudit(): Promise<string> {
    const source = dag.currentModule().source().directory("testdata/node")
    const result = await this.nodeAudit().audit(source)
    return `NODE_AUDIT_OK: ${result.length} chars output`
  }

  /**
   * Verify Docker build from a Dockerfile in testdata
   */
  @func()
  async testDockerBuild(): Promise<string> {
    const source = dag.currentModule().source().directory("testdata")
    const container = this.docker().build(source)
    return container
      .withExec(["cat", "/build-marker.txt"])
      .stdout()
  }
}
