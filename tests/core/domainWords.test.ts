import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Ord som hör till pepparkaksdomänen och inte får finnas i kärnan, SPEC.md avsnitt 2. */
const DOMAIN_WORDS = /\b(deg|degen|glasyr\w*|pepparkak\w*|gingerbread)\b/i;

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

describe('kärnan', () => {
  it('innehåller inga pepparkaksbegrepp', () => {
    const offenders = listFiles('src/core').filter((file) => DOMAIN_WORDS.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
