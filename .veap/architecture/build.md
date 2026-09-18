# Build System

Veap operates as a monorepo managed by **Bun workspaces**.

## Compilation

- **Plugins and Core Packages**: Built using the TypeScript compiler (`tsc`). The source code (`src/`) is compiled to standard ECMAScript modules in the `dist/` folder.
- **Host Application**: The Next.js application at the root is built using the standard `next build` command. It consumes the built `dist/` files of the plugins.

## Peer Dependencies

To prevent duplicate React instances and Next.js context errors, all plugins declare `react`, `react-dom`, and `@veap/core` as **peer dependencies**. The host application is responsible for providing the actual installations of these packages.
