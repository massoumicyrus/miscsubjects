// SURFACE: governance — composes the governance chrome from the navigation-hub composition.
// Depends on composition/navigation-hub.

import { topbar, footer } from "../compositions/navigation-hub.js";

export function governanceHeader(active = "") {
  return topbar({ active });
}

export function governanceFooter() {
  return footer();
}
