/**
 * Reusable .NET CI/CD pipeline functions for Dagger
 *
 * Provides composable pipeline steps for .NET projects: restore, build, test,
 * pack, and NuGet publish. Each function can be called individually or chained
 * together via the `ci` function for a complete pipeline run.
 */
import {
  dag,
  Container,
  Directory,
  Secret,
  object,
  func,
} from "@dagger.io/dagger"

@object()
export class DaggerPipelines {
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
