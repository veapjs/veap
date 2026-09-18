# UI and Styling Conventions

Veap utilizes **Tailwind CSS v4** and **shadcn/ui** for its design system.

## The `@veap/ui` Package

To maintain visual consistency across all independent plugins, primitive UI components (buttons, inputs, dialogs, etc.) are centralized in the `@veap/ui` package.

**Rules:**

1. **Reuse over recreate**: Plugins should import base UI components from `@veap/ui` (e.g. `@veap/ui/components/button`, `@veap/ui/components/input`) instead of defining their own or installing new instances of shadcn/ui components locally.
2. **Tailwind First**: Always use Tailwind utility classes for layout and spacing. Avoid writing custom `.css` files unless implementing a highly specific third-party library override.
3. **Responsive Design**: Ensure all plugin views and widgets are fully responsive using Tailwind's `sm:`, `md:`, `lg:` prefixes.

## Templates vs Plugins

- **Plugins** define the structural markup and layout of the feature (using generic `@veap/ui` components).
- **Templates** can completely override this markup or provide global CSS variables (colors, fonts, radii) that affect how `@veap/ui` renders across the entire system.
