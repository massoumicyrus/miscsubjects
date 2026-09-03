import { dispatch } from './dispatch.js';

const DEFAULT_MODELS = ['GROK_CHAT', 'KIMI_CHAT', 'WORKERS_AI_CHAT'];
const MAX_QUESTIONS = 25;

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let b;
  try { b = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const article = String(b.article || '').trim();
  const questions = (Array.isArray(b.questions) ? b.questions : []).map(q => String(q).trim()).filter(Boolean).slice(0, MAX_QUESTIONS);
  const models = (Array.isArray(b.models) && b.models.length ? b.models : DEFAULT_MODELS).map(String);
  if (!article) return json({ error: 'article required' }, 400);
  if (!questions.length) return json({ error: 'questions required' }, 400);

  const results = {};
  let totalCost = 0;
  await Promise.all(models.map(async (model) => {
    results[model] = {};
    for (const q of questions) {
      const prompt = `Article:\n${article}\n\nQuestion: ${q}\n\nAnswer concisely from the article and your knowledge.`;
      try {
        const r = await dispatch(env, model, prompt);
        results[model][q] = String(r.result == null ? '' : r.result);
        totalCost += r.cost || 0;
      } catch (e) {
        results[model][q] = 'ERR:' + (e && e.message || String(e));
      }
    }
  }));

  return json({ models, questions, results, cost: totalCost });
}

export function onRequestGet() {
  return json({
    endpoint: '/api/panel',
    method: 'POST',
    body: { article: '<text>', questions: ['<q1>', '<q2>'], models: DEFAULT_MODELS },
    default_models: DEFAULT_MODELS,
    note: 'Each model answers each question. Add a model = add a directory agent row, then pass its KEY in models[].',
  });
}
