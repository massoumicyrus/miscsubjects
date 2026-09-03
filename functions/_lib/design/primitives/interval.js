// PRIMITIVE: interval — vertical/horizontal spacing helpers.

export function spacer(size = 3) {
  return `<div class="ds-spacer ds-spacer-${size}" aria-hidden="true"></div>`;
}

export function divider() {
  return `<hr class="ds-divider" aria-hidden="true">`;
}
