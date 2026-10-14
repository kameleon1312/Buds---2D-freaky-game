#!/usr/bin/env node
// Builds the Android dev APK and installs it on the phone over Wi-Fi (or USB), then starts the game.
//
//   pnpm phone              build + install + start
//   pnpm phone --no-build   install the last APK again
//   pnpm phone pair <ip:port> <code>    once: pair with the phone (Wireless debugging → "Pair device with code")
//   pnpm phone connect <ip:port>        connect to the phone (Wireless debugging screen, "IP address & port")
//
// The APK talks to the API on this PC (http://<LAN IP>:4000, baked in by BudsBuild.AndroidDev); keep `pnpm dev`
// running and the phone on the same Wi-Fi. Override with BUDS_API_URL=http://host:port.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const unityVersion = process.env.BUDS_UNITY_VERSION ?? '6000.6.5f1';
const editor =
  process.env.UNITY ?? `C:/Program Files/Unity/Hub/Editor/${unityVersion}/Editor/Unity.exe`;
const adb =
  process.env.ADB ??
  path.join(path.dirname(editor), 'Data/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb.exe');
const apk = path.join(root, 'apps/unity/Builds/Android/Buds-dev.apk');
const appId = 'com.buds.game';
/** The phone's last wireless debugging address (Unity restarts adb while building, which drops the connection). */
const lastPhone = path.join(root, 'apps/unity/Builds/phone-address.txt');

const [cmd, ...rest] = process.argv.slice(2);
const run = (args, opts = {}) => execFileSync(adb, args, { encoding: 'utf8', ...opts });

if (!existsSync(adb)) {
  console.error(
    `adb not found at ${adb}. Install the Android module in Unity Hub (or set ADB=...).`,
  );
  process.exit(1);
}

if (cmd === 'pair' || cmd === 'connect') {
  if (rest.length === 0) {
    console.error(
      cmd === 'pair'
        ? 'Usage: pnpm phone pair <ip:port> <code>  (both from "Pair device with pairing code" on the phone)'
        : 'Usage: pnpm phone connect <ip:port>  (from the main Wireless debugging screen)',
    );
    process.exit(1);
  }
  // interactive: adb asks for the pairing code itself when it is left out
  const res = spawnSync(adb, [cmd, ...rest], { stdio: 'inherit' });
  if (cmd === 'connect' && res.status === 0 && connected().length > 0) {
    mkdirSync(path.dirname(lastPhone), { recursive: true });
    writeFileSync(lastPhone, rest[0]);
  }
  process.exit(res.status ?? 1);
}

if (cmd !== '--no-build') {
  if (!existsSync(editor)) {
    console.error(`Unity not found at ${editor} (set UNITY=...).`);
    process.exit(1);
  }
  console.log('Building the Android APK (first build ~10–15 min, later ones a few minutes)…');
  const log = path.join(root, 'apps/unity/Builds/android-build.log');
  const build = spawnSync(
    editor,
    [
      '-batchmode',
      '-nographics',
      '-quit',
      '-projectPath',
      path.join(root, 'apps/unity'),
      '-buildTarget',
      'Android',
      '-executeMethod',
      'Buds.EditorTools.BudsBuild.AndroidDev',
      '-logFile',
      log,
    ],
    { stdio: 'inherit' },
  );
  if (build.status !== 0) {
    console.error(`Build failed (is the Unity editor open on this project? close it). Log: ${log}`);
    process.exit(1);
  }
}

let devices = connected();
if (devices.length === 0 && existsSync(lastPhone)) {
  // the build restarted adb: connect to the phone again
  const address = readFileSync(lastPhone, 'utf8').trim();
  console.log(`Reconnecting to the phone at ${address}…`);
  spawnSync(adb, ['connect', address], { stdio: 'inherit' });
  devices = connected();
}
if (devices.length === 0) {
  console.error(
    'No phone connected. On the phone: Developer options → Wireless debugging → on, then here:\n' +
      '  pnpm phone pair <ip:port> <code>   (once, "Pair device with code")\n' +
      '  pnpm phone connect <ip:port>       (the address shown on the Wireless debugging screen;\n' +
      '                                      the port changes when wireless debugging is turned off and on)\n' +
      `Then: pnpm phone --no-build`,
  );
  process.exit(1);
}

console.log(`Installing on ${devices[0].split('\t')[0]}…`);
console.log(run(['install', '-r', apk]).trim());
run(['shell', 'monkey', '-p', appId, '-c', 'android.intent.category.LAUNCHER', '1']);
console.log('Started Buds on the phone.');

function connected() {
  return run(['devices'])
    .split('\n')
    .slice(1)
    .filter((l) => l.trim().endsWith('device'));
}
