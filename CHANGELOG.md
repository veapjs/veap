# @veap/core

## 0.4.1

### Patch Changes

- Fix locale registration for generated plugins and templates. The CLI stubs now scaffold `src/locales/{en,pl}.ts` dictionaries and register them through the plugin/template `locales` field - previously generated packages shipped translations that were never loaded. Templates gained first-class locale support in the core: `ITemplate.locales` is merged into the message dictionary by the intl discovery loader (after plugins, before app-level fallbacks), and `@veap/minimal-template`'s existing en/pl dictionaries are now actually registered.

## 0.4.0

### Minor Changes

- Adds the internationalization engine (locale detection, translation loading, pluralization), a storage service with local and provider-backed disks, and the plugin system: manifest, lifecycle hooks, plugin-scoped routes and global model scopes.

### Patch Changes

- Updated dependencies
  - @veap/ui@0.1.0

## 0.3.1

### Patch Changes

- Public hooks and defaults extracted so the new Veap CLI and the `create-veap` scaffolder can drive the framework programmatically.

## 0.3.0

### Minor Changes

- Introduces the database module on top of Knex: connection lifecycle management, migrations and a fluent query builder with where/orderBy/pagination composition.
- Extends the ORM with Eloquent-style relations: hasOne, hasMany, belongsTo and belongsToMany with eager loading, plus attribute casting and model accessors.

## 0.2.0

### Minor Changes

- Adds the HTTP layer: middleware pipeline, the route matcher with static, dynamic and wildcard segments, and the route tree for grouped and nested registration. Server-sent events are wired into the response layer.

## 0.1.0

### Minor Changes

- Initial public scaffold of the Veap core: application container, typed config loading with the `server` schema, structured logger and the shared error hierarchy. The framework boots headlessly as a single importable package.
