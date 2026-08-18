# Notifications

WidgetForge notifications are split into a domain-neutral store and optional Vue hosts.

## Model and lifecycle

`createNotificationStore()` creates an explicit central store. Calling `notify()` adds an active notification and notifies subscribers. `dismiss(id)` removes one notification and `clear()` removes all active notifications.

Notifications have a semantic severity (`info`, `success`, `warning`, `error`). Transient notifications receive a duration and are rendered by `NotificationToastHost`; the host owns the timer and dismisses them when their duration expires. Persistent notifications have no timeout and are rendered by the optional `NotificationCenter` until explicitly dismissed.

The store contains no game-specific notification types and has no dependency on Vue, the Window Manager or a transport.

## Widget navigation

A notification may optionally contain a normal `NavigationIntent`. When a `WidgetNavigator` is supplied to a host, the host exposes the notification action and delegates navigation to that existing service. The notification system never opens windows directly.

## Vue hosts

- `NotificationToastHost` renders the newest transient notifications and supports a configurable maximum visible count.
- `NotificationCenter` renders persistent notifications and supports dismiss, clear and optional navigation actions.

Both hosts are presentation-only consumers of the same store. Business code can create notifications from any source as long as it receives the store explicitly.
