# M0: reproducible installation and build

Use Node.js **24.18.0**, pnpm **11.11.0**, and Python **3.14.3** (verified), all on PATH. pnpm is canonical. If needed, bootstrap only the tool with `npm install --global pnpm@11.11.0` (not executed during M0); do not use npm to install this workspace.

From a fresh source checkout:

```powershell
node --version
pnpm --version
python --version
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run build
```

Do not use --prod: build tools and many frontend packages are development dependencies. Do not copy node_modules between checkouts. These checks require no .env, database, migrations, seeding, training, or inference. The existing Python unit tests use standard-library helpers, not XGBoost inference; ML runtime reproducibility is outside M0.

## Findings and changes

- Dependency directories such as pg and express were empty. pnpm metadata still pointed to the former checkout under C:\Users\Asus\Downloads. The invalid installed state is confirmed; the operation that caused it is unknown.
- The npm lockfile covered only root dependencies; pnpm-lock.yaml covered all nine projects. Removed package-lock.json and preserved pnpm-lock.yaml byte-for-byte.
- package.json pins packageManager and exact Node/pnpm engines. .node-version pins Node for compatible version managers; .npmrc adds engine-strict=true.
- pnpm 11 rejected esbuild's install script despite the old onlyBuiltDependencies list. Replaced it with allowBuilds, preserving exactly the existing four allowed names: @swc/core, esbuild, msw, unrs-resolver. Release-age protections remain unchanged.
- Added a root test command for the existing seven TypeScript and three Python tests. No tests were changed or added.
- The mockup Vite config now provides PORT=5174 and BASE_PATH=/ defaults only for static builds. Explicit values still win. Development/preview requirements remain unchanged. An explicit UserConfig return type preserves typing in the async config callback.
- No workspace dependency declaration changes were required: frozen install and typechecks validate the existing graph. Locked Node 25 type declarations were retained alongside the tested Node 24 runtime because they did not block the build.

## Environment loading

| Consumer | Existing behavior / M0 handling |
| --- | --- |
| API runtime | start loads artifacts/api-server/.env via Node --env-file; build does not start the API. Unchanged. |
| Seed/prediction | Explicitly load the API .env. Neither was run. |
| Tests | No database environment or connection required. |
| Drizzle Kit | Expects inherited DATABASE_URL; push scripts do not load API .env. Unchanged and not run. |
| LANDSAFE Vite | Config reads process.env.PORT, BASE_PATH, API_PROXY_TARGET with existing defaults; no loadEnv call for config values. Vite separately loads its normal .env inputs. Unchanged. |
| Mockup Vite | Static build defaults added; serve/preview validation retained. |

No .env files were modified or their secrets printed. The local frontend .env can influence builds, including NODE_ENV; configured local builds and environment-free builds need not produce identical bundles. M0 verifies the documented environment-free source-checkout sequence on Windows x64, not byte-identical assets across arbitrary environments/operating systems.

Do not use scripts/post-merge.sh for this setup: its existing database push command is outside M0 and was not executed.

## Verification

Both the repaired checkout and an isolated clean snapshot passed typechecks, all 10 existing tests, and the complete API/LANDSAFE/mockup build. The snapshot contained 244 copied source/config/assets files, excluding node_modules, dist, TypeScript/Python caches, and .env files. Its frozen install installed 549 locked packages. The temporary snapshot was removed afterward.

pg, express, @workspace/db, vite, and tsx now resolve from their owning packages. Hash checks confirmed unchanged .env, database schema, API/authentication, ML, frontend logic, and existing tests. Only the mockup Vite configuration changed within application/package directories.

Unchanged pnpm-lock.yaml SHA256: `B354641D807378BBCA7100896DC3B2F4C878B196AFF11E7F77A453D933921F05`.

Failures were recorded and corrected, not suppressed:

- esbuild build-script policy blocked install and initially gated typecheck/test/build.
- A diagnostic search used a nonexistent pnpm.cjs path; inspection continued against the installed pnpm.mjs.
- Original mockup build failed because PORT was required.
- The first async-config edit introduced TS2769; an explicit UserConfig return type fixed it.
- A clean-build harness assigned empty PORT/BASE_PATH strings through Windows .NET environment handling. Diagnostic Node output confirmed this; the harness was corrected to omit the keys. No validation was weakened.
- A read-only diagnostic permission review timed out before execution; one retry succeeded. A large documentation-write review also timed out; direct file editing was used instead.

Remaining build warnings are not suppressed: tooltip.tsx sourcemap diagnostic (cannot resolve original location), and LANDSAFE chunks larger than 500 kB. No frontend splitting, warning-limit adjustment, or application changes were made.

See [all commands and captured results](m0/commands.md). Command logs are evidence, not a script to rerun.

