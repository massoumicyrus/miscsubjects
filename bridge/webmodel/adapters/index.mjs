import chatgpt from './chatgpt.mjs';
import claude from './claude.mjs';
import grok from './grok.mjs';
import gemini from './gemini.mjs';
import kimi from './kimi.mjs';

// THE ADAPTER CONTRACT, in one place. Every field is provider-specific knowledge; the worker's
// session/turn machinery reads these and knows nothing else about any vendor's UI.
//
//   newUrl            where a new conversation starts
//   urlPattern        recognises a conversation URL and yields the provider conversation id
//   streamPattern     the network response whose completion means generation finished
//   composer          where a prompt is typed
//   stopSelector      the generating indicator; its disappearance is the UI completion signal
//   assistantSelector every assistant message node, in order
//   excludeWithin     reasoning/tool chrome inside a message that is not the final answer
//   signedOutProbe    optional: an element that exists ONLY when signed out
//   limitText         provider rate/usage limit language, surfaced verbatim
export const ADAPTERS = { chatgpt, claude, grok, gemini, kimi };
export const PROVIDERS = Object.keys(ADAPTERS);
export function adapterFor(provider) {
  const a = ADAPTERS[String(provider || '').toLowerCase().trim()];
  return a || null;
}
