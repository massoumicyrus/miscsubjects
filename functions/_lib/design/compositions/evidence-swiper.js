// COMPOSITION: evidence-swiper — wraps the platform evidence rail.
// Depends on capability/evidence-platform for card rendering.

import { renderPlatformRail } from "../../widgets/rail-platform.js";

export function evidenceSwiper({ sources, slug, head }) {
  if (!Array.isArray(sources) || !sources.length) return "";
  return renderPlatformRail(sources, slug, head);
}
