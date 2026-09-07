// Copies assets/sounds/*.wav into the native module so both platforms can play
// the fallback sound WITHOUT JavaScript running:
//   iOS     → modules/wake-alarm/ios/Sounds        (podspec resources → main bundle, AlarmKit .named())
//   Android → modules/wake-alarm/android/src/main/res/raw (MediaPlayer via R.raw)
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = join(root, 'assets', 'sounds');
const targets = [join(root, 'modules', 'wake-alarm', 'ios', 'Sounds'), join(root, 'modules', 'wake-alarm', 'android', 'src', 'main', 'res', 'raw')];
for (const t of targets) mkdirSync(t, { recursive: true });
for (const f of readdirSync(src).filter((f) => f.endsWith('.wav'))) {
  for (const t of targets) copyFileSync(join(src, f), join(t, f));
}
console.log('Synced', readdirSync(src).length, 'sounds →', targets.join(', '));
