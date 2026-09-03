// CAPABILITY: evidence-platform — platform-aware evidence swiper.
// Depends on composition/evidence-swiper.

import { evidenceSwiper } from "../compositions/evidence-swiper.js";

export function renderEvidencePlatform({ sources, slug, head }) {
  return evidenceSwiper({ sources, slug, head });
}
