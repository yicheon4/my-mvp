// Loads Sophie's prompt data from characters/ (public profile + style + common rules; no voice_direction).
import { readFileSync } from 'node:fs';
export function loadSophiePrompts(dir) {
  const read = f => readFileSync(new URL(f, dir), 'utf8');
  const profiles = JSON.parse(read('profiles.json'));
  const style = JSON.parse(read('character-prompts.json')).characters.sophie;
  return { common: read('common-system.txt'), setting: profiles.setting, profile: profiles.characters.sophie, style: { system_prompt: style.system_prompt, avoid: style.avoid } };
}
