/// <reference path="./node_modules/@types/node/index.d.ts" />

import * as fs from 'fs/promises';
import { $ } from 'execa';
import { BitwardenItem } from './types';

const $$ = $({ stdout: 'pipe', stderr: 'inherit', stdin: 'inherit' });

// script ----------------------------------------------------------------------

const sessionKey = await getSessionKey();
const items = await getAllItems(sessionKey);
// TODO: now we have the items, download each attachment

// functions -------------------------------------------------------------------

async function getAllItems(sessionKey: string): Promise<BitwardenItem[]> {
  const { stdout } = await $$`bw --session=${sessionKey} list items`;
  return JSON.parse(stdout);
}

async function getSessionKey(): Promise<string> {
  let stdout: string;

  if (await isLoggedIn()) {
    ({ stdout } = await $$`bw unlock --raw`);
  } else {
    ({ stdout } = await $$`bw login --raw`);
  }

  return stdout;
}

async function isLoggedIn(): Promise<boolean> {
  const { failed } = await $$`bw login --check`;
  return !failed;
}
