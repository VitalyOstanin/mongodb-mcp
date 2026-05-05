# Contributing to MongoDB MCP Server

Thanks for your interest in this project. Before submitting changes, please skim this guide so the review process stays smooth.

## Table of Contents

- [Project Status](#project-status)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Development Loop](#development-loop)
- [Pre-PR Checklist](#pre-pr-checklist)
- [Coding Style](#coding-style)
- [Commit Convention](#commit-convention)
- [Pull Requests](#pull-requests)
- [Reporting Issues](#reporting-issues)

## Project Status

This is a personal-use MCP server. The author may decline feature requests that fall outside personal needs. Bug fixes, security fixes, and small focused improvements are welcome regardless.

## Prerequisites

- Node.js as specified in [`.nvmrc`](.nvmrc) (current LTS, ≥ 22). With nvm: `nvm use`.
- npm 10+.
- A MongoDB instance reachable via a connection string (only required for end-to-end smoke checks; the unit test suite is fully mocked).

## Initial Setup

```bash
git clone https://github.com/VitalyOstanin/mongodb-mcp.git
cd mongodb-mcp
npm install
```

Optional: copy `.env.example` to `.env` if/when you maintain a local one. `.env` is gitignored.

## Development Loop

| Script                    | Purpose                                                          |
| ------------------------- | ---------------------------------------------------------------- |
| `npm run build`           | Compile TypeScript to `dist/` (`tsconfig.build.json`) and chmod the CLI entrypoint |
| `npm run dev`             | Run `index.ts` directly via `tsx watch` for iterative work       |
| `npm start`               | Run the compiled server from `dist/`                             |
| `npm run typecheck`       | Type-check sources + tests (`tsconfig.json`, no emit)            |
| `npm run typecheck:tests` | Type-check with extra strict flags (`tsconfig.test.json`)        |
| `npm run lint`            | Run ESLint                                                       |
| `npm run lint:fix`        | Run ESLint with `--fix`                                          |
| `npm test`                | Run the Jest test suite                                          |
| `npm run test:watch`      | Run Jest in watch mode                                           |
| `npm run test:coverage`   | Run Jest with coverage (opt-in; threshold gate enforced)         |
| `npm run test:debug`      | Run Jest with `--detectOpenHandles --runInBand`                  |

Editor settings are pinned via [`.editorconfig`](.editorconfig). Most editors pick this up automatically.

## Pre-PR Checklist

Before opening a pull request, run all of these locally and make sure they pass:

```bash
npm run lint
npm run typecheck
npm run typecheck:tests
npm test
npm run build
```

If you touched code that affects coverage, also run `npm run test:coverage` and confirm the coverage gate still passes.

## Coding Style

- TypeScript strict mode is enforced via `tsconfig.base.json` (`strict: true`). Additional strict flags live in `tsconfig.test.json`.
- ESM is used end-to-end (`"type": "module"`). Imports keep the `.js` extension at runtime; `tsc` and `ts-jest` resolve them to `.ts`.
- ESLint config (`eslint.config.mjs`) enforces:
  - `prefer-template`, `prefer-const`, `no-var`, `prefer-destructuring` (object-only).
  - `padding-line-between-statements` for blank lines around `return` and variable declarations.
  - `consistent-type-imports` and `consistent-type-exports`.
  - De Morgan's law preference via `@vitalyostanin/eslint-prefer-de-morgan-law`.
  - `comma-dangle: always-multiline` everywhere.
- Prefer `interface` over `type` aliases for object shapes (`consistent-type-definitions`).
- Don't add comments that just restate what the code does. Comments should explain *why* something non-obvious was chosen.
- Don't add backwards-compatibility shims for code that hasn't shipped externally. If a tool was renamed, just rename it.

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>
```

Common types:

- `feat` — new functionality.
- `fix` — bug fix.
- `refactor` — code change that neither fixes a bug nor adds a feature.
- `perf` — performance improvement.
- `test` — adding or fixing tests.
- `docs` — documentation only.
- `chore` — tooling, dependencies, build, CI.
- `ci` — CI/CD configuration changes.

Scope is usually the affected tool or module (`find`, `mongodb-client`, `ci`, `deps`, `dx`, etc.).

Keep subjects in the imperative mood and under ~72 characters. Use the body for *why*, not *what*.

## Pull Requests

- Branch off `master`.
- One logical change per PR. Refactors should not bundle unrelated functional fixes.
- Update tests when behavior changes. New tools should ship with their own `*.test.ts`.
- Update `README.md`, `README-ru.md`, and (if relevant) this file when public surface or workflow changes.
- The CI workflow (`.github/workflows/ci.yml`) must be green before a merge.

## Reporting Issues

Open issues at <https://github.com/VitalyOstanin/mongodb-mcp/issues>. For bugs, include:

- The exact reproduction steps or a minimal failing snippet.
- The MCP client you're using (Qwen Code, Cline, Claude Code, etc.).
- The MongoDB server version (`db.version()`).
- Relevant environment variables, *with secrets redacted*.

Never paste full connection strings with credentials. Replace passwords with `***` before sharing logs.
