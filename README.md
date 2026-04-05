# dagger-pipelines

Reusable [Dagger](https://dagger.io) module for .NET CI/CD pipelines. Provides composable functions for restore, build, test, pack, and NuGet publish.

## Prerequisites

- [Dagger CLI](https://docs.dagger.io/install) (v0.20+)
- Docker running locally

## Functions

| Function | Description |
|----------|-------------|
| `restore` | Restore NuGet packages for a solution |
| `build` | Build in Release configuration |
| `test` | Run tests for a project or solution |
| `pack` | Pack one or more projects into .nupkg files |
| `publish` | Push .nupkg files to NuGet.org |
| `ci` | Full pipeline: restore → build → test → pack |

## Usage

### Run the full CI pipeline

```bash
dagger call ci \
  --source=. \
  --solution="MyLib.sln" \
  --projects="src/MyLib/MyLib.csproj" \
  --version="2.0.0"
```

### Multi-package solution (e.g., PaginationKit)

```bash
dagger call ci \
  --source=. \
  --solution="PaginationKit.slnx" \
  --projects="src/PaginationKit/PaginationKit.csproj,src/PaginationKit.AspNetCore/PaginationKit.AspNetCore.csproj,src/PaginationKit.FastEndpoints/PaginationKit.FastEndpoints.csproj" \
  --version="1.5.0" \
  --dotnet-version="10.0"
```

### Run individual steps

```bash
# Just build
dagger call build --source=. --solution="MyLib.sln"

# Just test
dagger call test --source=. --solution="MyLib.sln" --test-project="tests/MyLib.Tests/MyLib.Tests.csproj"

# Pack then publish
dagger call pack \
  --source=. \
  --solution="MyLib.sln" \
  --projects="src/MyLib/MyLib.csproj" \
  --version="2.0.0" \
| dagger call publish --nuget-api-key=env:NUGET_API_KEY
```

### Use from GitHub Actions

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

## Parameters

All functions accept these common parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `source` | — | Project source directory |
| `solution` | — | Path to .sln or .slnx file |
| `dotnet-version` | `8.0` | .NET SDK version tag |
| `configuration` | `Release` | Build configuration |

### Additional parameters

- **`test`**: `test-project` — specific test .csproj (defaults to solution)
- **`pack`**: `projects` — comma-separated .csproj paths to pack; `version` — package version
- **`publish`**: `nuget-api-key` — NuGet.org API key (Dagger Secret); `nuget-source` — feed URL
- **`ci`**: combines all of the above

## License

Apache-2.0
