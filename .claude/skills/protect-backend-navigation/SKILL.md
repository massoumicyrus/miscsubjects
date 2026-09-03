---
name: protect-backend-navigation
description: Protect and verify the miscsubjects backend/admin navigation. Use for any backend menu, admin header, tab, navigation, layout, responsive-menu, hidden-item, overflow, More-button, or functions/admin/_layout.js task, and whenever an agent or automation changes admin destinations.
---

# Protect Backend Navigation

Treat every entry in `PRIMARY_TABS` as owner-visible primary navigation.

## Invariants

- Render every `PRIMARY_TABS` item as a direct anchor on every admin page.
- Keep one canonical tab array in `functions/admin/_layout.js`.
- Wrap the complete list on desktop and mobile.
- Never introduce `More`, an overflow dropdown, a compact subset, a hidden secondary container, width-based omission, or runtime item prioritization.
- Preserve every existing destination unless the owner explicitly names an item to add, rename, move, or remove.
- Treat a missing item, hidden item, renamed destination, or changed order as a regression.

## Workflow

1. Read `functions/admin/_layout.js`, `PROTECTED_FEATURES.md`, `AGENTS.md`, and `scripts/check-backend-navigation.mjs`.
2. Compare `PRIMARY_TABS` with the rendered navigation. Account for every item by href and label.
3. Patch only the smallest navigation layer.
4. Run `node scripts/check-backend-navigation.mjs`.
5. Run syntax checks for every edited JavaScript file.
6. Update only the two authorized baseline snapshots after the checker passes: `.protected/guard-baseline/functions_admin_layout_js` and `.protected/guard-baseline/scripts_check_backend_navigation_mjs`. Never run a global baseline update while unrelated protected drift exists.
7. Deploy from `/Users/owner/miscsubjects-pages` and require `Uploading Functions bundle`.
8. Open an authenticated admin page at desktop and mobile widths. Confirm all labels are visible without opening or tapping another control.
9. Fetch each `PRIMARY_TABS` href with owner authentication and record the HTTP status.
10. Leave `functions/admin/_layout.js` and `scripts/check-backend-navigation.mjs` protected.

## Failure conditions

- Any `PRIMARY_TABS` href missing from rendered HTML.
- Any `More` summary or dropdown.
- Any navigation item accessible only after another click.
- Any desktop/mobile rule that hides, clips, or conditionally omits items.
- Any protected-baseline update performed before the deterministic and live checks pass.
