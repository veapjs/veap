# ADR-001: Plugin-based Architecture

## Status

Accepted

## Context

Veap needs to be highly extensible without modifying the core codebase for every new feature. Traditional frameworks often lead to monolithic repositories where all features are intertwined.

## Decision

All business logic, including routes, UI, databases, and permissions, must be encapsulated within independent npm packages called Plugins (or Modules). Next.js serves only as the host application shell and renderer.

## Consequences

**Positive:**

- Complete isolation of features.
- Plug-and-play architecture (features can be toggled on/off).
- Easy updates and versioning.

**Negative:**

- Routing is more complex (requires dynamic merging of route trees).
- Circular dependencies can break the system if not managed correctly.
