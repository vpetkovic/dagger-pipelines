/**
 * Cloudflare Pages deploy pipeline functions for Dagger
 *
 * Deploys a pre-built static artifact directory to a Cloudflare Pages project
 * via wrangler. Environment is selected by the Pages branch (production branch
 * = prod; named branches = preview aliases such as `staging` / `dev`), so the
 * same artifact promotes across environments unchanged.
 *
 * This is the platform-specific home for Pages deploys; generic build/artifact
 * concerns stay in the `frontend` module (e.g. `frontend write-runtime-config`).
 */
import {
  dag,
  Directory,
  Secret,
  object,
  func,
} from "@dagger.io/dagger"

@object()
export class CloudflarePages {
  /**
   * Deploy a built static directory to a Cloudflare Pages project.
   *
   * Returns wrangler's stdout (which includes the deployment URL). For a
   * non-production `branch`, Cloudflare serves a stable per-branch alias plus
   * a unique immutable per-deployment preview URL.
   *
   * Set `commitDirty` when the artifact is mounted standalone (no git tree),
   * which wrangler otherwise reports as a dirty deploy. The Cloudflare API
   * token is passed as a Dagger Secret and never logged.
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
