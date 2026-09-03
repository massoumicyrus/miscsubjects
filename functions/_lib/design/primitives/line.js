// PRIMITIVE: line — rules and separators.

export function rule({ accent = false } = {}) {
  return `<span class="ds-rule${accent ? " ds-rule-accent" : ""}" aria-hidden="true"></span>`;
}
