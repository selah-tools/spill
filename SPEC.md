# Product Spec: Spill MVP — Christian Conversation Question Generator

## Overview

The MVP is a browser-based Christian conversation topic generator built with ArrowJS.[cite:2] Its job is to let a user select a social context and conversation depth, then instantly receive a high-quality question or wildcard card designed from a Christian worldview.[cite:3]

**The product is called Spill.** Domain: spill.cards

The MVP is intentionally narrower than a party game. It validates the question engine before adding multiplayer rooms, voting rounds, or synchronized play.[cite:87][cite:83]

## Goals

### Primary goals

- Generate one useful Christian conversation question in under 5 seconds.
- Support multiple contexts, such as friends, dating, family, small group, and youth.
- Support multiple depths, such as light, honest, and deep.
- Include wildcard experiences like prayer, encouragement, testimony, and scripture reflection.[cite:3]
- Capture lightweight feedback signals so ranking can improve over time.[cite:95][cite:101]

### Non-goals

- No realtime rooms.
- No user accounts.
- No persistent multiplayer state.
- No autonomous question generation from an ML model in v1.
- No moderation dashboard.
- No native app.

## User stories

- As a user, I can choose a context so questions feel suited to my setting.
- As a user, I can choose a depth so the app does not jump from shallow to intense too fast.
- As a user, I can tap Generate and immediately see one question.
- As a user, I can tap Next to get another option.
- As a user, I can tap Wildcard to get a different kind of question card.[cite:3]
- As a user, I can upvote or downvote a question so the system learns what works.[cite:95]
- As a user, I can copy or share a question with someone else.

## Core UX

### Main flow

1. User lands on spill.cards.
2. User selects context.
3. User selects depth.
4. User taps Generate.
5. App shows a question card.
6. User can choose Next, Wildcard, Copy, Share, Upvote, or Downvote.

### Default contexts

- Friends
- Dating
- Small group
- Family
- Youth group

### Default depths

- Light
- Honest
- Deep

### Default wildcard types

- Prayer
- Encouragement
- Testimony
- Scripture reflection

## Content design

The app should use a curated question library, not model-generated live questions, for v1.[cite:95][cite:101] The inspiration product uses a progression system across levels with wildcards, so the MVP should mirror that structural wisdom while using original question writing and original categorization.[cite:3]

### Question schema

```ts
type Question = {
  id: string
  audience: ('friends' | 'dating' | 'small-group' | 'family' | 'youth')[]
  depth: 'light' | 'honest' | 'deep'
  mode: 'prompt' | 'wildcard'
  category:
    | 'identity'
    | 'prayer'
    | 'scripture'
    | 'church'
    | 'mission'
    | 'struggle'
    | 'gratitude'
  text: string
  tags: string[]
  active: boolean
}
```

### Seed content recommendation

- 80 to 120 questions.
- 15 to 20 wildcard questions.
- 6 to 8 categories.
- Balanced representation across contexts and depths.

### Example question directions

- Light: "What is one way you have seen God's kindness this week?"
- Honest: "Where are you tempted to perform spiritually instead of being honest with God?"
- Deep: "What area of obedience feels costly right now, and why?"
- Wildcard prayer: "Pause and ask: what does someone here need prayer for today?"

### Spill Packs (future)

The content should be organized into themed collections:

- **Spill Pack: Friends** — casual but meaningful
- **Spill Pack: Dating** — couples and connection
- **Spill Pack: Small Groups** — leader-friendly, structured
- **Spill Pack: Late Night** — deeper, slower
- **Spill Pack: Wildcards** — prayer, testimony, scripture

## Frontend architecture

ArrowJS fits the MVP because it offers a small reactive model centered on `reactive`, `html`, and `component`, and can be used without the heavier overhead of a larger framework stack.[cite:2] That makes it suitable for a tiny web app where the main state is filters, current question, and feedback events.[cite:2]

### Proposed file tree

```text
app/
  index.html
  styles.css
  app.ts
  state.ts
  questions.ts
  generator.ts
  analytics.ts
  components/
    Header.ts
    FilterBar.ts
    QuestionCard.ts
    FeedbackBar.ts
```

### Styling approach

For the MVP, prefer **plain CSS with CSS variables** over UnoCSS.[cite:87] The app is small, the visual identity matters, and the main UI surfaces are limited to layout, filter chips, buttons, and question cards. A simple handcrafted stylesheet keeps the brand distinct without adding utility-framework overhead.

#### UnoCSS alternatives considered

- **Tailwind CSS** — strongest ecosystem and fastest utility-first fallback.
- **Twind** — lightweight runtime Tailwind-style option for very small apps.
- **Panda CSS** — good if the project later wants generated utilities plus design tokens.
- **vanilla-extract** — good if the codebase grows and wants typed styling in TypeScript.
- **CSS Modules** — useful if the component count grows and scoped styles become necessary.
- **Plain CSS + CSS variables** — recommended for v1.

#### Recommendation

Use a single `styles.css` file with a small design-token layer and semantic component classes.

```css
:root {
  --color-bg: #fffbeb;
  --color-surface: #ffffff;
  --color-text: #1f2937;
  --color-primary: #d97706;
  --color-secondary: #0d9488;
  --radius-card: 24px;
  --shadow-card: 0 24px 60px rgba(31, 41, 55, 0.12);
}
```

Suggested class pattern:

- `.button`
- `.button--primary`
- `.button--ghost`
- `.pill`
- `.filter-chip`
- `.card`
- `.question-card`
- `.feedback-bar`

This gives Spill a more branded, editorial feel than an MVP built from raw utility classes. If implementation speed becomes more important than bespoke styling, **Tailwind CSS** is the best second choice. If the app grows into a more formal tokenized design system, **Panda CSS** is the best longer-term upgrade path.

### State shape

```ts
const state = reactive({
  context: 'friends',
  depth: 'light',
  mode: 'prompt',
  currentQuestionId: null,
  recentQuestionIds: [],
  history: [],
  loading: false,
})
```

### Selection logic

- Filter questions by selected context.
- Filter questions by selected depth.
- If mode is wildcard, restrict to wildcard questions.
- Exclude the last 3 to 5 served questions.
- Select randomly at first.
- Log the impression and actions.

## Data and analytics

The MVP can launch with static JSON content and a very small analytics endpoint or event sink.[cite:87] Feedback data should be collected even before any ranking model is introduced because those signals are what later enable better selection.[cite:95][cite:101]

### Event types

- `question_viewed`
- `question_upvoted`
- `question_downvoted`
- `question_copied`
- `question_shared`
- `wildcard_opened`
- `new_question_requested`

### Minimal event payload

```ts
type QuestionEvent = {
  questionId: string
  context: string
  depth: string
  mode: string
  eventType: string
  createdAt: string
}
```

## ML roadmap

The product should not begin with a question-generation model.[cite:95][cite:101] Upvote/downvote feedback is better suited to a contextual-bandit or reranking system that learns which existing question works best in which context, because bandit systems observe context, pick one action, and get reward feedback only for the chosen item.[cite:95][cite:101]

### ML phases

| Phase | System                                 | Why                                                                    |
| ----- | -------------------------------------- | ---------------------------------------------------------------------- |
| 1     | Random selection over curated library  | Fastest path to validate content                                       |
| 2     | Rule-based weighting                   | Suppress repeats, favor high-performing questions                      |
| 3     | Contextual bandit reranker             | Learn question-context fit from votes and actions [cite:95][cite:101]  |
| 4     | Offline LLM drafting with human review | Expand library safely without live auto-generation [cite:94][cite:100] |

### Why not RL generation first

- Too much complexity for MVP.[cite:94]
- Sparse feedback is weak supervision for safe question generation.[cite:94][cite:100].
- Christian-worldview alignment should remain editorially protected in early versions.[cite:3]

## Backend

The MVP backend should be optional and minimal.[cite:87] A static site is enough for generation, and a tiny API can be added only if event logging is required.[cite:87]

### Recommended deployment

- Static frontend deployed as a simple web app at spill.cards.
- Question data bundled locally as JSON or TypeScript module.
- Optional lightweight endpoint for analytics ingestion.
- No database required for initial release.

### When to add a database

Add a database only when one of these becomes true:

- Question feedback volume is high enough to warrant ranking.
- Churches or hosts want shared question sessions.
- Custom question packs or admin editing becomes necessary.

## Design direction

The interface should feel calm, thoughtful, and modern rather than loud or gamey. The experience should communicate warmth, trust, and depth, with quick use at the center.[cite:3]

**Spill brand keywords:** Fluid, warm, honest, casual, modern, slightly edgy but safe.

### UI principles

- One primary action on screen.
- Very short path to first value.
- Clear contrast between filters and question card.
- No clutter, scoreboards, or distracting visual gimmicks.
- Mobile-first layout.
- Visual language suggests fluidity (spilling, flowing, dealing cards).

## Future path to game

This MVP becomes the content engine for a future social game.[cite:83][cite:87] Once the question system is validated, the same library can power shared-screen sessions, anonymous answer submission, reveal flows, and eventually a Jackbox-style room experience.[cite:83]

### Expansion sequence

1. Solo/shared question generator at spill.cards.
2. Host link that generates a shared question for a group.
3. Room codes and synchronized question display.
4. Anonymous response collection.
5. Voting, reveals, and themed rounds.

## Open questions

- Which initial context is the most important to nail: friends, dating, or small group?
- How explicitly scriptural should default questions be?
- Should wildcard cards be rare surprises or a visible separate mode?
- Is the product brand playful, pastoral, or minimal? (Leaning: playful but grounded)
- Should Phase 1 sharing produce just text, or a styled share card?

---

_Brand: Spill (spill.cards)_
_Core phrase: "Spill it."_
