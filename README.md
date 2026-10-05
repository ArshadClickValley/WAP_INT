# WAP_INT — WhatsApp Cloud API integration

A console-only Node.js service that talks to the **WhatsApp Cloud API**. No UI, no
front end — everything happens on the terminal.

It exposes exactly two APIs:

| # | API | What it does |
| - | --- | ------------ |
| 1 | **Webhook** — `GET/POST /webhook` | The URL you register in the Meta developer dashboard. Receives inbound messages and delivery statuses and prints them to the console. |
| 2 | **Send** — `POST /api/messages` | Sends messages out through your WhatsApp business number. |

Plus a few diagnostic endpoints and two console tools (`npm run send`, `npm run chat`).

> **Not a developer?** Read [START-HERE.md](START-HERE.md) instead — same setup,
> explained from scratch with no assumed knowledge.

---

## Table of contents

1. [Features](#features)
2. [Requirements](#requirements)
3. [Project structure](#project-structure)
4. [Quick start](#quick-start)
5. [Meta setup (getting your credentials)](#meta-setup-getting-your-credentials)
6. [Environment variables](#environment-variables)
7. [Exposing the webhook locally (ngrok / cloudflared)](#exposing-the-webhook-locally-ngrok--cloudflared)
8. [Registering the webhook with Meta](#registering-the-webhook-with-meta)
9. [Sending messages](#sending-messages)
10. [API reference](#api-reference)
11. [Testing without WhatsApp](#testing-without-whatsapp)
12. [Database (future integration)](#database-future-integration)
13. [Troubleshooting](#troubleshooting)
14. [Security notes](#security-notes)

---

## Features

- **Inbound webhook** with Meta's verification handshake and **HMAC-SHA256 signature
  validation** (`X-Hub-Signature-256`).
- **Outbound send API** covering text, templates, images, documents, reply buttons
  and reactions — plus a raw passthrough for anything not wrapped yet.
- **Readable console output** — inbound messages, delivery statuses (sent →
  delivered → read → failed) and one line per HTTP request.
- **Console tools** — `npm run send` for one-shot sends, `npm run chat` for an
  interactive session.
- **One-command tunnel** that prints the exact callback URL and verify token to
  paste into the Meta dashboard.
- **Pre-flight check** (`npm run check`) that validates your `.env` against the
  live Graph API.
- Only two runtime dependencies: `express` and `dotenv`.

---

## Requirements

| Thing | Version / notes |
| ----- | --------------- |
| Node.js | **18.17+** (uses the built-in `fetch`). Tested on Node 22. |
| npm | 9+ |
| Meta developer account | Free — <https://developers.facebook.com> |
| ngrok *or* cloudflared | Only for local development, so Meta can reach your machine |

---

## Project structure

```
WAP_INT/
├── src/
│   ├── index.js                       # entry point: boots the server, prints the dashboard
│   ├── app.js                         # express app, route mounting, raw-body capture
│   ├── config/
│   │   └── env.js                     # all env parsing + validation lives here
│   ├── routes/
│   │   ├── webhook.routes.js          # API #1
│   │   └── message.routes.js          # API #2
│   ├── controllers/
│   │   ├── webhook.controller.js      # verification handshake + inbound events
│   │   └── message.controller.js      # request validation for sending
│   ├── services/
│   │   ├── whatsapp.service.js        # Graph API client (the only place fetch is called)
│   │   ├── messageParser.service.js   # raw webhook payload -> flat events
│   │   └── messageHandler.service.js  # what to DO with an event  <-- extend here
│   ├── middlewares/
│   │   ├── verifySignature.js         # X-Hub-Signature-256 validation
│   │   ├── requestLogger.js
│   │   └── errorHandler.js
│   ├── utils/
│   │   ├── logger.js                  # coloured console logger
│   │   ├── AppError.js
│   │   ├── asyncHandler.js
│   │   └── phone.js
│   ├── cli/
│   │   ├── send.js                    # npm run send
│   │   └── chat.js                    # npm run chat
│   └── db/                            # reserved for future DB integration (empty)
│       ├── models/
│       ├── repositories/
│       ├── migrations/
│       ├── seeds/
│       └── README.md                  # suggested schema + where to plug it in
├── scripts/
│   ├── tunnel.js                      # npm run tunnel
│   └── check-config.js                # npm run check
├── docs/
│   └── requests.http                  # ready-made requests (VS Code REST Client)
├── data/                              # reserved: file-based DB would live here
├── logs/                              # reserved
├── .env.example
└── package.json
```

---

## Quick start

```bash
npm install
```

Copy the environment template:

```bash
copy .env.example .env
```

On macOS/Linux use `cp .env.example .env`.

Open `.env` and set at minimum `WHATSAPP_VERIFY_TOKEN` (any random string you
invent). Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Verify the configuration:

```bash
npm run check
```

Start the server:

```bash
npm run dev
```

You should see the console dashboard listing every endpoint. The server runs
**without** WhatsApp credentials — you just cannot send messages until you add
them.

---

## Meta setup (getting your credentials)

You need four values. All of them come from <https://developers.facebook.com>.

### 1. Create the app

1. Go to **My Apps → Create App**.
2. Choose use case **Other**, then app type **Business**.
3. Name it (e.g. `WAP_INT`) and create it.

### 2. Add the WhatsApp product

1. On the app dashboard, find **WhatsApp** and click **Set up**.
2. Meta creates a test business account and a **test phone number** for you —
   free, and enough for development.

### 3. Collect the values

Go to **WhatsApp → API Setup**:

| Dashboard field | `.env` variable | Notes |
| --------------- | --------------- | ----- |
| Temporary access token | `WHATSAPP_ACCESS_TOKEN` | **Expires in 24 hours.** See below for a permanent one. |
| Phone number ID | `WHATSAPP_PHONE_NUMBER_ID` | A long number *under* the phone number — not the phone number itself. |
| WhatsApp Business Account ID | `WHATSAPP_BUSINESS_ACCOUNT_ID` | Optional. |

Then go to **App Settings → Basic**:

| Dashboard field | `.env` variable |
| --------------- | --------------- |
| App Secret (click *Show*) | `WHATSAPP_APP_SECRET` |

And invent your own:

| Value | `.env` variable |
| ----- | --------------- |
| Any random string | `WHATSAPP_VERIFY_TOKEN` |

### 4. Add your own number as a test recipient

On **API Setup**, under *To*, click **Manage phone number list** and add the
number you will message from. Unverified test numbers can only message recipients
on this list — up to 5.

### 5. (Recommended) Get a permanent token

The 24-hour token is painful. For a token that does not expire:

1. <https://business.facebook.com> → **Business Settings → Users → System Users**.
2. **Add** a system user with the **Admin** role.
3. **Add Assets** → select your app → enable **Full control**.
4. **Generate New Token** → pick your app → tick the permissions
   `whatsapp_business_messaging` and `whatsapp_business_management`.
5. Copy the token into `WHATSAPP_ACCESS_TOKEN`. It is shown **once**.

Confirm it works:

```bash
npm run check
```

A healthy result prints your sender's display number, verified name and quality rating.

---

## Environment variables

Everything is documented inline in [`.env.example`](.env.example). The ones that matter:

| Variable | Required | Default | Purpose |
| -------- | -------- | ------- | ------- |
| `PORT` | no | `3000` | Local HTTP port |
| `WEBHOOK_PATH` | no | `/webhook` | Path the webhook is mounted on |
| `LOG_LEVEL` | no | `info` | `error` / `warn` / `info` / `debug` — use `debug` to see raw payloads |
| `WHATSAPP_API_VERSION` | no | `v21.0` | Graph API version |
| `WHATSAPP_PHONE_NUMBER_ID` | to send | — | Sender's phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | to send | — | Bearer token |
| `WHATSAPP_VERIFY_TOKEN` | **yes** | — | Your invented string; must match the dashboard |
| `WHATSAPP_APP_SECRET` | strongly | — | Validates inbound signatures |
| `VERIFY_SIGNATURE` | no | `true` | Set `false` only to hand-test the webhook locally |
| `AUTO_REPLY` | no | `false` | Echo an automatic reply to every inbound message |
| `AUTO_REPLY_TEXT` | no | — | What that reply says |
| `MARK_AS_READ` | no | `false` | Send blue ticks for inbound messages |
| `TUNNEL_PROVIDER` | no | `cloudflared` | `cloudflared` or `ngrok` |

---

## Exposing the webhook locally (ngrok / cloudflared)

Meta only calls **public HTTPS** URLs, so `localhost` needs a tunnel.

**Which one?**

| | cloudflared | ngrok |
| - | ----------- | ----- |
| Account needed | **No** | Yes (free) |
| Setup | Install and run | Install + one-time authtoken |
| Stable URL on free tier | No | No (paid plans get a reserved domain) |
| Best for | Getting started fastest | Inspecting traffic at `http://127.0.0.1:4040` |

**Recommendation:** start with **cloudflared** — a quick tunnel needs no signup.
Switch to ngrok when you want its request inspector.

### Install

**cloudflared**

```bash
winget install Cloudflare.cloudflared
```

macOS: `brew install cloudflared` · [other platforms](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

**ngrok**

```bash
winget install ngrok.ngrok
```

macOS: `brew install ngrok`. Then authenticate once with the token from
<https://dashboard.ngrok.com>:

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

### Run

Keep `npm run dev` running, then in a **second terminal**:

```bash
npm run tunnel
```

This uses `TUNNEL_PROVIDER` from `.env`. To force one:

```bash
npm run tunnel:cloudflared
```

```bash
npm run tunnel:ngrok
```

The script detects the public URL and prints exactly what you need:

```
========================================================================
  PASTE THESE INTO THE META DASHBOARD
========================================================================
  WhatsApp -> Configuration -> Webhook -> Edit

    Callback URL : https://4216-122-176-42-115.ngrok-free.app/webhook
    Verify token : local-test-token-123

  Then click "Verify and save", and subscribe to the "messages" field.
========================================================================
```

> **Note:** free tunnel URLs change every restart. Each time you restart the
> tunnel you must update the callback URL in the Meta dashboard.

---

## Registering the webhook with Meta

1. Start the app (`npm run dev`) **and** the tunnel (`npm run tunnel`).
2. Meta dashboard → **WhatsApp → Configuration → Webhook → Edit**.
3. **Callback URL**: the URL the tunnel printed, ending in `/webhook`.
4. **Verify token**: exactly the `WHATSAPP_VERIFY_TOKEN` value from your `.env`.
5. Click **Verify and save**.

Meta immediately sends `GET /webhook?hub.mode=subscribe&...`. Your console shows:

```
INFO Webhook verification succeeded - Meta accepted the callback URL.
```

6. Still on that page, click **Manage** next to *Webhook fields* and subscribe to
   **`messages`**. Without this you receive nothing.

Now message your business test number from WhatsApp. The console prints:

```
  INBOUND MESSAGE
  From      : Test User (+919876543210)
  Type      : text
  Text      : Hello there
  Message id: wamid.HBgMOTE5ODc2NTQzMjEwFQIAEhgU...
  Sent at   : 2026-09-09T11:13:55.000Z
```

---

## Sending messages

### From the console (no server needed)

```bash
npm run send -- --to 919876543210 --text "Hello from WAP_INT"
```

```bash
npm run send -- --to 919876543210 --template hello_world
```

```bash
npm run send -- --profile
```

Run `npm run send -- --help` for every flag.

### Interactive chat

```bash
npm run chat
```

It asks for a recipient, then sends each line you type. `/help` lists the
in-session commands (`/to`, `/template`, `/profile`, `/quit`).

### Over HTTP

```bash
curl -X POST http://localhost:3000/api/messages/text -H "Content-Type: application/json" -d "{\"to\":\"919876543210\",\"text\":\"Hello from WAP_INT\"}"
```

> ### The 24-hour rule — read this before you debug a "silent" send
>
> You may only send **free-form** messages within **24 hours** of the user's last
> message to you. Outside that window, only an **approved template** is delivered.
>
> The API returns `200 OK` either way — the message simply never arrives. So the
> first message in any conversation should be a template:
>
> ```bash
> npm run send -- --to 919876543210 --template hello_world
> ```
>
> `hello_world` is pre-approved on every test number. Once the user replies, the
> 24-hour window opens and free text works.

---

## API reference

All responses are JSON: `{ "success": true, "data": {...} }` or
`{ "success": false, "error": { "code": "...", "message": "..." } }`.

### API #1 — Webhook

#### `GET /webhook`

Meta's verification handshake. Answers with the raw `hub.challenge` when
`hub.verify_token` matches, otherwise `403`. Opening it in a browser returns a
friendly status object instead.

#### `POST /webhook`

Receives inbound messages and delivery statuses. Validates
`X-Hub-Signature-256`, replies `200` immediately, then processes the payload —
Meta retries anything not acknowledged quickly.

Handled inbound types: `text`, `image`, `video`, `audio`, `document`, `sticker`,
`location`, `contacts`, `reaction`, `button`, `interactive`, `order`, `system`.

### API #2 — Send

#### `POST /api/messages`

The general endpoint; switches on `type`.

| Field | Required | Description |
| ----- | -------- | ----------- |
| `to` | yes | International number, e.g. `919876543210` (a leading `+`, spaces or dashes are stripped) |
| `type` | no | `text` (default), `template`, `image`, `document`, `buttons`, `reaction` |

<details>
<summary><b>Payload examples</b></summary>

**Text**

```json
{ "to": "919876543210", "type": "text", "text": "Hello", "previewUrl": false }
```

**Template**

```json
{ "to": "919876543210", "type": "template", "template": { "name": "hello_world", "language": "en_US" } }
```

**Image**

```json
{ "to": "919876543210", "type": "image", "image": { "link": "https://example.com/cat.png", "caption": "Hi" } }
```

**Document**

```json
{ "to": "919876543210", "type": "document", "document": { "link": "https://example.com/invoice.pdf", "filename": "invoice.pdf" } }
```

**Reply buttons** (max 3, titles truncated to 20 chars)

```json
{
  "to": "919876543210",
  "type": "buttons",
  "header": "Confirmation",
  "body": "Do you want to continue?",
  "footer": "WAP_INT",
  "buttons": [{ "id": "yes", "title": "Yes" }, { "id": "no", "title": "No" }]
}
```

**Reaction**

```json
{ "to": "919876543210", "type": "reaction", "messageId": "wamid.XXX", "emoji": "👍" }
```

</details>

**Success response** (`201`)

```json
{
  "success": true,
  "data": {
    "messaging_product": "whatsapp",
    "contacts": [{ "input": "919876543210", "wa_id": "919876543210" }],
    "messages": [{ "id": "wamid.HBgMOTE5..." }],
    "messageId": "wamid.HBgMOTE5...",
    "to": "919876543210"
  }
}
```

#### Other endpoints

| Method & path | Purpose |
| ------------- | ------- |
| `POST /api/messages/text` | Shorthand: `{ to, text }` |
| `POST /api/messages/template` | Shorthand: `{ to, name, language }` |
| `POST /api/messages/raw` | Forwards your body straight to the Graph API |
| `GET /api/messages/recent?limit=20` | Last inbound messages held in memory |
| `GET /api/stats` | Counters since startup |
| `GET /api/profile` | Checks the token + phone number ID against Meta |
| `GET /health` | Liveness |
| `GET /` | Index of every endpoint |

---

## Testing without WhatsApp

You can exercise the whole webhook path with no Meta account at all.

Set `VERIFY_SIGNATURE=false` in `.env` (otherwise your hand-made request is
rejected for having no valid signature), restart, then:

**Verification handshake** — should print your challenge back:

```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=12345"
```

**Simulated inbound message** — should render an `INBOUND MESSAGE` block:

```bash
curl -X POST http://localhost:3000/webhook -H "Content-Type: application/json" -d "{\"object\":\"whatsapp_business_account\",\"entry\":[{\"id\":\"1\",\"changes\":[{\"field\":\"messages\",\"value\":{\"contacts\":[{\"profile\":{\"name\":\"Test User\"},\"wa_id\":\"919876543210\"}],\"messages\":[{\"from\":\"919876543210\",\"id\":\"wamid.TEST123\",\"timestamp\":\"1737000000\",\"type\":\"text\",\"text\":{\"body\":\"Hello\"}}]}}]}]}"
```

More ready-made requests — including delivery statuses and every send payload —
are in [`docs/requests.http`](docs/requests.http) (VS Code **REST Client**
extension).

**Remember to set `VERIFY_SIGNATURE=true` again afterwards.**

---

## Database (future integration)

No database is wired up yet — inbound messages live in memory and are printed to
the console. The folders are scaffolded and empty:

```
src/db/models/         schema definitions
src/db/repositories/   data access the services call
src/db/migrations/     versioned schema changes
src/db/seeds/          sample data
data/                  where a file-based engine (SQLite) would keep its file
```

[`src/db/README.md`](src/db/README.md) has a suggested schema and lists the three
functions to hook into — `handleInboundMessage()` carries a `TODO(db)` marker at
the exact insert point.

One thing to plan for: Meta **retries** deliveries it did not get a `200` for, so
the same message id can arrive twice. Make that insert an upsert.

---

## Troubleshooting

| Symptom | Cause and fix |
| ------- | ------------- |
| **"The callback URL or verify token couldn't be validated"** | The app or tunnel is not running, the URL is missing `/webhook`, or the token differs from `.env`. Check the console — a mismatch logs `Webhook verification FAILED`. |
| Verification succeeds but **no messages arrive** | You did not subscribe to the **`messages`** webhook field. Dashboard → Configuration → Webhook fields → Manage → tick `messages`. |
| Messages stopped arriving after a restart | The free tunnel URL changed. Re-paste the new callback URL. |
| `POST /webhook` returns **403** | Signature mismatch — `WHATSAPP_APP_SECRET` is wrong. For hand-made test requests set `VERIFY_SIGNATURE=false`. |
| **Send returns 200 but nothing arrives** | The 24-hour window has closed. Send a template first, or have the user message you. |
| `(#131030) Recipient phone number not in allowed list` | Add the recipient under **API Setup → Manage phone number list** (test numbers only). |
| `(#190) Access token has expired` | The temporary token lasted 24h. Generate a permanent System User token (see [Meta setup](#5-recommended-get-a-permanent-token)). |
| `(#100) Unsupported post request` | `WHATSAPP_PHONE_NUMBER_ID` is wrong — people often paste the phone *number* instead of its ID. |
| `(#132001) Template name does not exist` | The name or language code is wrong. Template names are case-sensitive; `hello_world` uses `en_US`. |
| `CONFIG_MISSING` on send | `WHATSAPP_ACCESS_TOKEN` or `WHATSAPP_PHONE_NUMBER_ID` is not in `.env`. Run `npm run check`. |
| `EADDRINUSE` | Port 3000 is taken. Change `PORT` in `.env`. |
| `cloudflared`/`ngrok` "not recognized" | Not installed or not on `PATH` — the script prints install commands. Reopen the terminal after installing. |

Set `LOG_LEVEL=debug` to see every raw webhook payload and Graph API call.

---

## Security notes

- **Never commit `.env`.** It is already in `.gitignore`.
- Keep `VERIFY_SIGNATURE=true` outside local testing — it is the only thing
  stopping anyone who learns your public URL from posting fake messages.
- The tunnel exposes your local port to the public internet while it runs. Stop
  it when you are done.
- Access tokens grant full send rights on your business number. Rotate any token
  that leaks, from the System User page.
- This project has no rate limiting or authentication on `POST /api/messages` —
  it is a development tool. Add both before putting it anywhere public.

---

## License

MIT
