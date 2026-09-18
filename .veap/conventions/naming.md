# Naming Conventions

## Plugins

- Plugin package names should follow the format: `@veap/[name]-plugin`.
- The plugin ID (inside `manifest`) should be `[name]-plugin`.

## Events (Event Bus)

- Core system events use the prefix `system:<domain>:<action>` (e.g., `system:auth:login`).
- Plugin-specific events use the prefix `<domain>:<action>` (e.g., `blog:post-created`).
- Always use the exact string defined in the typings (`SystemEventsMap`) when publishing or subscribing.

## Database Models

- Knex Eloquent Model class names should be PascalCase (e.g., `User`, `BlogPost`).
- Underlying table names should be snake_case, pluralized (e.g., `users`, `blog_posts`).

## Repository Ports

- A persistence port is an interface named `I<Aggregate>Repository`, living in `domain/<context>/repositories/<aggregate>.repository.ts`.
- Its injection token is `Symbol.for("veap:<context>:<aggregate>-repository")`, exported as `<AGGREGATE>_REPOSITORY` (e.g. `USER_REPOSITORY`).
- The ActiveRecord adapter is `ActiveRecord<Aggregate>Repository`, living in `infrastructure/<context>/repositories/active-record-<aggregate>.repository.ts`. It is the only place allowed to touch the ORM for that aggregate.
- Repository methods speak in domain records, not ORM models or query builders.
- `create` takes a single record object; callbacks/filters follow the method name (`findById`, `findByEmail`, `removeByUserId`).
