// SURFACE: home — composition helpers for the static homepage.
// The public/index.html page consumes these through CSS classes and inline markup.
// This module exists so future dynamic homepage variants can reuse the same grammar.

import { chapter } from "../compositions/chapter.js";
import { featuredCard, indexList } from "../compositions/relationship-card.js";
import { button } from "../primitives/button.js";

export { chapter, featuredCard, indexList, button };
