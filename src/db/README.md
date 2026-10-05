# Database layer (reserved)

Nothing here is wired up yet — the app keeps state in memory
(`src/services/messageHandler.service.js`). These folders exist so the database
can be dropped in later without moving files around.

## Folders

| Folder          | Purpose when implemented                                                        |
| --------------- | ------------------------------------------------------------------------------- |
| `models/`       | Schema definitions / entities (`message.model.js`, `contact.model.js`, ...)      |
| `repositories/` | Data access functions the services call (`messages.repository.js`)               |
| `migrations/`   | Versioned schema changes                                                         |
| `seeds/`        | Sample/reference data for local development                                      |

`data/` at the project root is ignored by git and is where a file-based engine
(SQLite, LowDB) would keep its file.

## Suggested first tables

**messages** — one row per inbound/outbound message

| Column          | Notes                                            |
| --------------- | ------------------------------------------------ |
| `id`            | WhatsApp message id (`wamid.***`), primary key   |
| `direction`     | `inbound` / `outbound`                           |
| `wa_id`         | Customer phone number                            |
| `profile_name`  | WhatsApp display name, inbound only              |
| `type`          | `text`, `image`, `template`, ...                 |
| `body`          | Text or the caption/placeholder                  |
| `raw`           | Full JSON payload, for replay and debugging      |
| `status`        | `sent` / `delivered` / `read` / `failed`         |
| `timestamp`     | From the webhook, not the insert time            |

**contacts** — one row per customer (`wa_id`, `profile_name`, `first_seen_at`,
`last_seen_at`).

## Where to plug it in

1. `src/services/messageHandler.service.js` → `handleInboundMessage()` — a
   `TODO(db)` comment marks the insert point for inbound messages.
2. `src/services/whatsapp.service.js` → `sendMessage()` — record outbound
   messages after the Graph API returns an id.
3. `src/services/messageHandler.service.js` → `printStatus()` — update the row's
   delivery status.

Add the connection settings to `.env` (`DB_CLIENT`, `DATABASE_URL`) — commented
placeholders are already in `.env.example` — and read them in
`src/config/env.js`.

## Idempotency note

Meta **retries** a webhook delivery it did not get a `200` for, so the same
message id can arrive more than once. Make the message insert an upsert keyed on
the WhatsApp message id.
