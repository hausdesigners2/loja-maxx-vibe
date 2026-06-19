# AI Rules & Tech Stack Guidelines

This document outlines the tech stack and development rules for the **Lojas Maxx** application. All AI assistants and developers must adhere to these guidelines to maintain code quality, consistency, and performance.

## Tech Stack

*   **Frontend Framework**: React 18 with TypeScript, bundled using Vite for fast development and optimized production builds.
*   **Styling**: Tailwind CSS for utility-first, highly responsive styling, with custom dark theme variables defined in `src/index.css`.
*   **UI Components**: shadcn/ui (built on Radix UI primitives) for accessible, customizable, and modern components.
*   **Routing**: React Router DOM (v6) for client-side routing, with all routes declared in `src/App.tsx`.
*   **State Management & Data Fetching**: React Query (`@tanstack/react-query`) for server state caching, synchronization, and management.
*   **Backend & Database**: Supabase for authentication, real-time database subscriptions, and storage.
*   **Icons**: Lucide React for a consistent, lightweight, and modern icon set.
*   **Notifications**: Sonner for sleek, customizable toast notifications.

---

## Library Usage Rules

### 1. Icons
*   **Rule**: Always use `lucide-react` for icons.
*   **Avoid**: Do not install or import other icon libraries (like FontAwesome or React Icons) to keep the bundle size small and design consistent.

### 2. Toasts & Notifications
*   **Rule**: Use `sonner` (via `toast.success`, `toast.error`, etc.) for all user feedback and notifications.
*   **Avoid**: Do not use the legacy `@/components/ui/use-toast` or `@/components/ui/toast` components for new features.

### 3. Forms & Validation
*   **Rule**: Use `react-hook-form` combined with `zod` and `@hookform/resolvers` for form state management and schema validation.
*   **Avoid**: Do not write manual form validation logic or use unvalidated inputs for sensitive data.

### 4. Styling & CSS
*   **Rule**: Use Tailwind CSS utility classes for all styling. Use the `cn` helper from `@/lib/utils` for conditional class merging.
*   **Avoid**: Do not write custom CSS in separate files. Any global styles, custom animations, or theme variables must be defined in `src/index.css`.

### 5. Database & API Queries
*   **Rule**: Always use the generated Supabase client from `@/integrations/supabase/client` for database operations.
*   **Avoid**: Do not write raw SQL queries on the client side or bypass the Supabase client.

### 6. Component Architecture
*   **Rule**: Keep components small (ideally under 100 lines of code), highly focused, and responsive. Create new files for new components in `src/components/` and pages in `src/pages/`.
*   **Avoid**: Do not add multiple unrelated components to a single file.