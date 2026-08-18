# Standardized UI States

WidgetForge provides three domain-neutral presentation primitives for common data states. They do not load data and do not depend on the Data API.

## LoadingState

- accessible status with `aria-busy`
- configurable message or slot content
- compact mode
- motion-reduction friendly indicator

## EmptyState

- configurable title and message
- optional icon and action slots
- compact mode

## ErrorState

- alert semantics
- configurable title and message
- optional action slots
- optional retry button that emits a `retry` event

The consuming widget or table decides which state to show and what a retry action should do. This keeps presentation separate from providers, transports and domain logic.
