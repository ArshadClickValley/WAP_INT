/**
 * Zero-dependency console logger.
 * This is a console-first project, so readable stdout output is the product.
 */
import { config } from '../config/env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

/** ESC control character (0x1B) - built at runtime so the source stays plain ASCII. */
const ESC = String.fromCharCode(27);

const COLOURS = {
  reset: `${ESC}[0m`,
  dim: `${ESC}[2m`,
  bold: `${ESC}[1m`,
  red: `${ESC}[31m`,
  yellow: `${ESC}[33m`,
  green: `${ESC}[32m`,
  blue: `${ESC}[34m`,
  cyan: `${ESC}[36m`,
  magenta: `${ESC}[35m`,
};

const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

const useColour = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const paint = (colour, text) => (useColour ? `${COLOURS[colour]}${text}${COLOURS.reset}` : String(text));

const currentLevel = LEVELS[config.logLevel] ?? LEVELS.info;

const timestamp = () => new Date().toISOString().replace('T', ' ').replace('Z', '');

const TAGS = {
  error: paint('red', 'ERROR'),
  warn: paint('yellow', ' WARN'),
  info: paint('green', ' INFO'),
  debug: paint('dim', 'DEBUG'),
};

function write(level, args) {
  if ((LEVELS[level] ?? 99) > currentLevel) return;
  const stream = level === 'error' ? console.error : console.log;
  stream(`${paint('dim', timestamp())} ${TAGS[level]}`, ...args);
}

export function stripAnsi(text) {
  return String(text).replace(ANSI_PATTERN, '');
}

export const logger = {
  error: (...args) => write('error', args),
  warn: (...args) => write('warn', args),
  info: (...args) => write('info', args),
  debug: (...args) => write('debug', args),

  /** Pretty-print an object under a label (debug level only). */
  json(label, value) {
    if (LEVELS.debug > currentLevel) return;
    write('debug', [label]);
    console.dir(value, { depth: 8, colors: useColour });
  },

  /** A boxed banner, used by the startup screen. */
  banner(title, lines = []) {
    const width = Math.max(title.length, ...lines.map((line) => stripAnsi(line).length), 40) + 4;
    const bar = '='.repeat(width);
    console.log(paint('cyan', bar));
    console.log(`  ${paint('bold', title)}`);
    if (!lines.length) return;
    console.log(paint('cyan', bar));
    for (const line of lines) console.log(`  ${line}`);
    console.log(paint('cyan', bar));
  },

  colour: paint,
};

export default logger;
