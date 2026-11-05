# CODEX IMPLEMENTATION PROMPT — JIBUN BOT: UNIVERSAL, PERSONA-AWARE AFFINITY SHORTCUT

**Target repository:** https://github.com/Shiki-12/jibun-bot

You are a coding agent working directly inside THIS repository. Add a public, persistent, self-service affection level shortcut for all authorized ordinary users and every available personality, **including Jiang Cheng**. Implement and test it, not just a design proposal. Do not push or deploy without permission.

## Objective and permissions

A regular user must be able to jump immediately from level 0 (distant/stranger) to level 4 (deepest established trust), or any intermediate level, without waiting for daily +2 gains and without admin permission. This modifies **only the requesting user's relationship for their currently active persona**. It must not mutate another Telegram user's record, another persona's affinity, a group-wide setting, or other users' personality selection. Respect the existing bot whitelist, bans, and maintenance mode; “all users” means all users with normal permission to use the bot, not permission to bypass its guards.

The group's rule that only group admins can change the selected persona remains unchanged. A regular member can still use this shortcut to adjust **their own** affinity with that selected persona.

## Inspect the current implementation and repair any incomplete integration

Read and compare these live files before changing code:
- `src/core/affinity.js`, `src/features/affinity.js`, and `src/core/migrations/009_affinity.sql`.
- All later `src/core/migrations/*.sql`, particularly any `persona_affinity` table or migration.
- `src/index.js`: note the existing `recordInteraction(ctx.from.id, tz, Date.now(), activePersona.id)` call.
- `src/core/actions.js`: note where `getAffinity(ctx.from.id, tz)` builds the LLM's relationship instruction.
- `src/core/settings.js`: `getEffectivePersona(ctx)` / `ctx.personaId`.
- `src/personalities/jiang_cheng.js`: persona-specific affinity titles and instructions, and requested English-only behavior.
- `src/personalities/index.js` and `src/features/persona.js`: inspect how personality IDs are actually registered; do not assume README matches runtime.
- `src/core/loader.js`, `src/core/kaomoji.js` / `sanitizeReply`, `src/core/export.js`, `src/features/export.js`, `src/core/db.js`, and relevant tests.

**Observed compatibility risk to resolve:** in the public source inspected, `recordInteraction` in `index.js` receives a fourth `activePersona.id` argument, while `src/core/affinity.js` still defines `recordInteraction(userId, tz, now)` and looks up `affinity` by `user_id` alone; `/status` and prompt injection also call `getAffinity` without persona ID. The export code already refers to `persona_affinity`. Do not implement a shortcut that writes one table while the LLM, `/status`, or normal interactions read another. Audit the live checkout and establish ONE consistent canonical source of truth for per-persona affinity.

## UX — new universal public shortcut

Implement the same easy public interface as in the sister project:

- `/setaffinity` => inline five-choice picker, showing level 0, 1, 2, 3, and 4 for the **active persona**.
- `/setaffinity 0` through `/setaffinity 4` => instant persisted switch.
- `/setaffinity min` => level 0; `/setaffinity max` => level 4.
- Invalid integers, fractions, negative numbers, out-of-range input, or extra tokens => friendly usage message, no database change.
- `/status` => current persona, actual level, exact stored points, existing progress and daily stats; add a "Change affinity" inline button or a visible command hint.
- Register the new command as a public command in the current module/loader/menu system. **Never set `adminOnly: true` and never call `isGroupAdmin` for this command.**

Examples: while Jiang Cheng is selected, `/setaffinity 4` should immediately select Jiang Cheng level 4 for that user, and the next reply should remain authentic to his guarded, responsible personality—not default Level 4 romantic/dere behavior. Switching to Raka must show a separately maintained Raka level; switching back to Jiang Cheng must restore the previous Jiang Cheng level.

## Storage and migration integrity

Implement a reusable, deterministic service function (adapt signature to the codebase) such as `setAffinityLevel(userId, personaId, targetLevel, tz = 'Asia/Jakarta', now = Date.now())` with strict integer-level validation. Keep or provide compatible wrappers for current callers and tests, but do not silently ignore a passed `personaId`.

The **canonical key should be (`user_id`, `persona_id`)** for Jibun, whether implemented using the existing `persona_affinity` table or a safe additive migration if that table is absent. Select the active ID from `ctx.personaId`/`ctx.persona.id` resolved by existing middleware. Use prepared SQL queries and transactions; do not allow arbitrary user IDs or persona IDs supplied in Telegram commands to affect the target row. Do not delete the legacy `affinity` table or production records.

If migration is needed, discover the next unused migration number rather than hardcoding one. Backfill each old user score into **one** best-supported previous/default persona (e.g. the user's saved persona, with a validated fallback), not into every persona. Avoid duplicating a single legacy relationship across all personas. Make migrations idempotent on fresh and populated databases and document the mapping decision. Update existing export and delete-me functions to cover the canonical table, retaining privacy functionality.

Use point targets tied to the existing 0-4 thresholds, unless live thresholds have changed:

| Level | Stored target points |
| --- | ---: |
| 0 | 0 |
| 1 | 35 |
| 2 | 75 |
| 3 | 150 |
| 4 | 250 |

Persist computed `level` and `points` consistently, and set `last_chat_at = now` on a real manual change so stale inactivity decay does not immediately undo it. Manual changes do not earn natural XP and must **preserve** `last_gain_date` and `gained_today` (no loophole to bypass the 15/day daily interaction cap). Keep normal +2 interaction and seven-day decay functional, now scoped to the active persona. Ensure reading the level, injecting relationship guidance into the LLM prompt, and rendering `/status` all use the same persona-aware read. Do not rely on an LLM text instruction alone: the DB value must really change.

## Inline button security and privacy

Use grammY `InlineKeyboard` and the existing `callbacks` module registration. Short callback data should encode the **button owner ID**, **selected persona ID**, and **level**, within Telegram's 64-byte limit. Consider a short opaque session token if IDs exceed that limit. On every callback verify:

1. `ctx.from.id` matches the original menu owner.
2. The requested level is a valid integer in `[0,4]`.
3. The persona from the menu still matches the active persona; otherwise show a fresh-menu/expired message instead of mutating the wrong relationship.
4. Existing global access guards still apply.

For groups, one member must not be able to alter another member's affinity using their inline buttons, forwarded messages, or crafted callbacks. A non-admin must still be able to adjust their own. Be resilient to replay/duplicate callbacks and malformed payloads. Replies and buttons must be safe to render in Telegram without parse-mode injection.

## Jibun-specific appearance, localization, and characterization

**Never introduce Unicode emoji into Jibun's messages, button labels, status cards, or tests.** Keep the project's zero-Unicode-emoji policy and egress sanitation. Simple labels such as `[0] Stranger` / `[4] Deep Trust` are fine.

For its normal male personas (Raka, Rio, Nando, Kael, and custom), keep their existing language, individual personality, visual formatting, and affinity phrasing unchanged unless fixing the broken scope. For **Jiang Cheng (`jiang_cheng`)**, use its `affinityTitles` / `affinityInstructions` where available; preserve his deeper-trust dynamics rather than forcing generic dere/romcom instructions. If the requested English-only update is present, the entire new affinity command UI/confirmation/status for Jiang Cheng should be English (even when the user's settings or input are Indonesian); don't overwrite or revert English personality text. If that English conversion has not yet landed, do not silently rewrite all Jiang Cheng lore as part of this task—clearly report that independent pending requirement.

Before integrating Jiang Cheng, verify that the runtime registry (`src/personalities/index.js`) actually registers his ID; the inspected source has `jiang_cheng.js` but its registry did not show the import. If registration is still missing, fix the smallest wiring issue needed for this feature or clearly report it. Do not duplicate personas or change their stable IDs.

## Test plan (mandatory)

Add / update tests for:
- Every valid level, both min/max aliases, invalid input, correct persistent points and exact active-persona affinity read.
- Non-admin in DM and group can change **self**; admin is not required; no other user's data changes.
- Owner-only callback, forged callback, stale persona-selection callback, and duplicate callback.
- `user A + Jiang Cheng` versus `user A + Raka`, plus user B isolation.
- Compatibility of `recordInteraction`, `/status`, `buildSystemPrompt`, and the new shortcut: all refer to the same persona-specific record.
- Old DB migration/backfill, existing users, natural gains/daily cap/decay, and restart persistence.
- Jiang Cheng level 4 retaining his own instructions instead of generic romance, and English-only UI when that feature is active.
- Zero Unicode emoji in Jibun outputs; no regression to Raka/Rio/Nando/Kael/custom.
- `/export` includes per-persona affinity; `/deleteme` removes it; normal privacy and admin protections remain intact.
- `FEATURES` loading, `/help`, public Telegram command menu, and no accidental admin-only flag.

Use isolated test DBs, never the production `data/bot.db`. Run relevant test suites and, if possible, `npm test`. Update README, help, and any applicable privacy documentation.

## Delivery

Commit no changes unless requested; do NOT push/deploy. Report changed files, migrations and backfill behavior, actual test results, limitations, and command examples. Do not modify `jishin-bot` from this task.
