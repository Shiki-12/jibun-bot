# MASTER PROMPT FOR CODEX / ANTIGRAVITY
## Jibun Bot — Global English-Only Conversion + Runtime Repair

### Project and mission

Work **directly** in the CURRENT LOCAL working tree for my Telegram bot **Jibun Bot**, not a stale public GitHub snapshot:

- Local workspace previously used: `C:\laragon\www\telegram-ai-botml`
- Repository: `https://github.com/Shiki-12/jibun-bot`
- Runtime: Node.js Telegram bot (`npm start` -> `node src/index.js`)
- Observed bot account: `@jiang21_bot`

**Goal:** Convert **all user-facing bot-generated content in Jibun Bot** to natural, consistent English across **every personality and every feature**, and fix the SQLite background-memory runtime error shown below. The bot must not generate Indonesian dialogue or Indonesian stage directions even when the user speaks Indonesian.

This is a **global English-only policy for Jibun Bot**; we no longer want special `jiang_cheng`-only English behavior. **Do not edit the separate Jishin Bot repository.**

### Evidence and important constraints

Actual Telegram outputs observed:

1. Jiang Cheng spoke English but inserted Indonesian stage directions: `*Suara dingin, nada praktis*` and earlier `*Mengangkat alis sedikit, pandangan tajam*`.
2. The newer `/status` card already appeared in English: `Relationship & Affinity Status`, `Level: 0 — Stranger`, `Total Points`, `Level Progress`, `Points Today`.
3. Terminal printed: `Error background memory tasks: no such column: "jiang_cheng" - should this be a string literal in single-quotes?`
4. Terminal startup printed `personality "tsundere"` although per-user chat displayed Jiang Cheng. Distinguish configured *default* personality from effective *user-selected* personality before classifying this as a bug.
5. A coding agent reported 483/483 passing tests, yet the SQL error occurred at runtime. Passing unit tests therefore do NOT prove this request is complete.
6. The screenshots may precede the latest source modifications / restart. Verify effective runtime version and process state before deciding any particular patch failed.

### Non-negotiable rules

- Preserve EVERY existing feature, command, permission rule, database record, affinity score, user memory, schedule, timer, expense, note, and user-created content.
- Do **not** wipe the database, reset affinity, delete memories, erase chats, drop tables, or silently migrate content by translating it.
- Preserve the different personalities' identities, lore, personalities, relationships, and speech styles; change **language**, not their essential characterization. Jiang Cheng must remain Jiang Cheng, Raka must remain Raka, etc.
- Preserve command names (`/status`, `/persona`, etc.), callback payloads, JSON field names, database identifiers, placeholders (for example `{time}`, `{count}`), URLs, file paths, action tags, tool-call syntax, and machine-readable tokens exactly as required by the code.
- Preserve user-provided text exactly: names, quoted passages, memories, notes, expense descriptions, task titles, calendar data, content to translate, and data returned by external tools. Translate the **surrounding UI** to English; never corrupt the underlying data.
- A translation feature must still produce the user's explicitly requested **target language**; the UI, explanation, and metadata surrounding the translated text must be English.
- Preserve safety handling, consent checks, privacy policies, and existing Telegram access restrictions.
- Maintain the existing no-Unicode-emoji rule (where the project enforces it) and do not introduce new emoji characters.
- Use idiomatic English, not awkward direct translations. Preserve character-specific tone.
- No push, deployment, remote database modification, or changing live Telegram state without permission. Do not disclose `.env`, tokens, chat contents, or private keys in logs or reports.

---

## Phase 1 — Inspect and inventory first

1. Inspect `git status`, the actual local tree, `package.json`, runtime config, `.env` **key names only** (never print values), feature registry, personality registry, i18n/language settings, and tests.
2. Inspect at minimum: `src/index.js`, `src/personalities/`, `src/core/actions.js`, `src/core/affinity.js`, `src/core/facts.js` (if present), `src/features/affinity.js`, `src/features/core.js`, `src/features/persona.js`, `src/features/settings.js`, and the feature implementations for memories, reminders, schedules, proactive messages, notes, todo, timer, habits, games, weather, translator, vision, voice, expenses, export, and errors.
3. Build a **complete map** of user-facing text, both static and dynamic: command responses, `strings` maps, inline keyboard labels, `/start`, `/help`, `/status`, notifications, AI wrapper prompts, action confirmations, permission errors, fallback messages, captions, button text, background jobs, memory summarization prompts, LLM tool descriptions, and TTS strings.
4. Search for Indonesian literals and phrases throughout `src/` and test fixtures. Do not simply grep for a small list of words: check each feature. Exclude raw user content, intentional language examples in tests, external data, and non-user-facing developer comments.
5. Find all places where an `en`/`id` or `isEn` branch applies only to Jiang Cheng, and determine how to replace those with a **single global English policy** without breaking architecture.
6. Identify how current chat history and stored memory are added to LLM prompts. Historical Indonesian assistant turns can contaminate subsequent output and should be treated as **historical context**, not instructions about language.

## Phase 2 — Convert entire bot to English

1. Make **English the single authoritative output language** of Jibun Bot, independent of `user.lang`, global language settings, chat locale, detected input language, active persona, or user text.
2. Rewrite all built-in personality **system prompts, bios, lore, greetings, verbal mannerisms, affinity titles/instructions, and `strings`** into English, including every nested object and function-generated string. Preserve original concepts and personality differentiation, never genericize all personalities into the same English voice.
3. Rewrite user-facing text across **all features and shared modules**, not just personality files or `/status`.
4. Update or retire language selectors carefully. If an existing `/language` or language setting remains for backward compatibility, explain in its UI that English is the bot's output language and do not falsely imply that selecting Indonesian will change bot responses. Preserve configuration and backward-compatible stored values where needed.
5. Use a shared English string catalog/helper where justified, but avoid an unnecessary wholesale framework rewrite. Ensure future features have a documented English-language default.
6. Ensure *every generated character stage direction* is also English. An output such as `*Suara dingin, nada praktis*` is a FAIL even when the following spoken sentence is English. Stage directions should be optional, brief, third-person or consistently styled according to the selected persona, and never forced into every reply.
7. Make the instruction unambiguous at the point the final LLM prompt is assembled, including after memories, conversation history, affinity rules, tool/action rules, and system context. **All newly generated output must be English**, with narrow exceptions for names, exact quoted user content, and user-requested translation output. Do not allow old Indonesian assistant turns to act as style examples.
8. Do not rely on brittle postprocessing (e.g., regex removing Indonesian words) as the primary solution. Such postprocessing can damage proper nouns, data, and tool commands. Prefer correctly designed prompt hierarchy and original English templates; if retry/validation is added, it must be bounded and preserve machine-readable tool syntax.
9. Keep user input language flexible: Indonesian input is understood, English output is produced. A user explicitly asking for a Japanese translation should receive Japanese **translation content** with English surrounding explanation.
10. Make generated reminder bodies, scheduled/proactive content, system notifications, TTS and speech-to-text confirmations, multimodal descriptions, and fallback/exception replies follow the same global rule.

## Phase 3 — Fix SQLite background memory crash (mandatory, separately verifiable)

Investigate the *actual call path* that prints:

`Error background memory tasks: no such column: "jiang_cheng" - should this be a string literal in single-quotes?`

1. Find the offending SQL statement and the source of the `jiang_cheng` value (likely a personality ID passed into a SQL expression). Verify with a reproducible temporary SQLite fixture or safe local reproduction; do not guess the exact file.
2. Do **not** interpolate a personality ID as a double-quoted SQL identifier (`"jiang_cheng"`) or concatenate raw user input into SQL. Use bind parameters and safely prepared statements, e.g. `WHERE persona_id = ?` with `stmt.get(personaId)` as appropriate to the actual schema.
3. Review relevant queries throughout facts, memory summarization, retrieval, and persona-specific storage for the same issue. Confirm whether the target table actually has `persona_id`; if it does not, handle schema migration properly and preserve existing records with a backup and tested migration.
4. Check affinity/memory isolation between users and personas. Never accidentally expose or update another user's memories.
5. Add a regression test that reproduces the exact `jiang_cheng` identifier failure and proves the **background memory task** now succeeds, not merely that the SQL parses in isolation.
6. Test against a temporary copy/in-memory DB or anonymized fixture. Do not destructively rewrite the real user database.
7. Catch and log failures safely without repeatedly crashing workers, and do not hide persistent DB errors behind success messages.

## Phase 4 — Verify the actual running bot, not just source files

1. Identify whether `npm start`, PM2, another scheduler, or a different Node process currently owns polling for `@jiang21_bot`. Avoid running multiple polling clients against the same bot token.
2. Check the entrypoint and environment actually used by the live process. If the live process is still on the old version, explain the need to restart; do not report successful runtime verification based only on tests or `git diff`.
3. If the process is stopped, do not claim the running bot is already fixed. Provide safe Windows PowerShell/CMD commands to start the local bot after changes (without exposing secrets).
4. If you are authorized and can safely run the local app without interfering with another polling process, perform a short smoke test; otherwise report exactly what was not tested.
5. Differentiate global/default `tsundere` startup identity from user-specific active Jiang Cheng selection. Verify both paths rather than assuming a mismatch is a bug.
6. Verify that previously stored Indonesian chat history does not cause newly generated responses to drift into Indonesian. **Do not delete history as a fix.**

## Phase 5 — Regression tests and acceptance matrix

Add tests **beyond text snapshots**, including realistic feature flows. Ensure meaningful failures on Indonesian leakage in bot-authored output and on runtime SQL failures.

Mandatory cases:

A. `/start`, `/help`, `/status`, `/settings`, `/persona`, and inline buttons produce English for **every personality**.

B. For each persona, send the Indonesian message `Kamu lagi ngapain?` and expect an English-language response preserving that character's voice.

C. Jiang Cheng receives `do ya wanna know more about me?` and does **not** emit `*Suara dingin, nada praktis*`, `*Mengangkat alis sedikit*`, or any other Indonesian narration. Both dialogue and any stage directions must be English.

D. Indonesian user message `Aku sedih banget` receives English emotional support that fits the selected personality.

E. `/status` includes English headings, level titles, progress units, and an English caption/quote. Verify correct values remain unchanged.

F. Reminders, scheduled messages, proactive messages, background summaries, errors, help, callbacks, and TTS responses are English. User-authored titles and quoted text remain unchanged.

G. Translator generates a requested non-English target correctly, with English UI text.

H. 2 users with different active personalities have independent memories/affinity with no cross-user leakage.

I. A background-memory task with `personaId = 'jiang_cheng'` completes with no `no such column` error, and stored facts can be retrieved after restart.

J. Test historical messages with Indonesian assistant turns in conversation context: new outputs still English.

K. Validate placeholder preservation, Markdown/HTML Telegram escaping, callback IDs, tool/action tags, and no unexpected emoji.

L. Run specific tests and the full `node --test` suite. Report exact numbers; do not claim 100% language compliance based on green unit tests alone.

For optional live integration testing against the configured model, use the minimum needed calls, keep credentials confidential, and clearly disclose what was or was not run. Never send real private user history into test fixtures or reports.

## Phase 6 — Final deliverables

1. Make the code changes; do not stop at a plan.
2. Update README/help documentation: Jibun Bot is **globally English-only**, accepts input in any language, and only user-requested translation payloads may use other languages.
3. Provide a concise report with: modified files, important implementation choices, root cause of SQL error, database migration details (if any), exact test results, proof of language coverage, whether the live process was restarted/actually verified, and remaining risks.
4. Explicitly say if any user-facing Indonesian text remains and why. Keep a short checklist of any unverified runtime behavior.
5. **Do not deploy, push, modify another repository, or delete/translate user data without my permission.**

### Definition of DONE

**Not done:** “All tests pass,” but Telegram still returns Indonesian actions or background memory crashes.

**Done only when:** the current local Jibun Bot implementation uses English for all newly authored UI/LLM content across all personas and features, existing user content is preserved, the background SQL failure is fixed and regression-tested, and the live runtime verification status is reported accurately.
