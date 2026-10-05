# Simple guide

How to run this project on your computer, in plain words.

---

## 1. Run the project

**Install Node.js once.** Go to <https://nodejs.org>, download the **LTS**
version, install it by clicking Next on every screen.

**Open a terminal in the project folder.** Open `C:\Repos\WAP_INT` in File
Explorer, click the address bar at the top, type `powershell`, press Enter.

**Install the project parts** (only the first time):

```bash
npm install
```

**Start it:**

```bash
npm run dev
```

You will see a box listing all the addresses, ending with
`Waiting for messages...`. That means it is running. Keep this window open.

To stop it, press **Ctrl+C**.

---

## 2. Set the values it needs

The settings live in a file called `.env`. Open it by typing:

```bash
notepad .env
```

Paste your values after the `=` sign. No spaces, no quotes.

| Value | What it is | Where to get it |
| ----- | ---------- | --------------- |
| `WHATSAPP_PHONE_NUMBER_ID` | The ID of the number you send from | Meta dashboard → WhatsApp → API Setup. It is the long number **under** the phone number, not the phone number itself |
| `WHATSAPP_ACCESS_TOKEN` | The password that lets you send | Same page, top. The temporary one stops working after 24 hours |
| `WHATSAPP_APP_SECRET` | Proves incoming messages really came from WhatsApp | App settings → Basic → App secret → Show |
| `WHATSAPP_VERIFY_TOKEN` | A password you invent, for connecting the webhook | Already filled in for you. Leave it |
| `PORT` | Which port it runs on | Leave as `3000` |

The Meta dashboard is at <https://developers.facebook.com> → My Apps → your app.

Save the file (Ctrl+S), then check everything is correct:

```bash
npm run check
```

Green `OK` lines mean it works. Red `FAIL` means a value is wrong.

---

## 3. The two APIs

### API 1 — Webhook (receiving messages)

**What it does:** when someone sends a WhatsApp message to your number, WhatsApp
calls this address and your terminal prints the message.

**Address:** `POST /webhook`

**To make it work,** WhatsApp needs a public address for your computer. Open a
**second** terminal in the same folder and run:

```bash
npm run tunnel
```

It prints a **Callback URL** and a **Verify token**. Copy both into the Meta
dashboard under **WhatsApp → Configuration → Webhook → Edit**, then click
**Verify and save**.

Then click **Manage** next to *Webhook fields* and tick **`messages`**.
Without this tick, nothing arrives.

Now message your business number from your phone. Your terminal shows:

```
  INBOUND MESSAGE
  From      : Your Name (+919876543210)
  Text      : Hello
```

> The tunnel address changes every time you restart it. Paste the new one into
> Meta each time.

---

### API 2 — Send (sending messages)

**What it does:** sends a WhatsApp message to someone.

**Address:** `POST /api/messages`

**Easiest way — from the terminal:**

```bash
npm run send -- --to 919876543210 --text "Hello"
```

The number is the country code plus the number, no `+` and no spaces.

**To chat back and forth:**

```bash
npm run chat
```

**Using the API directly:**

```bash
curl -X POST http://localhost:3000/api/messages/text -H "Content-Type: application/json" -d "{\"to\":\"919876543210\",\"text\":\"Hello\"}"
```

Other things you can send by changing `type`: `template`, `image`, `document`,
`buttons`, `reaction`. Examples for each are in [docs/requests.http](docs/requests.http).

> **Important:** you can only send normal messages within **24 hours** of the
> person last messaging you. After that, only a template arrives — the API still
> says success, but nothing is delivered. Send this first:
>
> ```bash
> npm run send -- --to 919876543210 --template hello_world
> ```

---

## Other useful addresses

| Address | What it shows |
| ------- | ------------- |
| `GET /health` | Whether it is running |
| `GET /api/messages/recent` | The last messages received |
| `GET /api/stats` | How many sent and received |
| `GET /api/profile` | Checks your token is valid |

---

## If something does not work

| Problem | Fix |
| ------- | --- |
| `'node' is not recognized` | Close the terminal, open a new one |
| `FAIL` on `npm run check` | A value in `.env` is wrong. Check for extra spaces or quotes |
| `#100 Unsupported post request` | You pasted the phone number instead of the Phone number ID |
| `#190 Access token has expired` | Get a fresh token from the Meta dashboard |
| Meta says the URL "couldn't be validated" | Both terminal windows must be running, and the URL must end in `/webhook` |
| Nothing arrives | You did not tick `messages` in Webhook fields |
| Sent but not delivered | The 24-hour rule — send a template first |
| Stopped working after restart | The tunnel address changed. Paste the new one into Meta |

Never share your `.env` file — it holds your passwords.

For full details, see [README.md](README.md).
