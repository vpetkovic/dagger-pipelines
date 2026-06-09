/**
 * PR Preview Deploy pipeline functions for Dagger
 *
 * Deploys a built site to Cloudflare Pages for PR preview URLs.
 * Basic implementation — deploy a directory to a Cloudflare Pages project.
 */
import {
  dag,
  Directory,
  Secret,
  object,
  func,
} from "@dagger.io/dagger"

@object()
export class PreviewDeploy {
  /**
   * Deploy a directory to Cloudflare Pages
   *
   * Deploys the given output directory to a Cloudflare Pages project.
   * Returns the preview URL. For PR builds, Cloudflare auto-generates
   * a unique preview URL per deployment.
   *
   * Set `commitDirty` to deploy without a clean git tree (the built output
   * directory is mounted standalone, so wrangler otherwise treats it as dirty).
   */
  @func()
  async deploy(
    source: Directory,
    projectName: string,
    cfApiToken: Secret,
    cfAccountId: string,
    branch: string = "",
    nodeVersion: string = "20",
    commitDirty: boolean = false,
  ): Promise<string> {
    const args = [
      "npx", "wrangler", "pages", "deploy", ".",
      "--project-name", projectName,
    ]

    if (branch) {
      args.push("--branch", branch)
    }

    if (commitDirty) {
      args.push("--commit-dirty=true")
    }

    return dag
      .container()
      .from(`node:${nodeVersion}`)
      .withExec(["npm", "install", "-g", "wrangler"])
      .withMountedDirectory("/deploy", source)
      .withWorkdir("/deploy")
      .withSecretVariable("CLOUDFLARE_API_TOKEN", cfApiToken)
      .withEnvVariable("CLOUDFLARE_ACCOUNT_ID", cfAccountId)
      .withExec(args)
      .stdout()
  }
}
