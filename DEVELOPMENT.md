# Development Guide

This file is for maintainers and contributors of this fork.

## Why this guide includes local global install

End users should install from GitHub:

```bash
bun install -g github:ai4bordon/gsd-ui
```

The local tarball install flow exists for development only. It lets you:

- test unpublished CLI changes exactly as users run them (`gsd-ui` from global PATH)
- validate packaging (`files`, `bin`, and runtime assets in the final tarball)
- verify Windows behavior before pushing a release

## Local patched global install (maintainers)

From repository root:

```bash
bun install
bun run build
bun pm pack --destination .
bun install -g file:/absolute/path/to/gsd-ui-0.1.0.tgz
gsd-ui --help
```

PowerShell example:

```powershell
bun install
bun run build
bun pm pack --destination .
$pkg = (Get-ChildItem .\gsd-ui-*.tgz | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
bun install -g ("file:" + ($pkg -replace '\\','/'))
gsd-ui --help
```

## Daily development flow

```bash
bun install
bun run dev
```

In another terminal, run the backend CLI against a project with `.planning/`:

```bash
bun cli.ts /path/to/your/project
```

## Validation before push

```bash
bun test
bun run build
```
