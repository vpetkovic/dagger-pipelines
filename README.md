# Dagger Pipelines

Reusable [Dagger](https://dagger.io) module for CI/CD pipelines. Provides composable, container-based pipeline functions for .NET, Node.js, Next.js, VS Code extensions, npm packages, and Cloudflare Workers.

## Why

Every project needs the same CI steps — install deps, typecheck, lint, test, build, maybe publish. Each repo had its own GitHub Actions YAML with the same CLI calls copy-pasted and slightly tweaked. When I needed to change a step, I was updating the same logic across a dozen workflows.

This Dagger module extracts those pipelines into composable, container-based definitions that any repo can call. One module, consistent behavior everywhere, and it runs the same locally as it does in CI.

## Modules

| Module | Access | Description |
|--------|--------|-------------|
| **.NET** | `dagger call [fn]` | restore, build, test, pack, NuGet publish |
| **Node.js** | `dagger call node [fn]` | install, typecheck, lint, test, build (npm/pnpm/bun) |
| **VS Code Extension** | `dagger call vscode-extension [fn]` | build, package VSIX, publish to Marketplace |
| **Next.js** | `dagger call nextjs [fn]` | lint, typecheck, build, static export |
| **npm Package** | `dagger call npm-package [fn]` | typecheck, test, pack, publish to npm |
| **Cloudflare Worker** | `dagger call cloudflare-worker [fn]` | typecheck, deploy via wrangler |

---

## .NET

Pipeline functions for .NET libraries and applications.

### Functions

| Function | Description |
|----------|-------------|
| `restore` | Restore NuGet packages for a solution |
| `build` | Build in Release configuration |
| `test` | Run tests for a project or solution |
| `pack` | Pack one or more projects into .nupkg files |
| `publish` | Push .nupkg files to NuGet.org |
| `ci` | Full pipeline: restore → build → test → pack |
| `release` | Full release: ci → publish to NuGet |

### Usage

```bash
# Full CI pipeline
dagger call ci \
  --source=. \
  --solution="MyLib.sln" \
  --projects="src/MyLib/MyLib.csproj" \
  --version="2.0.0"

# Multi-package solution (e.g., PaginationKit)
dagger call ci \
  --source=. \
  --solution="PaginationKit.slnx" \
  --projects="src/PaginationKit/PaginationKit.csproj,src/PaginationKit.AspNetCore/PaginationKit.AspNetCore.csproj,src/PaginationKit.FastEndpoints/PaginationKit.FastEndpoints.csproj" \
  --version="1.5.0" \
  --dotnet-version="10.0"

# Individual steps
dagger call build --source=. --solution="MyLib.sln"
dagger call test --source=. --solution="MyLib.sln" --test-project="tests/MyLib.Tests/MyLib.Tests.csproj"

# CI then publish
dagger call ci \
  --source=. \
  --solution="MyLib.sln" \
  --projects="src/MyLib/MyLib.csproj" \
  --version="2.0.0" \
  publish --nuget-api-key=env:NUGET_API_KEY
```

### Parameters

`restore`, `build`, `test`, `pack`, and `ci` accept these common parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `source` | — | Project source directory |
| `solution` | — | Path to .sln or .slnx file |
| `dotnet-version` | `8.0` | .NET SDK version tag |
| `configuration` | `Release` | Build configuration |

Additional:

- **`test`**: `test-project` — specific test .csproj (defaults to solution)
- **`pack`**: `projects` — comma-separated .csproj paths; `version` — package version
- **`publish`**: `nuget-api-key` — NuGet.org API key (Secret); `nuget-source` — feed URL
- **`ci`** / **`release`**: combines all of the above

---

## Node.js

General-purpose pipeline for any Node.js/TypeScript project. Supports npm, pnpm, and bun.

### Functions

| Function | Description |
|----------|-------------|
| `install` | Install dependencies with chosen package manager |
| `typecheck` | Run `tsc --noEmit` |
| `lint` | Run lint script |
| `test` | Run test script |
| `build` | Run build script |
| `ci` | Full pipeline: install → typecheck → lint → test → build |

### Usage

```bash
# Full CI
dagger call node ci --source=.

# With bun
dagger call node ci --source=. --package-manager=bun

# Just typecheck
dagger call node typecheck --source=.

# Skip lint and test
dagger call node ci --source=. --skip-lint --skip-test
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `source` | — | Project source directory |
| `node-version` | `20` | Node.js version tag |
| `package-manager` | `npm` | `npm`, `pnpm`, or `bun` |
| `build-script` | `build` | npm script name for build step |
| `lint-script` | `lint` | npm script name for lint step |
| `test-script` | `test` | npm script name for test step |
| `skip-lint` | `false` | Skip the lint step in `ci` |
| `skip-test` | `false` | Skip the test step in `ci` |

---

## VS Code Extension

Pipeline for VS Code extensions — build, package as VSIX, publish to Marketplace.

### Functions

| Function | Description |
|----------|-------------|
| `install` | Install dependencies |
| `build` | Build the extension |
| `package` | Package as .vsix into /packages |
| `publish` | Publish to VS Code Marketplace |
| `ci` | Full pipeline: install → typecheck → build → package |
| `release` | Full release: ci → publish to Marketplace |

### Usage

```bash
# Full CI (produces .vsix)
dagger call vscode-extension ci --source=.

# Build and publish
dagger call vscode-extension release \
  --source=. \
  --vsce-token=env:VSCE_PAT

# Just package
dagger call vscode-extension package --source=.
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `source` | — | Extension source directory |
| `node-version` | `20` | Node.js version tag |
| `build-script` | `build` | npm script name for build step |
| `vsce-token` | — | VS Code Marketplace PAT (Secret) |

---

## Next.js

Pipeline for Next.js applications — lint, typecheck, build, and static export.

### Functions

| Function | Description |
|----------|-------------|
| `install` | Install dependencies with chosen package manager |
| `build` | Run `next build` |
| `export-static` | Build and return the static export directory |
| `ci` | Full pipeline: install → typecheck → lint → build |

### Usage

```bash
# Full CI
dagger call nextjs ci --source=.

# With pnpm
dagger call nextjs ci --source=. --package-manager=pnpm

# Static export (for GitHub Pages, e.g., FDS spec website)
dagger call nextjs export-static --source=.

# Skip lint
dagger call nextjs ci --source=. --skip-lint
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `source` | — | Project source directory |
| `node-version` | `20` | Node.js version tag |
| `package-manager` | `npm` | `npm`, `pnpm`, or `bun` |
| `skip-lint` | `false` | Skip the lint step in `ci` |
| `output-dir` | `out` | Static export output directory |

---

## npm Package

Pipeline for npm libraries — typecheck, test, pack, and publish with provenance.

### Functions

| Function | Description |
|----------|-------------|
| `install` | Install dependencies with chosen package manager |
| `pack` | Build and pack into .tgz in /packages |
| `publish` | Publish to npm registry |
| `ci` | Full pipeline: install → typecheck → test → build → pack |
| `release` | Full release: ci → publish to npm |

### Usage

```bash
# Full CI
dagger call npm-package ci --source=.

# Publish (e.g., @vitness/fds-transformer)
dagger call npm-package release \
  --source=. \
  --npm-token=env:NPM_TOKEN

# Skip tests
dagger call npm-package ci --source=. --skip-test

# Custom registry
dagger call npm-package release \
  --source=. \
  --npm-token=env:NPM_TOKEN \
  --registry="https://npm.pkg.github.com"
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `source` | — | Package source directory |
| `node-version` | `20` | Node.js version tag |
| `package-manager` | `npm` | `npm`, `pnpm`, or `bun` |
| `build-script` | `build` | npm script name for build step |
| `test-script` | `test` | npm script name for test step |
| `skip-test` | `false` | Skip the test step in `ci` |
| `npm-token` | — | npm auth token (Secret) |
| `registry` | `https://registry.npmjs.org` | npm registry URL |

---

## Cloudflare Worker

Pipeline for Cloudflare Workers — typecheck and deploy via wrangler.

### Functions

| Function | Description |
|----------|-------------|
| `install` | Install dependencies |
| `typecheck` | Run `tsc --noEmit` |
| `deploy` | Deploy via `wrangler deploy` |
| `ci` | Full pipeline: install → typecheck |

### Usage

```bash
# CI (typecheck only)
dagger call cloudflare-worker ci --source=.

# Deploy
dagger call cloudflare-worker deploy \
  --source=. \
  --cf-api-token=env:CLOUDFLARE_API_TOKEN \
  --cf-account-id="your-account-id"

# Deploy to staging environment
dagger call cloudflare-worker deploy \
  --source=. \
  --cf-api-token=env:CLOUDFLARE_API_TOKEN \
  --cf-account-id="your-account-id" \
  --environment="staging"
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `source` | — | Worker source directory |
| `node-version` | `20` | Node.js version tag |
| `cf-api-token` | — | Cloudflare API token (Secret) |
| `cf-account-id` | — | Cloudflare account ID |
| `environment` | — | Wrangler environment name |

---

## GitHub Actions

### .NET CI

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          version: "latest"
          verb: call
          module: github.com/vpetkovic/dagger-pipelines
          args: >-
            ci
            --source=.
            --solution="MyLib.sln"
            --projects="src/MyLib/MyLib.csproj"
            --version="${{ github.ref_name }}"
```

### Node.js CI

```yaml
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          version: "latest"
          verb: call
          module: github.com/vpetkovic/dagger-pipelines
          args: >-
            node ci
            --source=.
```

### VS Code Extension Release

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          version: "latest"
          verb: call
          module: github.com/vpetkovic/dagger-pipelines
          args: >-
            vscode-extension release
            --source=.
            --vsce-token=env:VSCE_PAT
        env:
          VSCE_PAT: ${{ secrets.VSCE_PAT }}
```

### npm Package Release

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          version: "latest"
          verb: call
          module: github.com/vpetkovic/dagger-pipelines
          args: >-
            npm-package release
            --source=.
            --npm-token=env:NPM_TOKEN
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Cloudflare Worker Deploy

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v7
        with:
          version: "latest"
          verb: call
          module: github.com/vpetkovic/dagger-pipelines
          args: >-
            cloudflare-worker deploy
            --source=.
            --cf-api-token=env:CLOUDFLARE_API_TOKEN
            --cf-account-id="${{ vars.CF_ACCOUNT_ID }}"
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Requirements

- [Dagger CLI](https://docs.dagger.io/install) (v0.20+)
- Docker running locally

## License

Apache-2.0
