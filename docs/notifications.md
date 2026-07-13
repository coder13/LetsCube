# In-app social notifications

Social notifications are a MongoDB-backed, recipient-only inbox. PostgreSQL is
a non-blocking mirror only and is never used to authorize reads or actions.
The social feature gate remains disabled unless `SOCIAL_FEATURES_ENABLED=true`.

## Typed resource contract

A notification contains only a recipient id, actor id, type, source type/id,
dedupe key, read timestamp, and expiry metadata. It contains no callback URL,
executable action, access token, email address, room password, or membership
list. The current notification types are `friend_request`,
`friend_request_accepted`, and the reserved `room_invitation` extension for
the room-invitation resource.

The client owns the renderer/action registry. A `friend_request` action calls
the authenticated friendship endpoint using the actor reference; that endpoint
rechecks the current relationship and recipient. A notification never grants
authority itself. Unknown types remain display-only.

Friend request and acceptance notifications are created from successful,
durable relationship transitions. Their dedupe key includes the relationship
document and revision, which makes replayed transitions idempotent while a
later, distinct request can create a new notification. Notifications expire
after 30 days; source resources may be stale or resolved earlier and remain
safe to display because actions always revalidate server-side.

## API and delivery

All notification routes require the authenticated recipient:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/notifications?limit=&cursor=` | Recent notifications, cursor, unread count |
| `POST` | `/api/notifications/:notificationId/read` | Mark one recipient-owned notification read |
| `POST` | `/api/notifications/read-all` | Mark that recipient's unread notifications read |

The server relays typed `notification_created` and `notification_updated`
events only to the recipient's Socket.IO user room. The client refetches its
recent page and unread count on these events, socket connection, and reconnect,
so Redis delivery is an optimization rather than a source of truth.

Email is not a notification identity, lookup, persistence, delivery, render,
metric, or logging field.
