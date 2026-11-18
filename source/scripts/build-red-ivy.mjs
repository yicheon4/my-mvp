// Red Ivy script → app data. Reads the delivered episode scripts (src/redivy/script/EPxx.md) plus a per-episode
// overlay (art slots, Korean translations, channel overrides) and writes src/redivy/data/<episode>.json.
// The English lines and Korean choice intents are copied verbatim. Stage directions in [ ] become structure
// (background, audience-only, CG beats) and are never shown as dialogue.
// Usage: node scripts/build-red-ivy.mjs            → validate all 10 episodes, write the enabled ones
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const scriptDir = new URL('src/redivy/script/', root);
const outDir = new URL('src/redivy/data/', root);
export const ENABLED = ['ep01', 'ep02', 'ep03', 'ep04']; // episodes wired into the app; others are only validated
const FREE_UNTIL = 5;           // EP01–05 free, EP06–10 premium (payment not implemented)

const CAST = new Set(['chloe', 'sophie', 'ethan', 'luna', 'julian', 'oliver', 'marcus']);
const CHANNELS = { 'IVY TALK': 'post', 'GROUP CHAT': 'group_chat', 'PRIVATE MESSAGE': 'private_message', 'UNKNOWN': 'private_message', 'END CARD': 'end_card' };

export function parseEpisode(md, number, hints) {
  const ep = `ep${String(number).padStart(2, '0')}`;
  const lines = md.split(/\r?\n/);
  const nodes = [];
  let title = '', scene = 0, place = '', audience = false, choice = null, pendingDirections = [];
  const scenes = [];
  const push = node => {
    node.scene = scene;
    if (audience) node.audience = true;
    if (pendingDirections.length) { node.directions = pendingDirections; pendingDirections = []; }
    if (choice && choice.stage === 'branch' && node.kind === 'line') node.in_branch = { choice_id: choice.choice_id, option: choice.current };
    nodes.push(node);
    return node;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line === '---') continue;
    let m;
    if ((m = line.match(/^# (EP\d+) — (.+)$/))) { title = m[2]; continue; }
    if ((m = line.match(/^## 장면 (\d+) · (.+)$/))) {
      scene = Number(m[1]); place = m[2]; audience = false;
      scenes.push({ index: scene, place_ko: place });
      continue;
    }
    if ((m = line.match(/^### 선택 (C\d+) · (.+)$/))) {
      choice = { choice_id: `${ep}_${m[1].toLowerCase()}`, title_ko: m[2], options: [], stage: 'intents', current: null };
      continue;
    }
    if (choice && choice.stage === 'intents' && (m = line.match(/^([AB])\. (.+)$/))) {
      choice.options.push({ id: m[1], intent_ko: m[2] });
      continue;
    }
    if (choice && (m = line.match(/^([AB]) → ([A-Z][A-Z .’'—-]*?): (.+)$/))) {
      if (choice.stage === 'intents') {
        choice.stage = 'branch';
        choice.node = push({ kind: 'choice', choice_id: choice.choice_id, title_ko: choice.title_ko, options: choice.options });
      }
      choice.current = m[1];
      push(lineNode(m[2], m[3]));
      continue;
    }
    if (line === '[합류]') {
      if (!choice || choice.stage !== 'branch') throw new Error(`${ep}: [합류] without branch`);
      choice.node.rejoin_pending = true;
      choice = null;
      continue;
    }
    if ((m = line.match(/^\[(.+)\]$/))) {
      const d = m[1];
      if (choice && choice.stage === 'intents') continue; // "[선택 의도를 사용자가 영어로 발화 → …]" production note
      if (/^관객 전용/.test(d)) audience = true;
      pendingDirections.push(d);
      continue;
    }
    if ((m = line.match(/^([A-Z][A-Z .’'—-]*?): (.+)$/))) { push(lineNode(m[1], m[2])); continue; }
    throw new Error(`${ep}: unparsed line: ${line}`);
  }
  if (choice) throw new Error(`${ep}: choice ${choice.choice_id} never rejoined`);
  if (pendingDirections.length) nodes.push({ kind: 'end', scene, directions: pendingDirections });

  // ids, ordering and links
  const counters = {};
  for (const n of nodes) {
    if (n.kind === 'choice') n.id = n.choice_id;
    else if (n.in_branch) { const k = `${n.in_branch.choice_id}_${n.in_branch.option}`; counters[k] = (counters[k] ?? 0) + 1; n.id = `${k}_${counters[k]}`; }
    else { const k = `${ep}_s${n.scene}`; counters[k] = (counters[k] ?? 0) + 1; n.id = `${k}_${String(counters[k]).padStart(2, '0')}`; }
  }
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.kind !== 'choice') continue;
    const branchOf = o => nodes.filter(x => x.in_branch?.choice_id === n.choice_id && x.in_branch.option === o);
    const a = branchOf('A'), b = branchOf('B');
    const after = nodes.slice(i + 1).find(x => !x.in_branch || x.in_branch.choice_id !== n.choice_id);
    if (!a.length || !b.length || !after) throw new Error(`${ep}: ${n.choice_id} missing A/B or rejoin`);
    n.branch = { A: a[0].id, B: b[0].id };
    n.rejoin = after.id;
    delete n.rejoin_pending;
    for (const list of [a, b]) list.forEach((x, k) => { x.next = k + 1 < list.length ? list[k + 1].id : after.id; });
    const hint = hints.find(h => h.choice_id === n.choice_id);
    if (!hint) throw new Error(`${ep}: no hint entry for ${n.choice_id}`);
    for (const o of n.options) {
      const h = hint.options.find(x => x.id === o.id);
      if (!h || h.intent_ko !== o.intent_ko) throw new Error(`${ep}: intent mismatch for ${n.choice_id} ${o.id}`);
      o.hint_en = h.optional_english_hint;
    }
  }
  const main = nodes.filter(n => !n.in_branch);
  main.forEach((n, k) => { if (n.kind !== 'choice') n.next = k + 1 < main.length ? main[k + 1].id : null; else n.next = null; });
  return { story_id: 'red_ivy_s1', episode_id: `red_ivy_s1_${ep}`, number, title, access: number <= FREE_UNTIL ? 'free' : 'premium', start: main[0].id, scenes, nodes };
}

function lineNode(label, text) {
  const [head, who] = label.split(' — ');
  const speaker = (who ?? head).toLowerCase().replace(/\s+/g, '_');
  const channel = CHANNELS[head] ?? (head === 'NARRATION' ? 'narration' : 'speech');
  const node = { kind: 'line', speaker: channel === 'post' ? 'ivy_talk' : channel === 'end_card' ? 'end_card' : speaker, channel, text };
  if (head === 'GROUP CHAT' || head === 'PRIVATE MESSAGE') node.label = label;
  return node;
}

// Overlay: art slots, translations and per-line channel overrides, keyed by the exact English text (or the exact
// direction text for beats). Unknown keys fail the build so a typo cannot silently drop an image or translation.
export function applyOverlay(episode, overlay) {
  const used = new Set();
  const byText = new Map();
  for (const n of episode.nodes) if (n.kind === 'line') (byText.get(n.text) ?? byText.set(n.text, []).get(n.text)).push(n);
  const take = (section, key) => { const list = byText.get(key); if (!list) throw new Error(`${episode.episode_id}: overlay.${section} key not in script: ${key}`); used.add(section + key); return list; };
  for (const s of episode.scenes) Object.assign(s, overlay.scenes?.[s.index] ?? {});
  for (const n of episode.nodes) {
    const s = episode.scenes.find(x => x.index === n.scene);
    n.background = (n.audience && s?.audience_background) || s?.background || null;
  }
  for (const [text, ko] of Object.entries(overlay.ko ?? {})) for (const n of take('ko', text)) n.ko = ko;
  for (const [text, portrait] of Object.entries(overlay.portraits ?? {})) for (const n of take('portraits', text)) n.portrait = portrait;
  for (const [text, cg] of Object.entries(overlay.cg ?? {})) for (const n of take('cg', text)) n.cg = cg;
  for (const [text, channel] of Object.entries(overlay.channels ?? {})) for (const n of take('channels', text)) n.channel = channel;
  for (const [choiceId, medium] of Object.entries(overlay.choice_medium ?? {})) {
    const c = episode.nodes.find(n => n.choice_id === choiceId && n.kind === 'choice');
    if (!c) throw new Error(`${episode.episode_id}: overlay.choice_medium unknown ${choiceId}`);
    c.medium = medium;
  }
  // Beats: a stage direction that needs a full-screen moment (CG or blackout) becomes its own tap-through node
  // with no text, inserted before the line that carried the direction.
  for (const [direction, beat] of Object.entries(overlay.beats ?? {})) {
    const i = episode.nodes.findIndex(n => n.directions?.includes(direction));
    if (i < 0) throw new Error(`${episode.episode_id}: overlay.beats direction not in script: ${direction}`);
    const target = episode.nodes[i];
    const id = `${target.id}_beat`;
    const node = { kind: 'beat', id, scene: target.scene, background: target.background, ...(target.audience ? { audience: true } : {}), ...beat, next: target.id };
    for (const n of episode.nodes) { if (n.next === target.id) n.next = id; if (n.branch?.A === target.id) n.branch.A = id; if (n.branch?.B === target.id) n.branch.B = id; if (n.rejoin === target.id) n.rejoin = id; }
    if (episode.start === target.id) episode.start = id;
    episode.nodes.splice(i, 0, node);
  }
  // Portrait carry-over: a speaker without an explicit slot keeps their last slot in the same scene, so a
  // missing annotation never makes the character vanish (the art layer still falls back to a placeholder).
  const last = {};
  for (const n of episode.nodes) {
    if (n.kind !== 'line' || !CAST.has(n.speaker) || n.channel !== 'speech') continue;
    const key = `${n.scene}:${n.audience ? 'a' : 'm'}:${n.speaker}`;
    if (n.portrait) last[key] = n.portrait; else if (last[key]) n.portrait = last[key];
  }
  const missingKo = episode.nodes.filter(n => n.kind === 'line' && !n.ko).map(n => n.text);
  return { missingKo };
}

export function validate(ep) {
  const ids = new Set(ep.nodes.map(n => n.id));
  const problems = [];
  if (ids.size !== ep.nodes.length) problems.push('duplicate ids');
  const choices = ep.nodes.filter(n => n.kind === 'choice');
  if (choices.length !== 4) problems.push(`expected 4 choices, got ${choices.length}`);
  for (const c of choices) {
    if (c.options.length !== 2) problems.push(`${c.choice_id}: options ${c.options.length}`);
    for (const o of ['A', 'B']) {
      let id = c.branch[o], steps = 0;
      while (id && id !== c.rejoin && steps++ < 50) id = ep.nodes.find(n => n.id === id)?.next;
      if (id !== c.rejoin) problems.push(`${c.choice_id} ${o}: does not reach rejoin`);
    }
  }
  for (const n of ep.nodes) {
    for (const k of ['next', 'rejoin']) if (n[k] && !ids.has(n[k])) problems.push(`${n.id}.${k} → missing ${n[k]}`);
    if (n.kind === 'choice' && n.audience) problems.push(`${n.id}: choice inside audience-only scene`);
    if (n.kind === 'line' && /[\[\]]|^[AB] →/.test(n.text)) problems.push(`${n.id}: direction text leaked into dialogue`);
  }
  // Walk main path: every choice is reachable from start.
  const seen = new Set(); let id = ep.start, guard = 0;
  while (id && guard++ < 1000) { seen.add(id); const n = ep.nodes.find(x => x.id === id); id = n.kind === 'choice' ? n.branch.A : n.next; }
  for (const c of choices) if (!seen.has(c.id)) problems.push(`${c.id}: unreachable`);
  return problems;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const hints = JSON.parse(readFileSync(new URL('choices-hints.json', scriptDir), 'utf8')).choices;
  let failed = false;
  for (let i = 1; i <= 10; i++) {
    const ep = `ep${String(i).padStart(2, '0')}`;
    const parsed = parseEpisode(readFileSync(new URL(`EP${String(i).padStart(2, '0')}.md`, scriptDir), 'utf8'), i, hints);
    const overlayUrl = new URL(`${ep}.overlay.json`, scriptDir);
    let note = '';
    if (existsSync(overlayUrl)) {
      const { missingKo } = applyOverlay(parsed, JSON.parse(readFileSync(overlayUrl, 'utf8')));
      if (missingKo.length) note = ` · 번역 없음 ${missingKo.length}줄`;
    }
    const problems = validate(parsed);
    const lines = parsed.nodes.filter(n => n.kind === 'line').length;
    console.log(`${ep} ${problems.length ? 'FAIL' : 'ok  '} choices=${parsed.nodes.filter(n => n.kind === 'choice').length} lines=${lines}${note}${problems.length ? ' → ' + problems.join('; ') : ''}`);
    if (problems.length) failed = true;
    if (ENABLED.includes(ep) && !problems.length) writeFileSync(new URL(`${ep}.json`, outDir), JSON.stringify(parsed, null, 1) + '\n');
  }
  if (failed) process.exit(1);
}
