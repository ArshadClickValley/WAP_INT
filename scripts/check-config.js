#!/usr/bin/env node
/**
 * Pre-flight check: `npm run check`
 * Confirms the .env values are present and that the credentials actually work.
 */
import { config, inspectConfig, redactedConfig } from '../src/config/env.js';
import { logger } from '../src/utils/logger.js';
import { getPhoneNumberProfile } from '../src/services/whatsapp.service.js';

const paint = logger.colour;
const tick = paint('green', 'OK  ');
const cross = paint('red', 'FAIL');
const warn = paint('yellow', 'WARN');

async function main() {
  logger.banner('WAP_INT - configuration check');

  console.log(paint('bold', '\n  Values loaded from .env\n'));
  for (const [key, value] of Object.entries(redactedConfig())) {
    console.log(`  ${key.padEnd(20)} ${paint('cyan', String(value))}`);
  }

  const { errors, warnings } = inspectConfig();

  console.log(paint('bold', '\n  Checks\n'));
  console.log(`  ${errors.length ? cross : tick} required variables`);
  for (const error of errors) console.log(`       ${paint('red', error)}`);
  for (const warning of warnings) console.log(`  ${warn} ${paint('yellow', warning)}`);

  if (config.whatsapp.accessToken && config.whatsapp.phoneNumberId) {
    try {
      const profile = await getPhoneNumberProfile();
      console.log(`  ${tick} Graph API credentials work`);
      console.log(`       Sender      : ${paint('cyan', profile.display_phone_number ?? '(unknown)')}`);
      console.log(`       Verified as : ${paint('cyan', profile.verified_name ?? '(unknown)')}`);
      console.log(`       Quality     : ${paint('cyan', profile.quality_rating ?? '(unknown)')}`);
    } catch (error) {
      console.log(`  ${cross} Graph API call failed: ${paint('red', error.message)}`);
      if (error.details) console.dir(error.details, { depth: 4, colors: true });
    }
  } else {
    console.log(`  ${warn} skipped the live Graph API call (token or phone number id missing)`);
  }

  console.log('');
  process.exit(errors.length ? 1 : 0);
}

main().catch((error) => {
  logger.error(error.message);
  process.exit(1);
});
