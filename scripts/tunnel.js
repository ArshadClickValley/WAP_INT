#!/usr/bin/env node
/**
 * Starts a public HTTPS tunnel to the local server and prints the exact values
 * you paste into the Meta dashboard.
 *
 *   npm run tunnel                 -> uses TUNNEL_PROVIDER from .env
 *   npm run tunnel:cloudflared     -> Cloudflare quick tunnel (no account needed)
 *   npm run tunnel:ngrok           -> ngrok (free account + authtoken needed)
 *
 * The tunnel does NOT start the app - run `npm run dev` in another terminal.
 */
import { spawn } from 'node:child_process';
import { config } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';

const paint = logger.colour;

const provider = (process.argv[2] ?? config.tunnel.provider ?? 'cloudflared').toLowerCase();
const port = config.port;

let announced = false;

function announce(publicUrl) {
  if (announced || !publicUrl) return;
  announced = true;

  const callbackUrl = `${publicUrl.replace(/\/$/, '')}${config.webhookPath}`;

  console.log('');
  logger.banner('PASTE THESE INTO THE META DASHBOARD', [
    paint('bold', 'WhatsApp -> Configuration -> Webhook -> Edit'),
    '',
    `  Callback URL : ${paint('green', callbackUrl)}`,
    `  Verify token : ${paint('green', config.whatsapp.verifyToken || '(WHATSAPP_VERIFY_TOKEN is not set!)')}`,
    '',
    paint('dim', 'Then click "Verify and save", and subscribe to the "messages" field.'),
    paint('dim', `Local server must be running on http://localhost:${port} (npm run dev).`),
  ]);
  console.log('');
}

/** ngrok exposes the public URL on its local inspector API. */
async function pollNgrokApi(attempt = 0) {
  if (announced || attempt > 30) return;
  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels');
    const payload = await response.json();
    const httpsTunnel = (payload.tunnels ?? []).find((tunnel) => tunnel.public_url?.startsWith('https://'));
    if (httpsTunnel) {
      announce(httpsTunnel.public_url);
      return;
    }
  } catch {
    // inspector not up yet
  }
  setTimeout(() => pollNgrokApi(attempt + 1), 500);
}

function commandFor(name) {
  switch (name) {
    case 'ngrok': {
      const args = ['http', String(port)];
      if (config.tunnel.ngrokDomain) args.push('--domain', config.tunnel.ngrokDomain);
      args.push('--log', 'stdout');
      return { file: 'ngrok', args };
    }
    case 'cloudflared':
    case 'cloudflare':
    case 'cf':
      return { file: 'cloudflared', args: ['tunnel', '--url', `http://localhost:${port}`] };
    default:
      logger.error(`Unknown tunnel provider "${name}". Use "cloudflared" or "ngrok".`);
      process.exit(1);
      return null;
  }
}

function installHint(file) {
  if (file === 'ngrok') {
    return [
      'ngrok is not installed or not on PATH. Install it with one of:',
      '  winget install ngrok.ngrok         (Windows)',
      '  choco install ngrok                (Windows, Chocolatey)',
      '  brew install ngrok                 (macOS)',
      '  npm i -g ngrok',
      'Then authenticate once: ngrok config add-authtoken <token from dashboard.ngrok.com>',
    ];
  }
  return [
    'cloudflared is not installed or not on PATH. Install it with one of:',
    '  winget install Cloudflare.cloudflared   (Windows)',
    '  choco install cloudflared               (Windows, Chocolatey)',
    '  brew install cloudflared                (macOS)',
    'Or download it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/',
  ];
}

function main() {
  const command = commandFor(provider);

  logger.info(`Starting ${paint('bold', provider)} tunnel to http://localhost:${port} ...`);

  const child = spawn(command.file, command.args, { shell: process.platform === 'win32' });

  const scan = (chunk) => {
    const text = chunk.toString();
    process.stdout.write(paint('dim', text));

    // Cloudflare quick tunnels print https://<random>.trycloudflare.com
    const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i) ?? text.match(/https:\/\/\S+\.ngrok[^\s"']*/i);
    if (match) announce(match[0]);
  };

  child.stdout.on('data', scan);
  child.stderr.on('data', scan);

  if (command.file === 'ngrok') pollNgrokApi();

  child.on('error', (error) => {
    if (error.code === 'ENOENT') {
      logger.error(`Could not start "${command.file}".`);
      for (const line of installHint(command.file)) console.log(`  ${line}`);
    } else {
      logger.error(`Tunnel failed: ${error.message}`);
    }
    process.exit(1);
  });

  child.on('exit', (code) => {
    // On Windows the shell reports a missing binary itself and exits non-zero,
    // so ENOENT never reaches the 'error' handler - cover that case here.
    if (code !== 0 && !announced) {
      logger.error(`The tunnel did not start (exit code ${code}).`);
      for (const line of installHint(command.file)) console.log(`  ${line}`);
    } else {
      logger.info(`Tunnel exited with code ${code}.`);
    }
    process.exit(code ?? 0);
  });

  const stop = () => {
    child.kill();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main();
