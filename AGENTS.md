# Model Invariants & Google GenAI API Integration Rules (2026)

Whenever writing backend or frontend code referencing Gemini Developer API models:
- **NEVER** use `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`, or `gemini-3.5-flash`. They are fully deprecated and shut down (will return 404).
- **Default Recommended Model**: Always use **`gemini-3.8-flash`** for standard text, multimodal, and layout-aware HTML/timetable extraction parsing.
- **Fast / High-Throughput Alternative**: Use **`gemini-3.7-flash`** for low-latency tasks.
- **Deep Reasoning / Coding Tasks**: Use **`gemini-3.1-pro`** or **`gemini-3.8-flash`** if complex reasoning is needed.

## Android Build Workflow
- **APK Output Location**: Whenever you successfully compile or build the Android APK, you MUST automatically copy the resulting  app-debug.apk to C:\Users\Raina\OneDrive\Desktop\AttendX.apk. Do not make the user manually retrieve it from the build folders.

## OTA Release Workflow (Preventing Downgrade Loops)
Whenever preparing a new major update or before compiling a final APK, you MUST synchronize the OTA versions to prevent the app from fetching older web assets from the server:
1. **Frontend**: Bump the default `localVersion` fallback inside `client/src/App.tsx`.
2. **Backend**: Update the `latestVersion` string and append the changelog in `server/src/controllers/system.controller.ts`.
3. **Package**: Run `npm run build` in the `client` directory, then run `node zip_dist.cjs` in the `server` directory to bundle the latest frontend code into `server/uploads/update.zip`.

## Anti-Slop Design Invariants
Never generate UI that uses the following AI default tropes:
1. No purple/cyan gradients, decorative glassmorphism, or neon-on-dark.
2. No "Side-Tab" cards (thick border on one side of a rounded card), nested cards, or ghost shadows (hairline border + wide shadow).
3. No tiny uppercase letter-spaced eyebrows above oversized italic serif hero headlines.
4. No "Inter everywhere" — ensure distinct type hierarchies and do not use gradient text.
5. No marketing buzzwords (supercharge, empower, next-generation). Use literal verbs.

## Isolated Page-Level Theming (Strict Architecture Rule)
When designing, updating, or overhauling the UI of a specific page:
1. **NO GLOBAL CSS CHANGES**: Never alter global theme variables in `index.css` to overhaul the app's look unless explicitly commanded to do so globally. 
2. **ISOLATE CSS TO THE PAGE**: Custom CSS properties, CSS variables, and animated elements (like volumetric backgrounds or 3D rays) MUST be restricted solely to the target page and its nested modals/components.
3. **SYNC APP SHELL ELEMENTS DYNAMICALLY**: If the target page requires the Sidebar, TopBar, or BottomNav to match its custom theme (like the Burgundy theme on the Reports page or the Neon Green theme on the Settings page), achieve this dynamically. 
   - Use `useLocation()` in layout components (like `AppShell.tsx`) to conditionally inject tailwind overrides, or use a scoped CSS wrapper class (e.g., `.theme-nova-green`) that inherently restyles children elements.
   - Do NOT permanently re-theme the Sidebar or Navbar for the entire app just because you are redesigning one page.

## Anti-Regression & Safety Rules
1. **Never use `git restore` or `git checkout` on uncommitted files.** Because we do not commit until explicit permission is given, using git commands to undo mistakes will destroy all recent working changes. If you make a mistake with a script, fix it manually or read the file again. Before running risky multi-line string replacements, create a temporary backup of the file first (e.g., `cp file.tsx file.tsx.bak`).
2. **Do not modify top-level layout wrappers (AppShell, Body, HTML) unless absolutely necessary.** Adding utility classes like `overflow-x-hidden` or `overflow-hidden` to top-level wrappers causes cascading layout breaks (specifically breaking `position: sticky` for sidebars/navbars). Always apply constraints locally to the `<main>` or inner content containers.
3. **Respect parallel logic.** When patching conditional class strings (like `className={isSemester ? "..." : "..."}`), you must carefully read the entire string to ensure you are appending to it rather than accidentally overwriting existing logic (like `isSettings` or `isReports`).
4. **No sweeping, blind replacements.** Never use full-file writes or generic script-based mass replacements (`replace()` in Python) unless you fully understand the consequences. Always use targeted, surgical edits (like `replace_file_content` with exact lines) to modify only the code that needs changing.
5. **Respect existing CSS architecture.** Do not overwrite custom layouts or carefully crafted design languages (e.g., Neo-Brutalism thick borders, specific shadows, rounded corners) with generic classes just to achieve a specific effect (like glassmorphism). Apply new styles surgically without stripping existing structural or thematic classes.
6. **Double-check side effects.** Before applying a fix (especially z-index or positioning like `relative`, `absolute`, or `fixed`), ensure you are not creating a new stacking context that traps fullscreen overlays, or breaking sticky navigation elements like the TopBar.
