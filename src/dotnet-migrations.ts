/**
 * EF Core Migration validation pipeline functions for Dagger
 *
 * Validates that Entity Framework Core migrations compile and generate
 * valid SQL. Catches migration issues before they hit production.
 *
 * Uses `dotnet ef migrations script` which generates the full SQL migration
 * script without needing a running database — if migrations have compilation
 * errors or dependency issues, this command fails.
 */
import {
  dag,
  Container,
  Directory,
  object,
  func,
} from "@dagger.io/dagger"

@object()
export class DotnetMigrations {
  private baseContainer(
    source: Directory,
    dotnetVersion: string,
  ): Container {
    return dag
      .container()
      .from(`mcr.microsoft.com/dotnet/sdk:${dotnetVersion}`)
      .withMountedDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["dotnet", "tool", "install", "--global", "dotnet-ef"])
      .withEnvVariable("PATH", "/root/.dotnet/tools:$PATH", { expand: true })
      .withExec(["dotnet", "restore"])
      .withExec(["dotnet", "build", "--no-restore"])
  }

  private efArgs(
    subcommand: string[],
    project: string,
    startupProject: string,
    dbContext: string,
  ): string[] {
    const args = ["dotnet", "ef", ...subcommand, "--project", project]

    if (startupProject) {
      args.push("--startup-project", startupProject)
    }

    if (dbContext) {
      args.push("--context", dbContext)
    }

    return args
  }

  /**
   * Validate EF Core migrations produce valid SQL
   *
   * Installs the dotnet-ef tool, restores the project, and runs
   * `dotnet ef migrations script` to verify all migrations compile
   * and generate valid SQL. Fails if any migration is broken.
   *
   * Pass the project containing the DbContext and optionally a separate
   * startup project if your DbContext is in a class library.
   */
  @func()
  async validate(
    source: Directory,
    project: string,
    dotnetVersion: string = "8.0",
    startupProject: string = "",
    dbContext: string = "",
  ): Promise<string> {
    const scriptArgs = this.efArgs(
      ["migrations", "script", "--idempotent"],
      project,
      startupProject,
      dbContext,
    )
    scriptArgs.push("--output", "/migrations/script.sql")

    return this.baseContainer(source, dotnetVersion)
      .withExec(scriptArgs)
      .withExec(["sh", "-c", "echo MIGRATIONS_OK && wc -l /migrations/script.sql"])
      .stdout()
  }

  /**
   * List all pending migrations
   *
   * Shows the migration history for review.
   */
  @func()
  async list(
    source: Directory,
    project: string,
    dotnetVersion: string = "8.0",
    startupProject: string = "",
    dbContext: string = "",
  ): Promise<string> {
    const listArgs = this.efArgs(
      ["migrations", "list"],
      project,
      startupProject,
      dbContext,
    )

    return this.baseContainer(source, dotnetVersion)
      .withExec(listArgs)
      .stdout()
  }
}
