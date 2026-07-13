# Room ownership and administration

Rooms keep two separate host roles:

- `owner` is the permanent creator. It does not change when the creator leaves,
  and the owner may delete the room while absent.
- `admin` is the active participant who currently has room configuration and
  moderation controls.

The active admin is selected deterministically after a membership change:

1. The owner is admin whenever they are in the room.
2. Otherwise, the existing admin remains in control while they are in the room.
3. If that admin leaves, the first active participant in the room's stored user
   order takes control.
4. An empty room has no admin. Its owner remains unchanged, and a normal room
   enters the existing stale-room expiry window.

There is no user-facing manual transfer operation. If a future operation sets
an active participant as admin while the owner is absent, membership changes
preserve that transfer until the admin leaves or the owner returns.

## Disconnect and rejoin behavior

A transient disconnect does not immediately change membership or admin. The
owner or current admin keeps control during the configured reconnect grace
period. Reconnecting within that period cancels departure cleanup. After the
grace period, departure uses the same admin handoff as an explicit leave.

Presence is per user, not per socket. Closing one tab does not hand off admin
while another socket for the same user remains in the room. Explicitly leaving
from the last tab finalizes the departure immediately: each leaving tab removes
itself from the per-user socket group before the remaining-tab check, so two
simultaneous explicit leaves cannot strand membership. If the owner later
rejoins, they reclaim admin before the join is acknowledged.

The final persisted departure is a MongoDB compare-and-set keyed by the active
membership revision. This applies across Socket.IO processes: exactly one
process can claim a leave, emit its room events, and record its metrics. A
concurrent rejoin advances the revision, so a losing leave is terminal and
cannot overwrite the new membership.

An empty room persists `admin: null`, but the established `UPDATE_ADMIN`
Socket.IO event is emitted only for a non-null active admin. Spectators and
other clients therefore never receive a null admin payload.

Grand Prix rooms use the same role selection when Grand Prix is enabled. When
it is disabled, create and join requests are rejected before membership or
roles change.

## Authorization contract

The server refreshes canonical room state before processing room socket events.
Admin actions must authorize against the current `admin`, not a client-provided
role or an older socket snapshot. Owner-only operations authorize against the
unchanging `owner`.

Admins cannot kick or ban themselves through raw socket events; they must use
the ordinary leave operation so membership, admin handoff, and reconnect
semantics remain coherent.

Private-room invitations and access approvals may treat the active owner or
current admin as a host, but must also independently require that host to be an
active room participant. This prevents an absent owner from granting access
solely because owner deletion authority survives departure.
