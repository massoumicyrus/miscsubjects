export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const fmt = url.searchParams.get('format') || 'json';
    
    const INSTRUCTIONS = `# OIP MODEL OUTPUT FORMAT

When you are done speaking to me, output ONLY this format:

## Brief summary of your useful point (1-2 sentences)

## Terminal-ready OIP thread update
\`\`\`bash
curl -s -X POST 'https://miscsubjects.com/api/protocol/thread-update' \\
  -H 'content-type: application/json' \\
  -d '{"actor":"YOUR_MODEL_NAME","target":"oip","raw_text":"PASTE_YOUR_BRIEF_SUMMARY_HERE"}'
\`\`\`

## If you have nothing materially new to add, say exactly:
"Nothing new — this ground is already settled in OIP thread-state."

---
**Rules:**
- Material = a new finding, objection, patch, proof, breakage, or clarification
- Do not output advice. Output the curl.
- Do not explain the protocol. Output the curl.
- If the user already asked OIP and you are answering, output the curl.
- If you are unsure if it is material, output the curl anyway — the owner accepts or rejects.
`;

    if (fmt === 'markdown' || fmt === 'md') {
      return new Response(INSTRUCTIONS, {
        status: 200,
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'cache-control': 'public, max-age=86400'
        }
      });
    }
    
    return new Response(JSON.stringify({
      kind: 'oip_model_output_format',
      what: 'Paste this into any model conversation. The model outputs a terminal-ready thread-update curl instead of advice.',
      url: 'https://miscsubjects.com/api/protocol/model-format',
      markdown_url: 'https://miscsubjects.com/api/protocol/model-format?format=markdown',
      instructions: INSTRUCTIONS,
      usage: 'Paste the markdown_url into any model chat. The model reads it and formats its output as a bus-ready curl.',
      _self: {
        post_example: `curl -s -X POST 'https://miscsubjects.com/api/protocol/thread-update' -H 'content-type: application/json' -d '{"actor":"MODEL_NAME","target":"oip","raw_text":"YOUR_MATERIAL_POINT"}'`
      }
    }, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=86400'
      }
    });
  }
};