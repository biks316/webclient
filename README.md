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

## Hybrid Mapping Syntax

BikAPI supports a hybrid mapping placeholder:

`->map::{{variable_name}}`

This lets the same request work in both Flow Runner and Collection Runner.

### Meaning

Flow Runner:
- Uses the visual mapping created in the Mapping Builder.
- Ignores the variable fallback.

Collection Runner / Single Request:
- Ignores the visual mapping.
- Resolves the variable inside `{{...}}`.

### Example

```json
{
  "userId": "->map::{{user_id}}",
  "email": "->map::{{user_email}}"
}
```

### Implementation Notes

- The `->map::` prefix marks a field as flow-mappable.
- In Flow Runner, BikAPI should prefer the mapping graph and treat the `{{...}}` value as a fallback only.
- In Collection Runner and single-request execution, BikAPI should ignore the flow mapping layer and resolve the `{{...}}` variable normally.

## Commands

```bash
npm install
npm run build
npm run tauri:dev
```

`npm run tauri:dev` requires a local Rust toolchain with `cargo` and `rustc`.
