# Templates

Templates (`templates/*`) in Veap are specialized plugins that handle the visual layer.

## The `ITemplate` Interface

Templates export an object conforming to `ITemplate`.
Key properties:

- `layout`: A React component that wraps the entire application or specific contexts.
- `overrides`: A record mapping specific route paths (e.g., `"/blog"`) to alternative React components.

## Override Mechanism

When the `VeapRouter` resolves a route, it checks if the active Template has declared an override for that specific path. If an override exists, the router renders the Template's component instead of the original Plugin's component.

This allows complete visual reskinning of the application (e.g., replacing the default blog list view) without modifying the underlying plugin's logic or data queries.
