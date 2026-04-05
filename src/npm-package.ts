/**
 * npm Package CI/CD pipeline functions for Dagger
 *
 * Provides composable pipeline steps for npm libraries: install, typecheck,
 * test, pack, and publish to npm registry.
 */
import {
  Container,
  Directory,
  Secret,
  object,
  func,
} from "@dagger.io/dagger"

import { createNodeContainer, runCommand } from "./node-utils.js"

const PACK_CMD = ["sh", "-c", "mkdir -p /packages && npm pack --pack-destination /packages"]

@object()
export class NpmPackage {
  /**
   * Base container with Node.js, source mounted, and dependencies installed
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
   * Pack the package into a tarball (.tgz)
   *
   * Runs build first, then npm pack into /packages directory.
   */
  @func()
  pack(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    buildScript: string = "build",
  ): Container {
    return this.install(source, nodeVersion, packageManager)
      .withExec(runCommand(packageManager, buildScript))
      .withExec(PACK_CMD)
  }

  /**
   * Publish the package to npm registry
   */
  @func()
  async publish(
    container: Container,
    npmToken: Secret,
    registry: string = "https://registry.npmjs.org",
  ): Promise<string> {
    const registryHost = registry
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")

    return container
      .withSecretVariable("NPM_TOKEN", npmToken)
      .withExec([
        "sh",
        "-c",
        `echo "//${registryHost}/:_authToken=\${NPM_TOKEN}" > ~/.npmrc && npm publish --registry "${registry}" --provenance --access public`,
      ])
      .stdout()
  }

  /**
   * Full CI pipeline: install → typecheck → test → build → pack
   */
  @func()
  ci(
    source: Directory,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    buildScript: string = "build",
    testScript: string = "test",
    skipTest: boolean = false,
  ): Container {
    let container = this.install(source, nodeVersion, packageManager)

    container = container.withExec(["npx", "tsc", "--noEmit"])

    if (!skipTest) {
      container = container.withExec(runCommand(packageManager, testScript))
    }

    container = container.withExec(runCommand(packageManager, buildScript))
    container = container.withExec(PACK_CMD)

    return container
  }

  /**
   * Full release pipeline: ci → publish to npm
   */
  @func()
  async release(
    source: Directory,
    npmToken: Secret,
    nodeVersion: string = "20",
    packageManager: string = "npm",
    buildScript: string = "build",
    testScript: string = "test",
    skipTest: boolean = false,
    registry: string = "https://registry.npmjs.org",
  ): Promise<string> {
    const packed = this.ci(
      source,
      nodeVersion,
      packageManager,
      buildScript,
      testScript,
      skipTest,
    )
    return this.publish(packed, npmToken, registry)
  }
}
