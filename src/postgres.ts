/**
 * Reusable Postgres service pipeline functions for Dagger
 *
 * Provides a throwaway Postgres server as a Dagger `Service` for integration
 * tests and other DB-dependent pipeline steps. The service is ephemeral —
 * this module starts a Postgres, waits until it is ready to serve, binds it to
 * a consuming container, and exposes the connection string as an environment
 * variable. It does not apply migrations, seed data, or assume any schema:
 * the job ends at "a Postgres is reachable and its connection string is set".
 *
 * Every knob is a parameter with a default, so a caller wanting a different
 * image, database name, credentials, hostname, port, or connection-string
 * variable never has to fork the module.
 *
 * Standalone:
 *   dagger call postgres service --db-name=mydb
 *   dagger call postgres test-connection   # connects and prints server version
 */
import {
  dag,
  Container,
  Service,
  object,
  func,
} from "@dagger.io/dagger"

@object()
export class Postgres {
  /**
   * A ready-to-bind Postgres service
   *
   * Returns a Dagger `Service` running Postgres from the given image with the
   * database, user, and password provisioned by the image's entrypoint. Bind
   * it to any container with `withServiceBinding(host, service)`; the container
   * then reaches Postgres at `host:port`.
   */
  @func()
  service(
    dbName: string = "app",
    user: string = "postgres",
    password: string = "postgres",
    image: string = "postgres:16-alpine",
    port: number = 5432,
  ): Service {
    return dag
      .container()
      .from(image)
      .withEnvVariable("POSTGRES_DB", dbName)
      .withEnvVariable("POSTGRES_USER", user)
      .withEnvVariable("POSTGRES_PASSWORD", password)
      .withExposedPort(port)
      .asService({ useEntrypoint: true })
  }

  /**
   * Build a libpq connection string for a bound Postgres service
   *
   * `host` is the alias the service is bound under in the consuming container.
   */
  @func()
  connectionString(
    host: string = "postgres",
    dbName: string = "app",
    user: string = "postgres",
    password: string = "postgres",
    port: number = 5432,
  ): string {
    return `postgresql://${user}:${password}@${host}:${port}/${dbName}`
  }

  /**
   * Bind a Postgres service to a container, ready to use
   *
   * Waits until Postgres is actually accepting connections — a bound Postgres
   * answers on its TCP port before it can serve queries, so this runs
   * `pg_isready` in a retry loop against the service first and only returns once
   * it reports ready. The returned container has the service bound under `host`
   * and the connection string exported as `connStringEnv` (default
   * `DATABASE_URL`), so DB-dependent steps can connect immediately.
   */
  @func()
  async bind(
    container: Container,
    service: Service,
    host: string = "postgres",
    dbName: string = "app",
    user: string = "postgres",
    password: string = "postgres",
    port: number = 5432,
    image: string = "postgres:16-alpine",
    connStringEnv: string = "DATABASE_URL",
  ): Promise<Container> {
    await this.waitUntilReady(service, host, dbName, user, port, image)

    return container
      .withServiceBinding(host, service)
      .withEnvVariable(
        connStringEnv,
        this.connectionString(host, dbName, user, password, port),
      )
  }

  /**
   * Block until a Postgres service is ready to serve
   *
   * Runs `pg_isready` from the Postgres image (which always ships it) against
   * the bound service in a retry loop, forcing the service to start and
   * settle before any caller depends on it. Throws if it never becomes ready.
   */
  @func()
  async waitUntilReady(
    service: Service,
    host: string = "postgres",
    dbName: string = "app",
    user: string = "postgres",
    port: number = 5432,
    image: string = "postgres:16-alpine",
    attempts: number = 60,
  ): Promise<string> {
    const probe = `for i in $(seq 1 ${attempts}); do ` +
      `pg_isready -h ${host} -p ${port} -U ${user} -d ${dbName} && exit 0; ` +
      `sleep 1; done; ` +
      `echo "postgres at ${host}:${port} not ready after ${attempts}s" >&2; exit 1`

    return dag
      .container()
      .from(image)
      .withServiceBinding(host, service)
      .withExec(["sh", "-c", probe])
      .stdout()
  }

  // ── Test functions ──────────────────────────────────────────────────
  // Prove the service is genuinely connectable, not just plumbed through.

  /**
   * Connect to a freshly started Postgres service and report its version
   *
   * Starts a default service, waits for readiness, then runs `SELECT version()`
   * with `psql`. Fails unless a real server answers — proof the binding works
   * end to end, not just that a parameter threads through.
   */
  @func()
  async testConnection(): Promise<string> {
    const svc = this.service()
    const client = await this.bind(
      dag.container().from("postgres:16-alpine"),
      svc,
    )
    return client
      .withExec([
        "sh",
        "-c",
        'psql "$DATABASE_URL" -tAc "select version()"',
      ])
      .stdout()
  }

  /**
   * Connect using fully custom knobs and report the server version
   *
   * Runs with a non-default database name, user, password, hostname, and
   * connection-string variable to prove none of the parameters are ignored.
   */
  @func()
  async testConnectionCustom(): Promise<string> {
    const dbName = "customdb"
    const user = "customuser"
    const password = "custompass"
    const host = "db"
    const env = "MYAPP_DB"

    const svc = this.service(dbName, user, password)
    const client = await this.bind(
      dag.container().from("postgres:16-alpine"),
      svc,
      host,
      dbName,
      user,
      password,
      5432,
      "postgres:16-alpine",
      env,
    )
    const version = await client
      .withExec(["sh", "-c", `psql "$${env}" -tAc "select version()"`])
      .stdout()

    return `CUSTOM_OK (${env}): ${version.trim()}`
  }
}
