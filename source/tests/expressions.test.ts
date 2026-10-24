import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { EXPRESSIONS, chloeDemo, chloeHubChoices, chloeOpening, expressionArt, normalizeExpression, normalizeMotion } from '../src/expressions/expressions.ts';

test('unsupported values fall back to neutral / no motion', () => {
  assert.equal(normalizeExpression('angry'), 'neutral'); assert.equal(normalizeExpression(undefined), 'neutral');
  assert.equal(normalizeExpression('laugh'), 'laugh');
  assert.equal(normalizeMotion('jump'), null); assert.equal(normalizeMotion('tilt'), 'tilt');
});

test('every Chloe demo reply states a valid expression and motion; every branch leads somewhere', () => {
  for (const [id, n] of Object.entries(chloeDemo)) {
    assert.ok((EXPRESSIONS as readonly string[]).includes(n.expression), id);
    assert.ok(n.motion === null || n.motion === 'nod' || n.motion === 'tilt', id);
    assert.ok(n.choices.length >= 2, id);
    for (const c of n.choices) assert.ok(chloeDemo[c.next], `${id} → ${c.next}`);
  }
  for (const c of chloeHubChoices) assert.ok(chloeDemo[c.next]);
});

test('scenario covers all six states: greeting smile, daily neutral, funny laugh, worry concerned, opinion thinking, letdown disappointed', () => {
  assert.equal(chloeOpening.expression, 'smile');
  const byTopic = Object.fromEntries(chloeHubChoices.map(c => [c.next, chloeDemo[c.next].expression]));
  assert.deepEqual(byTopic, { daily: 'neutral', funny: 'laugh', worry: 'concerned', opinion: 'thinking', chore: 'disappointed' });
  const motions = Object.values(chloeDemo).map(n => n.motion);
  assert.ok(motions.filter(Boolean).length < motions.length / 2, 'motion only at chosen moments');
});

test('all six Chloe expressions are real files on the base portrait canvas', () => {
  const size = (p: string) => { const b = readFileSync(new URL('../public' + p, import.meta.url)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  assert.deepEqual(Object.keys(expressionArt.chloe).sort(), [...EXPRESSIONS].sort());
  for (const src of Object.values(expressionArt.chloe)) {
    assert.ok(existsSync(new URL('../public' + src, import.meta.url)), src);
    assert.deepEqual(size(src!), [1024, 1536], src);
  }
});

test('demo lines never reach the character prompt data', () => {
  const data = ['common-system.txt', 'character-prompts.json', 'profiles.json'].map(f => readFileSync(new URL('../characters/' + f, import.meta.url), 'utf8')).join('\n');
  for (const n of Object.values(chloeDemo)) assert.ok(!data.includes(n.text.slice(0, 30)), n.text);
});
