/**
 * .NET dependency audit pipeline functions for Dagger
 *
 * Lists vulnerable NuGet packages across a solution, including transitive
 * dependencies. Uses `dotnet list package --vulnerable`.
 */
import {
  dag,
  Directory,
  object,
  func,
} from "@dagger.io/dagger"

@object()
export class DotnetAudit {
  /**
   * Run dependency audit for a .NET project
   */
  @func()
  async audit(
    source: Directory,
    solution: string,
    dotnetVersion: string = "8.0",
  ): Promise<string> {
    return dag
      .container()
      .from(`mcr.microsoft.com/dotnet/sdk:${dotnetVersion}`)
      .withMountedDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["dotnet", "restore", solution])
      .withExec([
        "dotnet",
        "list",
        solution,
        "package",
        "--vulnerable",
        "--include-transitive",
      ])
      .stdout()
  }
}
