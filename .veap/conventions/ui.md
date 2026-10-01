# UI and Styling Conventions

Veap utilizes **Tailwind CSS v4** and **shadcn/ui** for its design system.

## The `@veap/ui` Package

To maintain visual consistency across all independent plugins, primitive UI components (buttons, inputs, dialogs, etc.) are centralized in the `@veap/ui` package.

**Rules:**

1. **Reuse over recreate**: Plugins should import base UI components from `@veap/ui` (e.g. `@veap/ui/components/button`, `@veap/ui/components/input`) instead of defining their own or installing new instances of shadcn/ui components locally.
2. **Tailwind First**: Always use Tailwind utility classes for layout and spacing. Avoid writing custom `.css` files unless implementing a highly specific third-party library override.
3. **Responsive Design**: Ensure all plugin views and widgets are fully responsive using Tailwind's `sm:`, `md:`, `lg:` prefixes.

## Application Shell & Plugins

- **Host Application** defines the design tokens (colors, fonts, radii in `globals.css`) and global layout shell in `app/layout.tsx`.
- **Plugins** define functional views and reusable widgets using `@veap/ui` components, integrating into the host application via `<ExtensionPoint />` or route declarations.
- **Host Overrides**: Host applications can override any plugin page by creating a corresponding physical Next.js page in `app/` (e.g., `app/(auth)/signin/page.tsx`), cleanly replacing the plugin's markup with custom designs.
