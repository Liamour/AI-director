# Core Module
## Boundary
Global cross-cutting concerns only. Contains:
- Application configuration
- Unified type definitions (types/index.ts)
- External AI API client implementations
- App-wide constants and enums

## Rules
No feature-specific logic allowed here. All exports must be usable across entire application.
