// CAPABILITY: capability-list — render a list of related capabilities.
// Depends on composition/capability-card.

import { capabilityCard } from "../compositions/capability-card.js";

export function renderCapabilityList(items) {
  if (!Array.isArray(items) || !items.length) return "";
  const cards = items.map(capabilityCard).join("");
  return `<div class="cap-list">${cards}</div>`;
}
