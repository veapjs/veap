# Testing Conventions

## Database Tests

Veap relies heavily on `AsyncLocalStorage` for Knex transactions. When writing tests that interact with the database (Models, Repositories, Services):

1. Ensure the global Knex instance is initialized before tests run.
2. If testing transactional logic, wrap the test execution inside the `transaction()` helper from `@veap/core/database` to simulate the request lifecycle environment.
3. Be cautious of state leakage. Tests should ideally run in isolated in-memory SQLite instances or wrap each test in a rolled-back transaction.

## Event Bus Testing

When testing functions that publish events, you can mock the `eventBus.publish` method to verify that the correct events are dispatched without triggering the actual asynchronous listeners, keeping unit tests fast and predictable.
