/**
 * Cloudflare Worker CI/CD pipeline functions for Dagger
 *
 * Provides composable pipeline steps for Cloudflare Workers: install,
 * typecheck, and deploy via wrangler.
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
export class CloudflareWorker {
  /**
   * Base container with Node.js, source mounted, and dependencies installed
   */
  @func()
  install(
    source: Directory,
    nodeVersion: string = "20",
  ): Container {
    return dag
      .container()
      .from(`node:${nodeVersion}`)
      .withMountedDirectory("/app", source)
      .withWorkdir("/app")
      .withExec(["npm", "ci"])
  }

  /**
   * Run TypeScript type checking
   */
  @func()
  async typecheck(
    source: Directory,
    nodeVersion: string = "20",
  ): Promise<string> {
    return this.install(source, nodeVersion)
      .withExec(["npx", "tsc", "--noEmit"])
      .stdout()
  }

  /**
   * Deploy the worker via wrangler
   */
  @func()
  async deploy(
    source: Directory,
    cfApiToken: Secret,
    cfAccountId: string,
    nodeVersion: string = "20",
    environment: string = "",
  ): Promise<string> {
    const args = ["npx", "wrangler", "deploy"]
    if (environment) {
      args.push("--env", environment)
    }

    return this.install(source, nodeVersion)
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
  ): Promise<string> {
    return this.install(source, nodeVersion)
      .withExec(["npx", "tsc", "--noEmit"])
      .withExec(["sh", "-c", "echo CI_OK"])
      .stdout()
  }
}
