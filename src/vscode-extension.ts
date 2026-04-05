/**
 * VS Code Extension CI/CD pipeline functions for Dagger
 *
 * Provides composable pipeline steps for VS Code extensions: install, build,
 * package VSIX, and publish to the VS Code Marketplace.
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
export class VscodeExtension {
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
   * Build the extension (esbuild or tsc, depending on project)
   */
  @func()
  build(
    source: Directory,
    nodeVersion: string = "20",
    buildScript: string = "build",
  ): Container {
    return this.install(source, nodeVersion)
      .withExec(["npm", "run", buildScript])
  }

  /**
   * Package the extension as a .vsix file
   *
   * Installs @vscode/vsce and packages into /packages directory.
   */
  @func()
  package(
    source: Directory,
    nodeVersion: string = "20",
    buildScript: string = "build",
  ): Container {
    return this.build(source, nodeVersion, buildScript)
      .withExec([
        "npx",
        "@vscode/vsce",
        "package",
        "--out",
        "/packages/",
      ])
  }

  /**
   * Publish the extension to the VS Code Marketplace
   */
  @func()
  async publish(
    container: Container,
    vsceToken: Secret,
  ): Promise<string> {
    return container
      .withSecretVariable("VSCE_PAT", vsceToken)
      .withExec([
        "sh",
        "-c",
        'npx @vscode/vsce publish -p "$VSCE_PAT"',
      ])
      .stdout()
  }

  /**
   * Full CI pipeline: install → typecheck → build → package VSIX
   */
  @func()
  ci(
    source: Directory,
    nodeVersion: string = "20",
    buildScript: string = "build",
  ): Container {
    return this.install(source, nodeVersion)
      .withExec(["npx", "tsc", "--noEmit"])
      .withExec(["npm", "run", buildScript])
      .withExec(["npx", "@vscode/vsce", "package", "--out", "/packages/"])
  }

  /**
   * Full release pipeline: ci → publish to VS Code Marketplace
   */
  @func()
  async release(
    source: Directory,
    vsceToken: Secret,
    nodeVersion: string = "20",
    buildScript: string = "build",
  ): Promise<string> {
    const packed = this.ci(source, nodeVersion, buildScript)
    return this.publish(packed, vsceToken)
  }
}
