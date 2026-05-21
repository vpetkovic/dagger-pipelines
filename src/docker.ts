/**
 * Docker build and push pipeline functions for Dagger
 *
 * Uses Dagger's native container building APIs — no docker CLI needed.
 * Builds from a Dockerfile in the source directory and optionally pushes
 * to any OCI-compatible registry (GHCR, Docker Hub, ACR, ECR, etc.).
 */
import {
  Container,
  Directory,
  Secret,
  object,
  func,
} from "@dagger.io/dagger"

@object()
export class Docker {
  /**
   * Build a container image from a Dockerfile
   *
   * Uses Dagger's native build — same as `docker build` but fully containerized.
   */
  @func()
  build(
    source: Directory,
    dockerfile: string = "Dockerfile",
    target: string = "",
    buildArgs: string = "",
  ): Container {
    const opts: Record<string, unknown> = { dockerfile }

    if (target) {
      opts.target = target
    }

    if (buildArgs) {
      const args = buildArgs.split(",").map((arg) => {
        const [name, value] = arg.split("=", 2)
        return { name: name.trim(), value: value?.trim() ?? "" }
      })
      opts.buildArgs = args
    }

    return source.dockerBuild(opts)
  }

  /**
   * Push a built container to a registry
   *
   * Authenticates and publishes the image. Returns the image digest.
   */
  @func()
  async push(
    container: Container,
    address: string,
    registryUsername: string = "",
    registryPassword: Secret | null = null,
  ): Promise<string> {
    if (registryUsername && registryPassword) {
      const registry = address.split("/")[0]
      container = container.withRegistryAuth(
        registry,
        registryUsername,
        registryPassword,
      )
    }

    return container.publish(address)
  }

  /**
   * Full CI pipeline: build from Dockerfile
   *
   * Returns the built container for further use (push, test, etc.).
   */
  @func()
  ci(
    source: Directory,
    dockerfile: string = "Dockerfile",
    target: string = "",
    buildArgs: string = "",
  ): Container {
    return this.build(source, dockerfile, target, buildArgs)
  }

  /**
   * Full release pipeline: build + push to registry
   */
  @func()
  async release(
    source: Directory,
    address: string,
    registryUsername: string = "",
    registryPassword: Secret | null = null,
    dockerfile: string = "Dockerfile",
    target: string = "",
    buildArgs: string = "",
  ): Promise<string> {
    const built = this.build(source, dockerfile, target, buildArgs)
    return this.push(built, address, registryUsername, registryPassword)
  }
}
