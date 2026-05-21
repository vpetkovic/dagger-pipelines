/**
 * Changelog generation pipeline functions for Dagger
 *
 * Parses conventional commit messages into a categorized markdown changelog.
 * Takes raw git log output as input (same pattern as the Versioning module —
 * Dagger containers don't have .git access, so git info is extracted before
 * calling the module).
 *
 * Expected input format (one commit per line):
 *   feat: add user authentication
 *   fix: resolve login redirect loop
 *   docs: update API reference
 *   feat(auth): add OAuth2 support
 */
import {
  object,
  func,
} from "@dagger.io/dagger"

const CATEGORY_MAP: Record<string, string> = {
  feat: "Features",
  fix: "Bug Fixes",
  docs: "Documentation",
  style: "Styles",
  refactor: "Refactoring",
  perf: "Performance",
  test: "Tests",
  build: "Build",
  ci: "CI/CD",
  chore: "Chores",
}

@object()
export class Changelog {
  /**
   * Generate a markdown changelog from conventional commit messages
   *
   * Pass the output of `git log --oneline` or similar. Each line is parsed
   * as a conventional commit and grouped by type. Non-conventional lines
   * are grouped under "Other Changes".
   *
   * Usage from CI:
   *   COMMITS=$(git log v1.0.0..HEAD --oneline --no-decorate)
   *   dagger call changelog generate --commits="$COMMITS" --version="1.1.0"
   */
  @func()
  generate(
    commits: string,
    version: string = "Unreleased",
    date: string = "",
  ): string {
    const lines = commits
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)

    const categories: Record<string, string[]> = {}
    const other: string[] = []

    for (const line of lines) {
      const match = line.match(
        /^(?:[a-f0-9]+\s+)?(\w+)(?:\(([^)]*)\))?!?:\s*(.+)$/,
      )

      if (match) {
        const [, type, scope, description] = match
        const category = CATEGORY_MAP[type] || "Other Changes"

        if (!categories[category]) {
          categories[category] = []
        }

        const entry = scope ? `**${scope}:** ${description}` : description
        categories[category].push(entry)
      } else {
        other.push(line)
      }
    }

    const header = date ? `## ${version} (${date})` : `## ${version}`
    const sections: string[] = [header, ""]

    const categoryOrder = Object.values(CATEGORY_MAP)
    for (const category of categoryOrder) {
      if (categories[category]?.length) {
        sections.push(`### ${category}`, "")
        for (const entry of categories[category]) {
          sections.push(`- ${entry}`)
        }
        sections.push("")
      }
    }

    const allOther = [
      ...(categories["Other Changes"] ?? []),
      ...other,
    ]
    if (allOther.length) {
      sections.push("### Other Changes", "")
      for (const entry of allOther) {
        sections.push(`- ${entry}`)
      }
      sections.push("")
    }

    return sections.join("\n")
  }
}
