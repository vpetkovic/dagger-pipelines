/**
 * Version resolution for Dagger CI/CD pipelines
 *
 * NerdBank-style semver versioning driven by branch context.
 * Git tags are the source of truth — no version.json needed.
 *
 * Version matrix:
 *   PR builds:       1.2.0-pr.47.156  (or 1.2.0-ci.156 without PR number)
 *   dev/develop:     1.2.0-dev.156
 *   stage/staging:   1.2.0-rc.156
 *   main/master/tag: 1.2.0
 *   other branches:  1.2.0-dev.156    (non-zero height fallback)
 */
import {
  object,
  func,
} from "@dagger.io/dagger"

@object()
export class Versioning {
  /**
   * Resolve a semver version based on branch context.
   *
   * Pass git info from your CI environment — the function computes the
   * correct prerelease suffix. Locally testable:
   *   dagger call versioning resolve --base-version=1.2.0 --branch=dev --height=42
   */
  @func()
  resolve(
    baseVersion: string,
    branch: string = "main",
    height: string = "0",
    context: string = "",
    prNumber: string = "",
  ): string {
    const base = baseVersion.replace(/^v/, "")

    if (context === "pr" || branch.startsWith("pull/")) {
      const resolved = prNumber || branch.match(/^pull\/(\d+)/)?.[1] || ""
      const suffix = resolved ? `pr.${resolved}.${height}` : `ci.${height}`
      return `${base}-${suffix}`
    }

    if (branch === "dev" || branch === "develop") {
      return `${base}-dev.${height}`
    }

    if (branch === "stage" || branch === "staging") {
      return `${base}-rc.${height}`
    }

    if (branch === "main" || branch === "master") {
      return base
    }

    // Feature branches or unknown — treat as dev build if there are commits past the tag
    if (height !== "0") {
      return `${base}-dev.${height}`
    }

    return base
  }
}
