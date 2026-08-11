# Model Invariants & Google GenAI API Integration Rules (2026)

Whenever writing backend or frontend code referencing Gemini Developer API models:
- **NEVER** use `gemini-1.5-flash`, `gemini-1.5-pro`, or `gemini-2.0-flash`. They are fully deprecated and shut down (will return 404).
- **Default Recommended Model**: Always use **`gemini-3.6-flash`** for standard text, multimodal, and layout-aware HTML/timetable extraction parsing.
- **Fast / High-Throughput Alternative**: Use **`gemini-3.5-flash-lite`** for low-latency tasks.
- **Deep Reasoning / Coding Tasks**: Use **`gemini-3.5-flash`** or **`gemini-3.1-pro-preview`** if complex reasoning is needed.
