export const SOFTWARE_COMPARISON_AXES = [
  ['product_boundary', 'What the shipped product includes'],
  ['primary_user', 'Who directly operates it'],
  ['unit_of_composition', 'The smallest configured unit'],
  ['runtime_and_durability', 'What continues after one model response or process'],
  ['agent_coordination', 'How agents exchange or hand off work'],
  ['model_support', 'Which model providers and model identities operate'],
  ['environment_reach', 'Which files, services, devices, and networks actions can change'],
  ['tool_and_integration_model', 'How actions are defined and called'],
  ['knowledge_and_memory', 'What stored knowledge and history can be read later'],
  ['observability_and_receipts', 'What requests, results, errors, and retries are stored'],
  ['outside_contribution', 'How a person or model outside the coding session adds evidence or objections'],
  ['self_editing', 'How the system reads and changes its own source or configuration'],
  ['governance_and_authority', 'Which keys, approvals, and gates allow each change'],
  ['deployment_model', 'Where the code and state run'],
  ['maturity_and_adoption', 'What release, usage, reliability, and adoption evidence exists'],
];

export const SOFTWARE_COMPARISON_AXIS_IDS = SOFTWARE_COMPARISON_AXES.map(([id]) => id);

export const LEGACY_BUILD_AXIS_MAP = {
  combined_object: 'product_boundary',
  durable_work: 'runtime_and_durability',
  multi_model_history: 'agent_coordination',
  tools_and_actions: 'tool_and_integration_model',
  knowledge_and_articles: 'knowledge_and_memory',
  repair: 'observability_and_receipts',
  outside_challenge: 'outside_contribution',
  recursive_development: 'self_editing',
};

export function normalizeSoftwareComparisonAxis(value) {
  const id = String(value || '').trim();
  return LEGACY_BUILD_AXIS_MAP[id] || id;
}
