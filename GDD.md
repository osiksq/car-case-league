# Car Case League — Game Design Document

**Status:** Draft v0.1 — pre-production, 21 November 2026  
**Platform:** Browser (desktop first, responsive mobile)  
**Genre:** Car collecting + virtual case opening + tactical auto-racing  
**Audience:** International casual browser players; English-first  
**Target session:** >=10 min as a design hypothesis, to be tested (not guaranteed)

## 1. Elevator pitch

Open virtual car cases, build a diverse garage and choose the right car for different automated race events. Winning requires both a growing collection and smart decisions — a supercar will not automatically beat a cheaper specialist on every track.

**Unique hook:** Cars from cases are useful in a lightweight strategic racing league. Car selection, track requirements and a small amount of tuning matter more than rarity alone.

## 2. Product principles

1. **First action within seconds:** the tutorial gives the player a free starter case; no registration.
2. **Choices beat pure randomness:** the outcome of a race should be explainable from car stats, event conditions and tactics.
3. **Low art and development cost:** 2D illustrated/stylized original vehicle art and animated UI, not a physics-based 3D driving game.
4. **Collection with purpose:** ordinary cars can be useful for niche events, class limits, or collection challenges.
5. **No real-money loot boxes:** all cases use only earnable, non-purchasable in-game coins. No cash-out, betting, peer-to-peer trading or real-money monetary value. Do not launch without a fresh platform-policy and legal review.
6. **IP safety:** fictional manufacturers, unique names, original silhouettes/art. Do not use real automaker logos or unlicensed game assets.

## 3. Core gameplay loop

1. Pick a case, preview possible rewards and published probabilities, spend earned coins.
2. Open it with a short optional-to-skip reveal animation; collect a car in the garage.
3. Compare available racing events and expected track requirements.
4. Choose a suitable car and one of three tactics (Safe / Balanced / Push).
5. Watch a short 15–25-second auto-race, with progress and clear causal feedback.
6. Receive race coins, league points and milestone progression, including after losses.
7. Upgrade a favored car, sell duplicates, unlock new classes/cases; repeat.

**First-session aspiration (10 min):** open starter case -> race -> open second case -> compare cars -> win a different track -> make first upgrade -> unlock the next goal. Instrument the actual funnel before tuning for session length.

## 4. Core systems

### 4.1 Cars

Each car has:
- `id`, fictional `brand`, `model`, visual asset, `rarity`, `class`, `resaleValue`
- Four integer stats (1–100): `speed`, `acceleration`, `handling`, `reliability`
- Ownership state, optional upgrade levels, acquisition timestamp.

Five rarity tiers: Common, Uncommon, Rare, Epic, Legendary. **Rarity != automatic race superiority.** Class-restricted events and track types preserve the usefulness of modest cars.

Original, visually distinctive names: e.g. **Volterra Sprint**, **Nordfox GT**, **Altair V12**, **Kepler R**, **Ridgeback XR**. These are working examples and must be checked for name collisions before release.

### 4.2 Case opening

Case categories for eventual v1:

| Case | Draft coin price | Intended reward distribution (prototype only) | Unlock |
|---|---:|---|---|
| Rookie | 120 | Common 65%, Uncommon 25%, Rare 9%, Epic 1% | Start |
| Street | 450 | Common 25%, Uncommon 55%, Rare 17%, Epic 3% | League progression |
| Elite | 1400 | Uncommon 30%, Rare 55%, Epic 14%, Legendary 1% | Later league |

The percentages are **initial design guesses**, not measured optimums. Present clear odds in the UI, and test the expected resale value and player earning rate to prevent broken economies. All coin values are fictional. No IAP or coin purchasing.

Cases reveal 3–5 showcase candidates/roulette visuals but select the result through the audited probability table at open time, independent of animation speed. Provide a skip button. No deceptive near-miss effects or forced ad views.

### 4.3 Racing

**Not a driving simulator:** short asynchronous single-player match against 1–3 generated opponents. Show progress bars/compact animated track and a post-race breakdown.

Four event types with transparent stat weights:

| Race type | Speed | Acceleration | Handling | Reliability |
|---|---:|---:|---:|---:|
| Drag | 20% | 60% | 15% | 5% |
| Circuit | 35% | 15% | 40% | 10% |
| Wet Road | 20% | 10% | 50% | 20% |
| Endurance | 20% | 15% | 15% | 50% |

**Score hypothesis:** weighted car stats + small tactic modifier + seeded event variance of no more than +/-3% of score. Display a recommendation like "Handling is crucial here" and show which stats drove the result. Tactics: Safe improves reliability but sacrifices speed; Push boosts speed/acceleration while increasing risk; Balanced has no modifier. Details must be tuned through deterministic simulation tests.

In the first prototype, use just **Drag** and **Circuit**. Add weather/endurance only once racing is fun.

### 4.4 Economy and progression

- Tutorial grants a free first case and enough coins to enter the first race; the initial car is guaranteed eligible.
- Starting races give a suggested 100 coins for a win and 60 for a loss; later payouts depend on league. These numbers require balancing.
- Duplicate cars can be sold for in-game coins (no external market). Allow locking favorite cars to avoid accidental sale.
- Upgrades: limited to 2 points per stat per upgrade level; cap total stat growth so class specialists remain relevant.
- Leagues and championships unlock higher-level content based on completed race objectives, not merely opening expensive cases.
- Quests reward completing different race types, experimenting with a new car, and finishing a collection — not compulsive daily spending.
- Keep save data in local storage for the prototype; consider CrazyGames progress integration for Full Launch.

### 4.5 UX / Screens

1. **Garage (home):** prominent next objective, coins, favorite car, playable event.
2. **Cases:** available cases, clear coin price, odds, short reveal, sell or keep.
3. **Race preparation:** event name, favored stats, car comparison, tactic choice.
4. **Race simulation:** 15–25 seconds max, skip possible after initial viewing.
5. **Results:** position, reason for result, earnings, next unlock.
6. **Collection:** grid, sort/filter by class/rarity, lock, sell duplicate, upgrades.
7. **Settings:** sound, accessibility/reduced motion, reset save (with confirmation).

English UI. Responsive layout with touchscreen support. Readable silhouettes and rarity symbols should not rely on color alone. No account required for prototype.

## 5. Distinction from existing car-case games

Our flagship mechanic is **tactical car selection for automated races**, not manually driving in a racing world. Race-specific weighting, class limits, transparent results and small strategic upgrades must be present at least in the playable public prototype. Original art, branding and UX are required.

## 6. Scope and milestones

### Milestone 0 — technical proof / first playable (one vertical slice)
- Vite + TypeScript + Phaser setup, working desktop/mobile view.
- 12 unique fictional cars and placeholder original/clearly licensed art.
- One Rookie case, explicit drop rates, short reveal.
- Basic garage, lock/sell car, coin balance.
- Two race types (Drag/Circuit), opponent comparison, automatic event and breakdown.
- Tutorial, save/load, reset, deterministic data/odds tests and browser smoke test.
- No backend, multiplayer, payments, live economy, real brands or ads.

**Definition of done:** launch on a clean browser, obtain a car, run a race, earn coins, reopen a case, reload and keep progress, without JS console errors. Build and tests pass.

### Milestone 1 — engaging prototype
- Expand to 24–30 original cars; three cases if balance supports them.
- Car upgrades; 3–4 event types; league progression.
- Collection goals and a few achievements.
- Tune onboarding and reward pacing based on 15–30 testers.

### Milestone 2 — submission candidate
- 40–60 cars if art quality is consistent; animation/audio polish.
- Comprehensive Chrome/Edge and mobile testing, accessibility and loading optimization.
- Player feedback analytics with privacy-compatible approach; exact policy/consent review.
- CrazyGames SDK integration when required for selected launch stage, official QA compliance checks, cover art.

## 7. Validation and KPIs

**Internal targets (hypotheses; not guaranteed platform approval):**
- First meaningful action <15 seconds after load (fast networks / reasonable devices).
- First race completed within 90 seconds of starting.
- No game-breaking exceptions; saves reliably survive reload.
- Track completion rate of tutorial, first/second case, first race, session duration and Day-1 retention.
- Target average session >=10 min and improve from observed player behavior; never inflate session length with mandatory waiting.

CrazyGames Basic Launch publicly discusses average play time, Day-1 retention, conversion to >=1 minute and, from 23 Nov 2026, cover CTR. Confirm requirements before submission: https://docs.crazygames.com/resources/basic-launch-metrics/

## 8. Architecture / quality

- Frontend: TypeScript, Vite, Phaser. No backend for prototype.
- Separate pure TypeScript domain logic from rendering (`game/economy`, `game/cases`, `game/races`, `game/progression`).
- Store asset metadata and balance tables as data (JSON or TS config), not scattered constants.
- Seed random generation for repeatable test scenarios; verify rarity odds statistically.
- Vitest for mechanics (drop-rate sum, correct rewards, no negative balance, upgrade caps, race determinism, save/load migrations).
- Playwright for browser flows (first visit, open case, race, save/reload, mobile viewport).
- `npm run dev`, `npm run build`, `npm run test`, `npm run test:e2e` scripts; GitHub Actions CI.
- Do not commit build output, credentials, `.env` secrets, node_modules or huge assets.
- Keep initial download well below 20 MB when practical. Official technical limits: https://docs.crazygames.com/requirements/technical/

## 9. Key decisions / open questions

**Decision now:** fantasy car brands, earned-only currency, auto-races, responsive 2D art, no multiplayer, phased development.

**To test, not assume:** ideal race length, UI style (garage realism vs clean collectible cards), how much luck in racing feels fair, case-price economics, when second/third cases unlock.

**Open legal/platform question:** Even without paid boxes, a chance-based reward system might require content/platform review. Confirm applicable CrazyGames, advertising, ratings, brand/IP and local rules before launch.
