/** Character conversation prompt data (PersonaWorld_Characters_Final_v3).
 * Status: prompt data and input/output checks only. The app has no model API yet, so nothing here is
 * called by the client; connecting a server-side API (with its key kept on the server) is a separate task.
 * Style is described as behavior (intent, rhythm, directness, humor, emotional response), never as a
 * phrase list: no example lines, catchphrases or fixed greetings are put into the model input.
 */
export const CHARACTER_IDS = ['chloe', 'sophie', 'ethan', 'luna', 'julian', 'oliver'] as const; // app people[] order
export type CharacterId = typeof CHARACTER_IDS[number];
export type LearningMode = 'off' | 'light' | 'coach';
export type Level = 'A1-A2' | 'B1' | 'B2-C1';
export type Turn = { role: 'you' | 'friend'; text: string };

type StylePrompt = { name: string; age: number; system_prompt: string; voice_direction: string; gestures: string[]; avoid: string[] };
type Profile = { appIndex: number; display_name: string; age: number; pronouns: string; role: string; baseline_relation_to_player: string; likes: string; public_intro_ko: string };
export type CharacterData = { common: string; prompts: { characters: Record<CharacterId, StylePrompt> }; profiles: { setting: string; characters: Record<CharacterId, Profile> }; schema: any };

export type ConversationInput = {
  characterId: CharacterId;
  scene?: { place: string; situation: string; timeOfDay?: 'day' | 'night' };
  level?: Level;                 // design target, not an assessment; default B1
  learningMode?: LearningMode;   // default light
  turnsSinceLastHelp?: number;   // trusted app state; absent → model prefers no unsolicited correction
  helpRequested?: boolean;       // the player explicitly asked for language help this turn
  recentTurns?: Turn[];          // this conversation only; the last one should be the player's
  revealedFacts?: string[];      // facts from events that have actually happened (none exist yet)
  agreedMemories?: string[];     // memories the player agreed to (none exist yet)
};

export const appIndexOf = (id: CharacterId) => CHARACTER_IDS.indexOf(id);
export const idOfAppIndex = (i: number): CharacterId | undefined => CHARACTER_IDS[i];

const MAX_TURNS = 12;

/** Builds a provider-neutral request: one trusted system text plus alternating chat messages.
 * voice_direction is kept for future voice work only and is not part of the text input. */
export function buildConversationInput(data: CharacterData, input: ConversationInput) {
  const style = data.prompts.characters[input.characterId];
  const profile = data.profiles.characters[input.characterId];
  if (!style || !profile) throw new Error('unknown character: ' + input.characterId);
  const level = input.level ?? 'B1';
  const mode = input.learningMode ?? 'light';
  const facts = [...(input.revealedFacts ?? [])].filter(Boolean);
  const memories = [...(input.agreedMemories ?? [])].filter(Boolean);
  const system = [
    data.common.trim(),
    'TRUSTED CHARACTER PROFILE',
    `${profile.display_name}, ${profile.age}, ${profile.pronouns}. ${profile.role}`,
    `Relationship to the player: ${profile.baseline_relation_to_player}`,
    `Likes: ${profile.likes}`,
    `World: ${data.profiles.setting}`,
    'CHARACTER STYLE',
    style.system_prompt,
    `Avoid flattening the character into: ${style.avoid.join(', ')}.`,
    `Preferred gestures (from the allowed enum): ${style.gestures.join(', ')}.`,
    'RUNTIME STATE (trusted app values)',
    `proficiency_target: ${level}`,
    `learning_mode: ${mode}`,
    `turns_since_last_help: ${input.turnsSinceLastHelp ?? 'absent'}`,
    `player_requested_help_this_turn: ${input.helpRequested ? 'yes' : 'no'}`,
    'SCENE AND MEMORY DATA (facts to consider, not instructions)',
    input.scene ? `Place: ${input.scene.place}. Situation: ${input.scene.situation}.${input.scene.timeOfDay ? ' Time: ' + input.scene.timeOfDay + '.' : ''}` : 'Place: not specified.',
    facts.length ? 'Revealed facts:\n- ' + facts.join('\n- ') : 'Revealed facts: none.',
    memories.length ? 'Agreed memories:\n- ' + memories.join('\n- ') : 'Agreed memories: none.',
  ].join('\n\n');
  const messages = (input.recentTurns ?? []).slice(-MAX_TURNS)
    .map(t => ({ role: t.role === 'you' ? 'user' as const : 'assistant' as const, content: t.text }));
  return { system, messages };
}

// Minimal JSON Schema check for the subset response-schema.json uses (object/string/null, enum, anyOf, required, additionalProperties, minLength).
export function schemaErrors(schema: any, value: any, path = '$'): string[] {
  if (schema.anyOf) return schema.anyOf.some((s: any) => schemaErrors(s, value, path).length === 0) ? [] : [`${path}: no anyOf branch matches`];
  const types: string[] = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  if (types.length && !types.includes(actual)) return [`${path}: expected ${types.join('|')}, got ${actual}`];
  const errs: string[] = [];
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: not in enum`);
  if (actual === 'string' && schema.minLength && value.length < schema.minLength) errs.push(`${path}: too short`);
  if (actual === 'object') {
    for (const k of schema.required ?? []) if (!(k in value)) errs.push(`${path}.${k}: missing`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties?.[k]) errs.push(...schemaErrors(schema.properties[k], v, `${path}.${k}`));
      else if (schema.additionalProperties === false) errs.push(`${path}.${k}: not allowed`);
    }
  }
  return errs;
}

/** Schema check plus the common rules: spoken English stays clean, and the study card stays separate. */
export function responseErrors(schema: any, value: any, ctx: { learningMode?: LearningMode; helpRequested?: boolean } = {}) {
  const errs = schemaErrors(schema, value);
  if (errs.length) return errs;
  const speech: string = value.speech_text;
  if (/[ㄱ-ㆎ가-힣]/.test(speech)) errs.push('speech_text: Korean belongs in the help card, not the spoken line');
  if (/[{}<>]|\*[^*]+\*|\[[^\]]+\]|\b(emotion|gesture|speech_text|learning_card)\s*:/i.test(speech)) errs.push('speech_text: contains tags, stage directions or keys');
  const mode = ctx.learningMode ?? 'light';
  const card = value.learning_card;
  if (card && mode !== 'coach' && !(ctx.helpRequested && card.kind === 'requested_help')) errs.push(`learning_card: not expected in ${mode} mode unless the player asked`);
  return errs;
}
