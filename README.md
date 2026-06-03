# BikAPI

BikAPI is a local-first desktop API client built with Tauri, React, TypeScript, and Rust.

The MVP stores all persistent data as JSON inside `.bik` files. There is no database or persistent index. Opening a workspace scans the selected folder and builds an in-memory index.

## Workspace Layout

```text
my-workspace/
  workspace.bik
  globals.bik
  environments/
    dev.bik
    stage.bik
    prod.bik
  collections/
    travel-api/
      collection.bik
      endpoints/
        create-booking/
          request.bik
          pre.js
          post.js
          examples/
          history/
```

Saving edits to an existing `request.bik` snapshots the old file into `history/request-YYYY-MM-DDTHH-MM-SS.bik` before writing the new current request.

## Commands

```bash
npm install
npm run build
npm run tauri:dev
```

`npm run tauri:dev` requires a local Rust toolchain with `cargo` and `rustc`.
