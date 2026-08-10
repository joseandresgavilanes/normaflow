import { messages } from "../src/lib/i18n/messages";
import { SUPPORTED_LOCALES, type Locale } from "../src/lib/i18n/config";

const baseKeys = Object.keys(messages.es);
const errors: string[] = [];

for (const locale of SUPPORTED_LOCALES) {
  const localeKeys = Object.keys(messages[locale]);
  for (const key of baseKeys) {
    if (!(key in messages[locale])) errors.push(`${locale}: missing key ${key}`);
    const value = messages[locale][key as keyof typeof messages.es];
    if (typeof value !== "string" || !value.trim()) errors.push(`${locale}: empty value ${key}`);
  }
  for (const key of localeKeys) {
    if (!(key in messages.es)) errors.push(`${locale}: unexpected key ${key}`);
  }
}

function placeholders(value: string) {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(",");
}

for (const key of baseKeys as Array<keyof typeof messages.es>) {
  const expected = placeholders(messages.es[key]);
  for (const locale of SUPPORTED_LOCALES.filter((item): item is Locale => item !== "es")) {
    const actual = placeholders(messages[locale][key]);
    if (expected !== actual) errors.push(`${locale}: placeholder mismatch ${key} (expected ${expected || "none"}, got ${actual || "none"})`);
  }
}

if (errors.length) {
  console.error(`i18n validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`i18n validation passed: ${baseKeys.length} keys across ${SUPPORTED_LOCALES.length} locales.`);
