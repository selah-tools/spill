# Spill Design Direction

## Design Context

### Users

Spill is for Christians who want to move from small talk into honest, faith-shaped conversation with as little friction as possible. The primary use cases are:

- friends hanging out
- dating or engaged couples
- small groups
- families
- youth groups

The job to be done is simple: open the site, choose a context and depth, and get a prompt that helps people say something real.

The interface should feel usable within seconds in a live social setting. It is not a content-heavy app, a church admin tool, or a gamified dashboard. It is a fast, beautiful conversation starter.

### Brand Personality

Three words:

- **warm**
- **honest**
- **inviting**

Supporting traits:

- thoughtful, not stiff
- modern, not trendy-for-trendy’s-sake
- slightly playful, not chaotic
- spiritually grounded, not preachy
- intimate, not overly polished or corporate

Emotionally, the interface should evoke:

- calm confidence
- openness
- trust
- a sense of “this is safe, but real”

### Aesthetic Direction

Spill should live at the intersection of three reference modes:

1. **Editorial warmth** from the Not Just Sundays reference
   - serif-forward typography
   - soft cream backgrounds
   - deep green / grounded natural tones
   - quiet, premium, faith-adjacent visual language
   - selective ornament rather than decorative overload

2. **Frictionless game-entry clarity** from Jackbox
   - immediate comprehension
   - one dominant action
   - minimal choices at any one time
   - centered, obvious interaction patterns

3. **Airy restraint** from the Kindled reference
   - generous whitespace
   - understated accenting
   - a composed landing state
   - elegant pacing rather than busy layouts

The resulting direction is:

**Warm editorial minimalism with a card-game pulse.**

Spill should feel like a beautifully designed faith product, but faster and more interactive. It should look elevated enough to share with friends and simple enough to use spontaneously.

### Design Principles

1. **First value in seconds**  
   The user should understand what to do immediately: choose a context, choose a depth, get a prompt.

2. **Editorial, not app-store generic**  
   Use typography, space, and color intentionally so the interface feels designed, not assembled from utilities.

3. **Warmth over spectacle**  
   Use softness, rhythm, and thoughtful visual hierarchy instead of loud gradients, neon, or gimmicky effects.

4. **Deliberately not AI-generic**  
   Every screen should avoid the visual fingerprints of AI-generated product design: generic card grids, safe SaaS spacing, gradient-heavy hero sections, glassmorphism, over-rounded surfaces, and interchangeable startup styling.

5. **One sacred surface**  
   The prompt card is the emotional center of the product. Everything else should support it.

6. **Faith-shaped, not church-programmed**  
   The experience should feel spiritually grounded without resembling a church bulletin, ministry CMS, or retreat signup page.

---

## Product UI Positioning

Spill is not a full multiplayer party game in v1, but it should preserve a subtle sense of play. The UI should communicate:

- **conversation card deck** more than **software tool**
- **shared social moment** more than **solo productivity app**
- **gentle invitation** more than **serious spiritual assignment**

If there is tension between “beautiful” and “instantly usable,” choose instantly usable.

---

## Explicitly Avoiding the AI-Generated Look

Spill should **not** look like an AI-generated landing page or app shell. This needs to be an explicit design constraint, not an implied preference.

### Visual patterns to avoid

- generic rounded rectangles with soft gray shadows everywhere
- identical card grids with repeated icon + heading + body patterns
- purple/blue/cyan gradients, glowing accents, or dark-mode neon
- glassmorphism, frosted panels, and decorative blur
- overly symmetrical layouts with everything centered by default
- empty “premium” minimalism that has no point of view
- startup hero sections that look like they came from a template
- random decorative sparkles, blobs, or abstract shapes with no relationship to the brand
- oversized pill buttons and chips that feel copied from trend-driven UI kits
- perfectly polished but emotionally empty interfaces

### What to do instead

- let typography carry distinction
- use asymmetry and spatial rhythm where helpful
- make the prompt card feel specific to Spill
- choose a restrained, faith-adjacent palette with natural warmth
- use ornament rarely, but with purpose
- favor a few memorable decisions over many trendy ones

A useful test: if someone could mistake the screen for a generic AI-generated SaaS concept, the design is off-track.

---

## Theme

- **Mode:** light mode only for MVP
- **Mood:** soft daylight, natural paper, warm premium surfaces
- **Avoid:** dark-mode-first aesthetics, glowing UI, cyber gradients, synthetic startup visuals

---

## Accessibility Baseline

Assume **WCAG 2.2 AA** as the minimum standard.

Requirements:

- strong text/background contrast
- visible keyboard focus on all interactive elements
- clear selected states for context/depth chips
- minimum touch-friendly target sizes on mobile
- reduced-motion-friendly transitions
- no meaning conveyed by color alone

---

## Core Visual System

### Visual Metaphor

The product metaphor is **spilling truth from a deck of cards**.

That suggests:

- stacked or dealt card compositions
- soft movement that feels like sliding, dealing, revealing
- rounded rectangular surfaces with presence
- subtle flow motifs, not literal liquid graphics everywhere

### Tone Spectrum

Aim for this balance:

- **60%** quiet editorial restraint
- **25%** playful card-game energy
- **15%** spiritual warmth / contemplative softness

Too far toward editorial luxury and the app becomes precious. Too far toward game UI and it loses trust.

---

## Typography

Typography should do most of the brand work.

### Direction

Use a refined serif for major headings and a clean, readable sans or humanist sans for UI text.

### Desired feel

- headlines: thoughtful, literary, grounded
- body: conversational, clean, modern
- controls: simple, legible, unpretentious

### Guidance

- large serif headline for the product name and key prompt moments
- high line-height in body copy
- avoid over-compressing the layout with tiny UI text
- use type scale and spacing to create calm hierarchy
- do not use default-feeling system UI typography for the whole experience

### Avoid

- hyper-tech fonts
- bubbly toy-like lettering
- all-caps everywhere
- over-styled script fonts
- generic SaaS visual hierarchy

---

## Color Direction

The current brand docs point toward amber, teal, warm cream, and soft charcoal. Based on the references, the palette should skew natural and slightly editorial.

### Recommended palette roles

- **Background:** warm cream / parchment
- **Surface:** soft ivory / card white
- **Primary ink:** deep charcoal-green
- **Brand accent:** amber / ember gold
- **Secondary accent:** deep teal or muted evergreen
- **Dividers / subtle UI:** warm stone or tinted gray-green

### Palette behavior

- neutrals should be lightly warmed or green-tinted, never sterile gray
- accents should be used sparingly and purposefully
- the interface should read as mostly calm neutrals with 1–2 disciplined accents

### Avoid

- pure black / pure white
- bright blue product defaults
- purple/cyan AI gradients
- rainbow accents
- oversaturated “fun app” palettes

---

## Layout & Composition

### Desktop

Favor a composed, asymmetric editorial layout with one primary reading path.

Possible pattern:

- small branded header
- short intro / instruction
- filter controls in a tight cluster
- large prompt card as central surface
- utility actions beneath or attached to card edge

### Mobile

Mobile should feel native to thumb use:

- one-column stack
- filter chips easy to tap
- primary CTA always obvious
- prompt card tall enough to feel important
- secondary actions available but not noisy

### Spatial rules

- generous outer margins
- tighter internal groupings
- avoid many nested containers
- let whitespace carry elegance
- card should feel like an object, not just a box with text

---

## Components

### Prompt Card

This is the hero element.

Should feel:

- tactile
- calm
- substantial
- shareable

Design cues:

- generous padding
- elegant type hierarchy
- subtle depth or shadow
- optional card-stack treatment for deck metaphor
- enough contrast to stand apart from page background

### Filter Chips

Context and depth should feel lightweight and quick to change.

Design cues:

- pill or softened-rectangle chips
- clear selected state
- grouped tightly
- simple labels with no icon clutter

### Primary CTA

The main button should feel warm and decisive, not corporate.

Good labels:

- Generate
- New Prompt
- Wildcard
- Spill it

### Feedback / Utility Actions

Copy, share, upvote, and downvote should be quiet secondary actions.
They should not compete visually with prompt generation.

---

## Motion

Motion should feel like:

- dealing a card
- revealing a thought
- shifting attention gently

### Good motion patterns

- fade + slight upward settle for prompt reveal
- subtle slide or stack shift when getting a new prompt
- soft hover response on chips and buttons
- restrained emphasis for wildcard moments

### Timing

- fast enough to keep the product feeling instant
- slow enough to feel intentional

### Avoid

- bounce
- elastic motion
- flashy page transitions
- decorative animations unrelated to state change

Respect `prefers-reduced-motion`.

---

## Illustration & Decoration

Decoration should be sparse and symbolic.

Good options:

- subtle line-art botanical motifs
- card-edge patterns
- light grain or paper texture
- delicate dividers or ornamental rules

Use ornament as framing, not filler. The screen should never feel scrapbook-heavy.

---

## Copy & Tone in UI

The copy should sound like a trusted invitation.

### Good tone

- short
- warm
- direct
- human

### Examples

- “Pick a vibe.”
- “Choose your depth.”
- “Pull a card.”
- “Spill it.”
- “Try another one.”

### Avoid

- overly churchy phrasing
- startup/productivity jargon
- gamified hype language
- therapy-app cliches

---

## Anti-References

Spill should explicitly avoid looking like:

- a generic Tailwind landing page
- a B2B SaaS dashboard
- a loud mobile party game full of confetti and timers
- a sermon-notes app
- a church event registration portal
- a GenAI app with neon gradients and glass cards
- an AI-generated Dribbble-style concept with polished surfaces but no real identity
- a templated wellness app with beige cards and interchangeable serif branding

If a design starts to feel like a template, simplify and re-center on typography, space, and the card metaphor. If it starts to feel like “good AI taste,” push it toward something more specific, more branded, and less interchangeable.

---

## Implementation Guidance

For the MVP, use **plain CSS with CSS variables**.

Why:

- the app is small
- the brand matters more than framework styling speed
- the UI consists of a few memorable surfaces, not a large component library
- custom CSS will better support a distinct editorial feel

### Suggested styling structure

- global tokens in `:root`
- semantic component classes
- minimal utility use
- mobile-first responsive layout

### Core classes to expect

- `.app-shell`
- `.hero`
- `.filter-chip`
- `.prompt-card`
- `.button`
- `.button--primary`
- `.button--ghost`
- `.feedback-bar`

---

## AI Slop Test

Before shipping any screen, run this checklist:

- If the screen could belong to any startup, redesign it.
- If the main visual interest comes from a gradient, blur, or shadow, redesign it.
- If every section is centered and evenly spaced, redesign it.
- If the prompt card does not feel unique to Spill, redesign it.
- If the typography could be swapped into any generic template without changing the feel, redesign it.
- If the interface looks more like a SaaS product than a conversation deck, redesign it.
- If the design feels polished but emotionally empty, redesign it.
- If someone could say “this looks AI-generated” and be right, redesign it.

Passing state:

- the layout has a point of view
- the typography carries identity
- the palette feels natural and intentional
- the card metaphor is visible in the experience
- the overall feeling is warm, specific, and memorable

## Design North Star

**Spill should feel like opening a beautifully designed conversation deck on the web: warm, quick, trustworthy, and just playful enough that saying “Wanna play Spill?” feels natural.**
