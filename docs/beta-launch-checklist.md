# Spill beta launch checklist

_Last updated: 2026-04-17_

## Decision

**Spill is ready for a soft beta now.**

**Spill is not ready for a broad public launch yet.**

That is the launch decision.

The product is operationally stable enough to put in front of a small invited cohort, but it does not yet have the market proof, messaging confidence, or feedback baseline needed for a larger launch push.

## What counts as each launch stage

### Soft beta

A soft beta means:

- invite-only or quietly shared
- no paid acquisition
- no large public post intended to drive broad traffic
- goal is learning, not scale
- success is measured by usage quality and repeated engagement, not reach

### Public launch

A public launch means:

- broad public sharing
- launch copy on X / product communities / personal network is intentional and repeatable
- the app has enough signal that new users are likely to understand the value quickly
- the team is ready to defend the product promise with evidence, not just intuition

## Current verdict by gate

| Gate                                         |   Soft beta | Public launch | Current status               |
| -------------------------------------------- | ----------: | ------------: | ---------------------------- |
| Production app is live and working           |    required |      required | pass                         |
| CI / quality / release automation are green  |    required |      required | pass                         |
| Admin curator flow works in production       |    required |      required | pass                         |
| Question source KV is seeded and publishable |    required |      required | pass                         |
| Feedback writes are flowing                  |    required |      required | likely pass, but still early |
| Fresh feedback baseline exists               |     monitor |      required | not yet                      |
| Clear one-line positioning exists            | recommended |      required | not locked                   |
| Clear target user + use case exists          | recommended |      required | partial                      |
| Evidence of “people want this” from real use |    optional |      required | not yet                      |
| Launch assets / narrative are ready          |    optional |      required | not yet                      |

## Hard checklist for soft beta

A soft beta is a **go** when all of these are true:

### Product and ops

- [x] Production deploy is healthy
- [x] `pnpm quality` passes locally and Quality CI is green
- [x] Release Plan workflow can create a release PR
- [x] Admin-authenticated curator flow works in production
- [x] Question source KV has been re-seeded
- [x] `/api/questions-source` publish now triggers redeploy successfully
- [x] API responses include `X-Request-Id`
- [x] Feedback counters can be written to KV

### Launch hygiene

- [ ] Pick the exact beta cohort size and source
- [ ] Write one short invite message
- [ ] Define where beta users should send feedback
- [ ] Decide the review cadence for the first week

### Success criteria for the beta period

- [ ] At least 10 real people use it
- [ ] At least 3 people voluntarily share a strong positive reaction
- [ ] At least 1 clear repeated use case emerges
- [ ] Feedback explorer shows enough signal to rank obvious winners / losers

## Hard checklist for public launch

A public launch is a **no-go** until all of these are true:

### Marketability gate

- [ ] We can describe Spill in one sentence without explanation debt
- [ ] We know exactly who it is for first
- [ ] We can explain why this is better than a generic list of conversation prompts
- [ ] We have proof from beta usage that people actually want more of it
- [ ] We have at least one concrete story, quote, or example of impact

### Product gate

- [ ] Feedback baseline is populated enough to identify top questions and weak questions
- [ ] The first-run experience feels polished enough to survive broad sharing
- [ ] No known launch-blocking bugs remain in the core flow
- [ ] Core feedback loop is visible: open app → get question → react → come back

### Launch asset gate

- [ ] Landing copy / post copy is drafted
- [ ] A short demo flow or screenshots exist
- [ ] The CTA is clear: what should a new person do right away?
- [ ] The ask is clear: try it, share it, or give feedback

## Marketability gate definition

Before a broad launch, Spill must pass this test:

### 1. Promise

A new person should understand the value in under 10 seconds.

Current working promise:

> Spill gives you better conversation questions for friends, dating, family, and small groups.

That is serviceable for beta, but not yet sharp enough for a broad launch. It explains the surface area, not the emotional payoff.

### 2. Specificity

We should be able to answer all three cleanly:

- Who is this for first?
- When do they reach for it?
- What happens after they use it that feels better than before?

Right now, Spill covers several audiences well, but that breadth weakens the launch story. For public launch, pick a primary wedge.

### 3. Proof

We need real evidence, not theory:

- repeated use from beta users
- clear favorite prompts or audiences
- qualitative feedback that sounds like “this helped us actually talk”

### 4. Repeatability

Someone who likes it should be able to recommend it in one sentence.

If they cannot, the product may still be good, but the marketability gate has not been passed.

## Recommended launch posture now

### Do now

- **Start soft beta immediately** with a small invited group
- Keep the ask simple: try Spill in a real conversation and send reactions / screenshots / favorite questions
- Focus on learning which audience wedge has the strongest pull

### Do not do yet

- Do not do a broad public launch
- Do not spend on acquisition
- Do not position the product as proven or fully market-fit yet

## Suggested beta cohort

Start with **10–25 people** drawn from:

- close friends
- dating / relationship users who will actually use it
- one or two small-group leaders
- one or two family-oriented testers

This is enough to create signal without pretending the product is ready for scale.

## Suggested invite message

> I’m testing Spill, a simple app for better conversation questions. If you try it in a real conversation and tell me what felt good, awkward, boring, or unexpectedly helpful, that would be genuinely useful.

## First-week review cadence

Review once per day for 7 days:

- total feedback events
- upvotes vs downvotes
- downvote reasons
- most-used audience/depth combinations
- qualitative comments from testers

## Concrete next actions from this decision

1. **Run soft beta now** with an invited cohort
2. **Let feedback baseline build** before trying to optimize content too aggressively
3. **Use the first real usage data to choose the primary launch wedge**
4. **Only plan a broader launch after the marketability gate is passed**

## Mapping to the board

- `#283 Rebuild feedback baseline after KV reset` → required for public launch, passive during beta
- `#286 Decide beta launch checklist and marketability gate` → completed by this document

## Bottom line

**Go for soft beta.**

**No-go for broad public launch until there is real proof, sharper positioning, and a visible feedback baseline.**
