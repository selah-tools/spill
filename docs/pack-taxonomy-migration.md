# Pack taxonomy migration plan

## Core convictions

Spill now treats its pack model as theology-shaped product design, not neutral audience segmentation.

This migration is not only about pack names. It also changes how question wording should imply relationship: clearer lived settings, clearer relational scope, and less leftover program-language from `friends`, `family`, and `small-group`.

1. **The Church is a spiritual family under Christ.**
   Spill should help believers relate to one another as first-order relationships marked by shared life, encouragement, repair, sacrifice, and sanctification.
2. **Dating questions must not lead people into temptation.**
   Dating content should emphasize discernment, clarity, character, obedience, tenderness, and purity.
3. **Pack names should reflect lived settings, not secular social categories.**
   `friends`, `family`, and `small-group` blurred together. `fellowship` and `household` clarify the difference between shared church life and shared home life.

## New pack taxonomy

- `fellowship` — life together with brothers and sisters in Christ
- `household` — the daily life of a home under one roof
- `dating` — discernment, purity, tenderness, and clarity
- `engaged` — covenant preparation, roles, finances, faith, and future married life
- `marriage` — present-tense covenant life between spouses
- `youth` — age-aware formation for students and leaders

## Audience migration rules

| Old audience  | New audience |
| ------------- | ------------ |
| `friends`     | `fellowship` |
| `small-group` | `fellowship` |
| `family`      | `household`  |
| `dating`      | `dating`     |
| `engaged`     | `engaged`    |
| `youth`       | `youth`      |

## Implementation notes

### Question IDs are renamed in the active dataset

The active question IDs now match the new pack taxonomy.

Examples:

- `friends-light-01` -> `fellowship-light-01`
- `small-group-light-01` -> `fellowship-light-39`
- `family-light-01` -> `household-light-01`

Because canonical IDs are `{question-id}-{hash}`, this taxonomy cutover resets canonical feedback continuity for the renamed cards. The archived dataset preserves the old IDs intact for reference.

A small number of question texts were also revised for purity and taxonomy clarity. Those cards likewise get new content-hash suffixes.

### Archived original dataset

The original pre-migration dataset is preserved at:

- `app/archives/questions-pre-pack-taxonomy-2026-04-17.json`

This keeps the old `friends`, `family`, and `small-group` source data intact without requiring broad runtime support for retired audience names.

### Build / sync guardrail

`scripts/sync-questions.mjs` now treats retired audience names as a stop condition. If KV still contains `friends`, `small-group`, or `family`, the script skips writing and keeps the bundled `questions.json` unchanged.

### Wording rule learned during migration

Questions should name their relational scope as clearly and concisely as possible.

But clearer does not mean more explanatory. A rewrite is a regression if it becomes more explicit while also becoming less natural, less speakable, or narrower than the original intent.

Prefer:

- `someone here`
- `people here`
- `everyone here`
- `the people in your life`
- `in this home`

Be cautious with vaguer placeholders like:

- `here` by itself
- `around you`
- `community`
- `group`

At the same time, not every broad phrase needs to be rewritten. Natural idioms like `church life`, `at church`, `outside of church`, and `at home` often already carry enough lived meaning.

Room-targeted language is often strong for light prompts and wildcards. But for honest/deep prompts, a rewrite must not make the people currently present feel like the implied problem. That means:

- good: explicit room scope that invites appreciation, openness, or action
- risky: honest/deep wording that turns a situational question into a live interpersonal accusation

Example of bad shifts:

- from: `What makes it hardest to be fully honest in a group setting?`
- to: `What makes it hardest to be fully honest with people here?`

- from: `What part of church life feels most exhausting right now?`
- to: `What part of being involved at church feels most exhausting right now?`

- from: `What's the kindest thing someone at church has done for you?`
- to: `What's the kindest thing someone in your church has done for you?`

## Content rules by pack

### Fellowship

- shared life in the church
- encouragement, confession, prayer, hospitality, presence, bearing burdens
- warm enough for a living room, clear enough for a group, strong enough for real discipleship

### Household

- rhythms of home life
- parents, siblings, family memory, repair, table conversation, discipleship in daily life

### Dating

- no wording that assumes sexual activity
- no flirtation-forward prompts that could needlessly inflame desire
- prefer questions about character, clarity, obedience, boundaries, trust, and discernment

### Engaged

- future-oriented marital prep is appropriate
- future marital intimacy may be discussed in ways consistent with Christian conviction
- do not normalize present sexual activity before marriage

### Marriage

- spouse-to-spouse covenant life in the present tense
- tenderness, repair, prayer, stewardship, intimacy, and shared faith over time
- distinct from `engaged` prep and distinct from broader `household` home dynamics
- should not read like a generic relationship deck or a counseling worksheet

## Completed in this refactor

- replaced `friends` + `small-group` with `fellowship`
- replaced `family` with `household`
- added `marriage` as a distinct pack for spouse-specific covenant life
- updated audience options, labels, and blurbs in the UI
- updated bundled questions to the new audiences
- renamed active question IDs to match the new pack taxonomy
- archived the original pre-migration dataset intact
- added a build-time guardrail so retired audience names do not overwrite the active dataset
- revised About modal copy to reflect the spiritual-family philosophy
- tightened several dating prompts to avoid temptation-adjacent wording

## Follow-up audit

A later pass should review all `fellowship` and `household` questions for wording that still sounds like leftover pack taxonomy instead of clear lived settings. The goal is not maximum church jargon. The goal is natural, speakable wording with explicit relational scope.
