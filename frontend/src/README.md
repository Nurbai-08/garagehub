# Frontend architecture

The frontend follows Feature-Sliced Design. Imports should point through a slice's public `index.ts` API and follow the dependency direction below:

`app → pages → widgets → features → entities → shared`

- `app` — application bootstrap, providers, routing, and global styles.
- `pages` — route-level screens.
- `widgets` — independent, reusable page sections.
- `features` — user actions and application scenarios.
- `entities` — business models, domain API methods, and entity UI.
- `shared` — domain-agnostic infrastructure and utilities.

The `@/*` alias resolves to `src/*`. A layer must not import from a layer above it, and slices on the same layer must not import each other's internals.
