# Pattern Extraction: `app/questions.json`

Based on analysis of 93 prompts in the shipped set cross-referenced against 114 curation decisions (111 reviewed, 11 favorites, ~15 flagged for awkward phrasing, ~10 cut), the following patterns emerge. Curation feedback from the guidance document and per-prompt notes materially reshapes several sections.

---

## TONE

The tone is warm, invitational, and psychologically safe, but the curation reveals a further constraint: **the tone must never tip into devotional or therapeutic register**. Prompts that introduced silence ("Let the silence last fifteen seconds"), writing exercises ("Write one fear on a piece of paper"), or guided-prayer scaffolding were cut, with the note: "Avoid sounding like a devotional or therapy exercise." Even at the deepest levels, the tone stays conversational—the kind of question a trusted friend would ask at a kitchen table, not a counselor's office or a small-group leader's curriculum.

The successful tone lands between casual and reverent: light prompts are **genuinely fun** (not just "less deep"), honest prompts surface real tension without performing vulnerability, and deep prompts carry weight without melodrama. The curator's heuristic codifies this as a room-dynamics principle: "Fun opens the room. Uplifting warms it. Intense deepens it. Too many intense cards in a row hurts the room's tone."

## VOICE

The voice is second-person direct address, consistently using "you" and "your" to create intimacy and personal accountability. Sentence construction is overwhelmingly interrogative—nearly every prompt is a single question, and the curator enforced this as a hard rule: "cards should be pointed questions." Entries structured as sharing exercises or multi-step instructions ("Go around and share one word... Then pray one sentence...") were cut.

The surviving wildcards that use imperative voice ("Tell someone here...", "Name one person outside this room...") succeed because they direct attention toward a specific other person with a specific action—they function as pointed prompts with a relational vector, not open-ended facilitation scripts.

Contractions appear naturally ("What's", "you'll", "don't"), reinforcing conversational accessibility. No prompt exceeds one sentence, with the exception of two-sentence wildcards where the second sentence sharpens the first ("Say their name and one way you'll show up."). The voice avoids qualifiers and hedging; the curator flagged unnecessary additions like "not strength" in a wildcard as clutter.

## PERSONALITY

The projected personality is that of a spiritually mature friend—someone who has earned the right to ask hard questions by first creating safety. Critically, the curation reveals this personality has **theological commitments that constrain language**. The prompt "What's helped you feel most like yourself lately?" was cut with the note: "not theologically sound. 'feel like yourself'???" This signals that Spill's voice operates within a framework where identity is rooted in God's formation, not self-actualization. The approved alternative ("What has God been showing you about who you are?") grounds the same territory in theological soil.

The personality values:

- **Specificity over abstraction**: "What embarrassingly specific thing makes you feel seen?" over generic self-help framing. Prompts flagged as "too generic" ("Could belong to any prompt deck, not specifically Spill") were marked for revision or cut.
- **Embodied faith**: Questions consistently root spiritual concepts in lived, present-tense experience. Favorites cluster around concrete imagery: "What makes home feel restful instead of just busy?", "Who in this family is secretly great at something nobody talks about?"
- **Anti-performance posture**: Multiple prompts directly name the temptation to perform ("Where are you tempted to perform spiritually instead of being honest?"), and the curation process itself reinforces this—leading questions that presume an answer were flagged ("this is interesting, but a bit of a leading question").
- **Answerability as hospitality**: The personality serves the responder's ability to actually engage. The curator flagged "What part of your story do you want God to redeem, not erase?" as "interesting but this specific phrasing makes it a bit difficult to answer." The concept survives; the phrasing fails the speakability test.

## STYLE

The primary style constraint, emerging forcefully from curation, is **speakability**. Awkward phrasing was the single largest category of issues (15 of ~19 flagged problems). The test is: can someone read this card aloud to a group and have it land cleanly on first hearing? Prompts that sound natural when spoken survive. Prompts that require mental parsing or sound literary on paper but strange out loud get flagged.

### Style patterns from successful prompts:

- Questions average 10–15 words; the sweet spot is a single breath
- Plain vocabulary dominates—no theological jargon ("sanctification," "justification"), no insider shorthand
- Temporal grounding is frequent: "this week," "right now," "lately," "this season" anchor reflection in the present
- Concrete and sensory language preferred: "laugh until it hurt," "clear the air," "carrying alone"
- Parallel construction in two-part questions uses "and" or comma to create natural rhythm: "What about lifelong commitment feels beautiful, and what feels scary?"
- Leading questions are avoided; the prompt opens a door, it does not push the responder through it
- Repetition across prompts is flagged aggressively ("repeat! consolidate to a general category!")—each prompt must occupy unique conceptual territory

### Style patterns from failed prompts:

- Abstract spatial metaphors that don't map to real experience ("Where do you hide behind an image")
- Compound instructions masquerading as questions ("Read Romans 8:1 slowly. Sit in silence for twenty seconds, then share what you needed to hear.")
- Insider-cute phrasing that collapses under group use ("What area of surrender keeps coming back in your life with God?")
- Phrases that require the responder to hold too much framing ("What would it mean to be known by God before being approved by people?")

## STRUCTURE

The data follows a rigid taxonomic schema with six orthogonal dimensions:

1. **Audience** (5 values): `friends`, `dating`, `family`, `small-group`, `youth`
2. **Depth** (3 tiers): `light` → `honest` → `deep` — functioning as a graduated vulnerability ladder
3. **Mode** (2 types): `prompt` (personal question) vs. `wildcard` (directed group action)
4. **Category** (10 values): `gratitude`, `scripture`, `identity`, `relationship`, `struggle`, `prayer`, `mission`, `church` and others
5. **Tags**: Freeform semantic labels for cross-cutting retrieval (e.g., `joy`, `healing`, `discipleship`)
6. **ID**: Namespaced as `{audience}-{depth}-{NN}` for prompts and `wildcard-{NN}` for wildcards

Distribution per audience follows a consistent ratio: ~7–8 light, ~5–6 honest, ~5–6 deep prompts, plus audience-specific wildcards. The pyramid shape (more light than deep) is intentional—lighter entry points outnumber deeper ones, reflecting the heuristic that safety precedes depth.

The curation layer adds a parallel evaluation structure with its own dimensions:

- **Status**: `keep`, `revise`, `cut`, `unreviewed`
- **Signals**: `fun`, `uplifting`, `intense` (energy descriptors, not quality scores)
- **Issues**: `awkward-phrasing`, `too-generic`, `great-example`
- **Notes**: Freeform curator commentary

## LENGTH

Individual prompt text ranges from 7 words to approximately 20 words. The median sits near 12 words. Wildcard entries trend slightly longer due to their instructional compound structure, but the curator's cuts suggest a hard ceiling: two sentences maximum, and the second sentence must add directional specificity, not additional activity ("Say their name and one way you'll show up" passes; "Sit in silence for twenty seconds, then share" does not). Brevity enforces immediacy and reduces cognitive load at the moment of group use. A prompt should be graspable in a single reading aloud.

## QUALITY HEURISTICS (from curation)

The guidance document and per-prompt notes reveal an explicit quality framework:

1. **Speakability over cleverness**: The single most important test. Would this sound natural read aloud by a 22-year-old to their small group? By a parent to their teenager at dinner?
2. **Theological soundness**: Language must be compatible with a framework where identity, healing, and growth are grounded in God's work, not self-discovery. Therapeutic and self-help framings are rejected.
3. **Answerability**: A prompt that is "interesting but difficult to answer" fails. The responder should immediately know what's being asked and be able to begin forming a response.
4. **Non-leading**: Questions open territory without presupposing the answer or embedding judgment. ("Where does your need for clarity become control?" was flagged as leading.)
5. **Spill-specific voice**: Prompts must not be interchangeable with a generic conversation card deck. They should feel native to this product's theological and relational posture.
6. **Room-aware sequencing**: Prompts are not evaluated in isolation but for their effect on group energy. The `fun`/`uplifting`/`intense` signal taxonomy enables session design that modulates emotional temperature.

## DISTINCTIVE FEATURES

- **No answers, only questions**: The dataset contains zero didactic content. This positions the product as a conversation catalyst, not a content delivery mechanism.
- **Anti-exercise stance**: The strongest curatorial pattern is the rejection of contemplative exercises, writing prompts, silence directives, and multi-step facilitation. Spill cards are questions, not activities. The surviving wildcards that use imperative voice succeed precisely because they direct one person's attention toward another person—they are relational actions, not spiritual disciplines.
- **Favorites cluster around concrete imagery and relational specificity**: The 11 favorited prompts share a pattern—they name a recognizable human moment ("laugh until it hurt," "quietly carrying," "secretly great at something") or pose a question with real-world stakes ("What does forgiveness cost in a family?"). Abstract or theological-concept-first prompts were never favorited.
- **Cross-audience wildcards** (e.g., `wildcard-02`, `wildcard-16`) target all five audiences simultaneously, serving as universal connectors, but they were also disproportionately flagged for revision—universality creates pressure toward generic phrasing.
- **Curation is subtractive**: The shipped `questions.json` (93 entries) already reflects significant pruning from a larger candidate set (wildcards jump from 01 to 22 with 10 cut). The curation posture is to cut aggressively rather than revise generously.
