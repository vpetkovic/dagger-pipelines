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
  File,
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
    // Run tests (this chains restore → build → test)
    await this.test(
      source,
      solution,
      dotnetVersion,
      configuration,
      testProject,
    )

    // Pack (chains restore → build → pack)
    return this.pack(
      source,
      solution,
      projects,
      version,
      dotnetVersion,
      configuration,
    )
  }
}
