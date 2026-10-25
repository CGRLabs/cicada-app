# Engine binary drop-in

This directory is where the compiled **Cicada engine** (`cicada-engine.exe`) is
expected to live for local development and for packaging.

- The engine is the C# fork of Bulk Crap Uninstaller and lives in its own
  repository (`realLLUKS/Cicada-Uinstaller`). It is not part of this shell repo.
- Build it with the `dotnet publish` command documented in the shell README
  ("Building the engine") and place the resulting `cicada-engine.exe` here:

  ```
  engine/bin/cicada-engine.exe
  ```

- `resolveEnginePath()` in `src/engine/client.js` checks this location first
  (after the `CICADA_ENGINE_PATH` environment variable).
- `npm run dist` bundles any `cicada-engine.exe` found here into the installer
  under `<install>/resources/engine/`. If the file is absent, the packaged app
  still runs but needs the engine provided another way (env var or adjacent
  engine checkout).
