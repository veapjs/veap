# ADR-008: Removal of Templates & Adoption of ExtensionPoint Composition

## Status

Accepted

## Context

Originally, Veap adopted a theme/template paradigm inspired by traditional CMS systems:

1. Templates implemented an `ITemplate` interface, lived in a dedicated `templates/` workspace, and registered layouts and component overrides.
2. The active template ID was stored in the database (`templates` table) and managed via `TemplateService` and `ITemplateRepository`.
3. The virtual router resolved page overrides dynamically (`activeTemplate.overrides[path]`), wrapping rendered output with `TemplateLayout`.
4. The CLI provided `veap make:template` to scaffold new templates.

This design suffered from significant architectural and practical limitations:

- **Monolithic Inflexibility**: Only one template could be active at a time. If an application wanted a custom navbar from Plugin A and a footer from Plugin B, templates forced everything into a single closed theme bundle.
- **Friction with Next.js App Router**: In a modern Next.js architecture, the host application shell (`app/layout.tsx`) naturally owns layout wrappers, fonts, and global metadata. Abstracting the root layout into a CMS-style template prevented standard Next.js paradigms.
- **Complex UI Overrides**: Template overrides bypassed standard file-system routing conventions, making it harder for developers to customize plugin views without learning Veap-specific override APIs.

## Decision

We eliminated the legacy Template subsystem entirely in favor of modular composition and standard Next.js conventions:

1. **Subsystem Removal**:
   - Removed `ITemplate`, `TemplateService`, `ITemplateRepository`, `ActiveRecordTemplateRepository`, and the `templates` database migration.
   - Removed `.withTemplates([])` from `Application.configure()` and unbound `APP_TEMPLATES`.
   - Removed `veap make:template` and the template scaffolding stubs.
   - Removed the templates workspace from `create-veap` defaults and package managers (`pnpm-workspace.yaml`, `workspaces`).

2. **Modular Shell via `<ExtensionPoint />`**:
   - Enhanced `ExtensionPoint` with `mode?: "single" | "multiple"` (defaults to `"multiple"`).
   - In `mode="single"`, the extension point resolves the single candidate with the highest precedence (lowest numeric `priority`). If no wrapper tag (`as`) or styling (`className`) is provided, it renders directly without a wrapper `div`.
   - Added `children` / `fallback` support: when no plugin registers an extension for a given target and point, the host application's default markup (passed as children or fallback) renders cleanly.
   - Standard app shell slots (e.g., `<ExtensionPoint target="app" point="navbar" mode="single" />`, `<ExtensionPoint target="app" point="footer" mode="single" />`) allow plugins to inject modular UI pieces independently.

3. **View Overrides via Next.js File Shadowing**:
   - To customize or replace a plugin page (e.g. `/signin` or `/blog/[slug]`), developers create a standard Next.js file in the host application (e.g. `app/(auth)/signin/page.tsx`).
   - Next.js prioritizes physical route files over catch-all dynamic routes (`app/[[...catchAll]]/page.tsx`), cleanly bypassing the plugin's virtual route without framework magic or database configuration.

## Consequences

- **Positive:** Frictionless integration into existing Next.js projects. Veap becomes an additive modular layer rather than an intrusive CMS engine.
- **Positive:** Multi-plugin composition: distinct plugins can contribute navigation bars, footers, announcements, and sidebars simultaneously.
- **Positive:** Zero template boilerplate and zero database overhead for visual layout management.
- **Positive:** Familiar developer experience: Next.js routing and component composition work as expected.
