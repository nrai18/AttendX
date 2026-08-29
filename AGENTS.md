# Model Invariants & Google GenAI API Integration Rules (2026)

Whenever writing backend or frontend code referencing Gemini Developer API models:
- **NEVER** use `gemini-1.5-flash`, `gemini-1.5-pro`, or `gemini-2.0-flash`. They are fully deprecated and shut down (will return 404).
- **Default Recommended Model**: Always use **`gemini-3.6-flash`** for standard text, multimodal, and layout-aware HTML/timetable extraction parsing.
- **Fast / High-Throughput Alternative**: Use **`gemini-3.5-flash-lite`** for low-latency tasks.
- **Deep Reasoning / Coding Tasks**: Use **`gemini-3.5-flash`** or **`gemini-3.1-pro-preview`** if complex reasoning is needed.

## Android Build Workflow
- **APK Output Location**: Whenever you successfully compile or build the Android APK, you MUST automatically copy the resulting pp-debug.apk to C:\Users\Raina\OneDrive\Desktop\AttendX.apk. Do not make the user manually retrieve it from the build folders.

## OTA Release Workflow (Preventing Downgrade Loops)
Whenever preparing a new major update or before compiling a final APK, you MUST synchronize the OTA versions to prevent the app from fetching older web assets from the server:
1. **Frontend**: Bump the default `localVersion` fallback inside `client/src/App.tsx`.
2. **Backend**: Update the `latestVersion` string and append the changelog in `server/src/controllers/system.controller.ts`.
3. **Package**: Run `npm run build` in the `client` directory, then run `node zip_dist.cjs` in the `server` directory to bundle the latest frontend code into `server/uploads/update.zip`.
