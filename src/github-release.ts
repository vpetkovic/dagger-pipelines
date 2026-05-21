/**
 * GitHub Release pipeline functions for Dagger
 *
 * Creates GitHub releases with optional artifact uploads via the gh CLI.
 * Runs in an Alpine container with gh installed — no local gh required.
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
export class GithubRelease {
  /**
   * Create a GitHub release
   *
   * Uses gh CLI inside a container to create a release on the specified repo.
   * Optionally uploads all files from an artifacts directory.
   */
  @func()
  async create(
    tag: string,
    repo: string,
    ghToken: Secret,
    title: string = "",
    notes: string = "",
    draft: boolean = false,
    prerelease: boolean = false,
    artifacts: Directory | null = null,
  ): Promise<string> {
    let container = dag
      .container()
      .from("alpine:3.20")
      .withExec(["apk", "add", "--no-cache", "github-cli"])
      .withSecretVariable("GH_TOKEN", ghToken)

    const cmd = ["gh", "release", "create", tag, "--repo", repo]

    if (title) {
      cmd.push("--title", title)
    }

    if (notes) {
      cmd.push("--notes", notes)
    }

    if (draft) {
      cmd.push("--draft")
    }

    if (prerelease) {
      cmd.push("--prerelease")
    }

    if (artifacts) {
      container = container.withMountedDirectory("/artifacts", artifacts)
      // Create release then upload artifacts via glob in a separate step
      container = container.withExec(cmd)
      return container
        .withExec(["sh", "-c", `gh release upload "${tag}" --repo "${repo}" /artifacts/*`])
        .stdout()
    }

    return container.withExec(cmd).stdout()
  }
}
