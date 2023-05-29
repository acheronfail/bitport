/// <reference path="./node_modules/@types/node/index.d.ts" />

import path from 'path';
import * as fs from 'fs/promises';
import c from 'chalk';
import { $ } from 'execa';
import { Arg, Attachment, BitwardenItem, CliArgs } from './types';
import minimist, { ParsedArgs } from 'minimist';

// declarations ----------------------------------------------------------------

let $$ = $({ verbose: false, stdout: 'pipe', stderr: 'inherit', stdin: 'inherit', reject: false });
const OPT_OUTDIR = 'outdir';
const OPT_DEBUG: Arg = { long: 'debug', short: 'D' };
const OPT_VERBOSE: Arg = { long: 'verbose', short: 'v' };
const OPT_OVERWRITE: Arg = { long: 'overwrite', short: 'O' };
const OPT_DOWNLOADS: Arg = { long: 'parallel-downloads', short: 'p' };

// script ----------------------------------------------------------------------

const args = parseArgs();
if (args.debug) console.log(args);
if (args.debug) $$ = $$({ verbose: true });

(async function () {
  await createDir(args.outdir);

  const sessionKey = await getSessionKey();
  const items = await getAllItems(sessionKey);
  console.log(c.grey(`Found ${c.cyan(items.length)} item(s)`));
  await writeFile(path.join(args.outdir, 'items.json'), JSON.stringify(items, null, 2));

  await downloadAttachments(args, sessionKey, getAttachments(items));

  console.log(c.green(`Success!`));
})().then(undefined, (err) => {
  if (err instanceof Error) {
    console.error(c.red(err.message));
  } else {
    console.error(err);
  }

  process.exit(2);
});

// functions -------------------------------------------------------------------

async function downloadAttachments(args: CliArgs, sessionKey: string, attachments: Attachment[]): Promise<void> {
  console.log(c.grey(`Found ${c.cyan(attachments.length)} attachment(s)`));

  for (const chunk of splitChunks(attachments, args.parallelDownloads)) {
    await Promise.all(chunk.map((attachment) => downloadAttachment(args, sessionKey, attachment)));
  }
}

async function downloadAttachment(args: CliArgs, sessionKey: string, attachment: Attachment): Promise<void> {
  const attachmentDir = ensureTrailingSlash(path.join(args.outdir, attachment.parent.id));
  const outFile = path.join(attachmentDir, attachment.fileName);

  const s = `--session=${sessionKey}`;
  const i = `--itemid=${attachment.parent.id}`;
  const o = `--output=${outFile}`;

  await createDir(attachmentDir);

  const relPath = path.relative(args.outdir, outFile);
  if (!args.overwrite && (await fileExists(outFile))) {
    console.log(c.grey(`Skipping file ${c.yellow(relPath)} because it exists and --${OPT_OVERWRITE.long} not passed`));
    return;
  } else {
    console.log(c.grey(`Downloading ${c.yellow(relPath)}...`));
  }

  const { failed } = await $$`bw ${s} get attachment ${attachment.id} ${i} ${o}`;
  if (failed) {
    throw new Error(`Failed while downloading attachment.\n${i}\n${attachment.fileName}`);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch (err) {
    if (err instanceof Error) {
      if ((err as NodeJS.ErrnoException).code == 'ENOENT') {
        return false;
      }
    }

    throw err;
  }
}

async function writeFile(filePath: string, data: string): Promise<void> {
  if (args.verbose) {
    console.log(c.grey(`Writing file: ${c.yellow(path.relative(process.cwd(), filePath))}`));
  }
  await fs.writeFile(filePath, data, 'utf-8');
}

async function createDir(dir: string): Promise<void> {
  if (args.verbose) {
    console.log(c.grey(`Creating directory: ${c.yellow(path.relative(process.cwd(), dir))}`));
  }
  await fs.mkdir(dir, { recursive: true });
}

function splitChunks<T>(input: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  const arr = input.slice();
  let idx = 0;
  while (idx < arr.length) {
    chunks.push(arr.slice(idx, idx + chunkSize));
    idx += chunkSize;
  }

  return chunks;
}

function getAttachments(items: BitwardenItem[]): Attachment[] {
  const result: Attachment[] = [];
  for (const item of items) {
    if (!item.attachments) continue;

    for (const { id, fileName, url, size } of item.attachments) {
      // ensure no two attachments will share the same name and overwrite each other
      // we save them in a folder named with their item's id
      const duplicate = item.attachments.filter((a) => a.id !== id).some((a) => a.fileName === fileName);
      if (duplicate) throw new Error(`Duplicate attachment names (${fileName}) found in item: ${item.id}`);

      result.push({
        id,
        url,
        fileName,
        size: parseInt(size),
        parent: item,
      });
    }
  }

  return result;
}

async function getAllItems(sessionKey: string): Promise<BitwardenItem[]> {
  const { stdout, failed } = await $$`bw --session=${sessionKey} list items`;
  if (failed) throw new Error(`Failed to get items`);
  return JSON.parse(stdout);
}

async function getSessionKey(): Promise<string> {
  let stdout: string;
  let failed: boolean;

  if (await isLoggedIn()) {
    ({ stdout, failed } = await $$`bw unlock --raw`);
  } else {
    ({ stdout, failed } = await $$`bw login --raw`);
  }

  if (failed) throw new Error(`Failed to get session key`);

  return stdout;
}

async function isLoggedIn(): Promise<boolean> {
  const { failed } = await $$`bw login --check`;
  return !failed;
}

function parseArgs(): CliArgs {
  const args = minimist(process.argv.slice(2));
  if (args._.length != 1) showUsage();
  if (args.h || args.help) showUsage();

  const debug = parseBooleanArg(args, OPT_DEBUG);
  const verbose = debug || parseBooleanArg(args, OPT_VERBOSE);
  const overwrite = parseBooleanArg(args, OPT_OVERWRITE);
  const parallelDownloads = parseNumberArg(args, OPT_DOWNLOADS, 5);
  if (parallelDownloads <= 0) showUsage();

  return {
    outdir: path.resolve(process.cwd(), args._[0]),
    debug,
    verbose,
    overwrite,
    parallelDownloads,
  };
}

function ensureTrailingSlash(filePath: string): string {
  if (filePath.endsWith(path.sep)) {
    return filePath;
  }

  return filePath + path.sep;
}

function parseBooleanArg(args: ParsedArgs, arg: Arg): boolean {
  if (args[arg.long]) return true;
  if (arg.short && args[arg.short]) return true;
  return false;
}

function parseNumberArg(args: ParsedArgs, arg: Arg, defaultValue: number): number {
  const long = parseInt(args[arg.long]);
  if (!isNaN(long)) {
    return long;
  }

  if (!arg.short) {
    return defaultValue;
  }

  const short = parseInt(args[arg.short]);
  return isNaN(short) ? defaultValue : short;
}

function showUsage(): never {
  console.log(
    `\
Usage:
  script [OPTIONS] <${OPT_OUTDIR}>

Options:
  --${OPT_DEBUG.long}, -${OPT_DEBUG.short}                             enable debug output (also enables verbose output)
  --${OPT_VERBOSE.long}, -${OPT_VERBOSE.short}                           enable verbose output
  --${OPT_OVERWRITE.long}, -${OPT_OVERWRITE.short}                         should existing files be overwritten; defaults to no
  --${OPT_DOWNLOADS.long}, -${OPT_DOWNLOADS.short} <number>       how many attachments to download at once; defaults to 5

  `.trim()
  );

  process.exit(1);
}
