/**
 * Cloudflare Worker CI/CD pipeline functions for Dagger
 *
 * Provides composable pipeline steps for Cloudflare Workers: install,
 * typecheck, deploy (any wrangler-based deploy, including build-then-deploy
 * apps like OpenNext), and D1 SQL execution. Package-manager agnostic
 * (npm/pnpm/bun) via the shared node container helper.
 */
import {
  Container,
  Directory,
  Secret,
  object,
  func,
} from "@dagger.io/dagger"

import { createNodeContainer, runCommand } from "./node-utils.js"

@object()
export class CloudflareWorker {
  /**
   * Base container with Node.js, source mounted, and dependencies installed.
   * Honors the chosen package manager (npm/pnpm/bun).
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
   * Run TypeScript type checking
   */
  @func()
  async typecheck(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
  ): Promise<string> {
    return this.install(source, nodeVersion, packageManager)
      .withExec(["npx", "tsc", "--noEmit"])
      .stdout()
  }

  /**
   * Deploy via wrangler (or any wrangler-compatible deploy command).
   *
   * Generic across worker styles:
   *  - plain Worker        → defaults to `wrangler deploy`
   *  - build-then-deploy   → set `buildScript` to run a package script first
   *  - custom toolchains   → set `deployCommand` (e.g. for OpenNext:
   *                          "bunx opennextjs-cloudflare deploy")
   *
   * The Cloudflare API token is passed as a Dagger Secret (never logged).
   */
  @func()
  async deploy(
    source: Directory,
    cfApiToken: Secret,
    cfAccountId: string,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    buildScript: string = "",
    deployCommand: string = "",
    environment: string = "",
  ): Promise<string> {
    let container = this.install(source, nodeVersion, packageManager)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cfApiToken)
      .withEnvVariable("CLOUDFLARE_ACCOUNT_ID", cfAccountId)

    if (buildScript) {
      container = container.withExec(runCommand(packageManager, buildScript))
    }

    let cmd = deployCommand
    if (!cmd) {
      cmd = environment ? `npx wrangler deploy --env ${environment}` : "npx wrangler deploy"
    }

    return container.withExec(["sh", "-c", cmd]).stdout()
  }

  /**
   * Execute a SQL file against a Cloudflare D1 database via wrangler.
   * Generic — usable by any project with a D1 binding (migrations, seeds, syncs).
   * Named without a digit so the generated CLI command is unambiguous
   * (`execute-sql`).
   */
  @func()
  async executeSql(
    source: Directory,
    cfApiToken: Secret,
    cfAccountId: string,
    database: string,
    file: string,
    remote: boolean = true,
    nodeVersion: string = "20",
    packageManager: string = "npm",
  ): Promise<string> {
    const args = ["npx", "wrangler", "d1", "execute", database, "--file", file]
    if (remote) args.push("--remote")

    return this.install(source, nodeVersion, packageManager)
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cfApiToken)
      .withEnvVariable("CLOUDFLARE_ACCOUNT_ID", cfAccountId)
      .withExec(args)
      .stdout()
  }

  /**
   * Full CI pipeline: install → typecheck
   */
  @func()
  async ci(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
  ): Promise<string> {
    return this.install(source, nodeVersion, packageManager)
      .withExec(["npx", "tsc", "--noEmit"])
      .withExec(["sh", "-c", "echo CI_OK"])
      .stdout()
  }
}
