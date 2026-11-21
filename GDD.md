# Car Case League — Game Design Document

- **Version:** 0.2 · Alpha 0.1
- **Platform:** Desktop and mobile web
- **Audience:** Casual browser players · English interface

## 1. Product direction

Open virtual car cases, build a varied garage, and compete in short tactical auto races. The right car and tactic for an event matter alongside rarity. The first session takes the player from a free case to a race and a second case.

Use a dark, premium automotive interface with large cards, restrained transitions, and semi-realistic three-quarter vehicle artwork. All vehicles and names are original fictional creations. Alpha uses generated placeholder artwork. Review artwork, names, and applicable platform and content requirements before a public launch.

Coins are earned in-game. The game has no coin purchases, real-money rewards, betting, transfers, or cash-out.

## 2. Vehicle catalog and garage

Alpha contains 12 unique vehicles. Each model has a name, artwork, resale value, class, rarity, and four integer stats from 1 to 100: Speed, Acceleration, Handling, and Reliability. Owned copies have their own identity and lock status.

| Rarity | Color |
|---|---|
| Common | Gray |
| Uncommon | Green |
| Rare | Blue |
| Epic | Purple |
| Legendary | Gold |
| Mythic | Red |

Common covers older or budget vehicles. Mythic covers the most prestigious modern hypercars. All rarity tiers have text labels. The classes are Street, Sport, Muscle, Track, Exotic, Classic, and Collector. Collector uses black carbon styling and retains its rarity label and accent.

My Garage supports sorting and filters, inspection of all four stats, selection for races, locking, and sale. Locked cars and the last race-eligible car cannot be sold. If the selected car is sold, another owned car becomes selected. Duplicate models are allowed.

## 3. Rookie Case and economy

Rookie is the only Alpha case. The first opening is free and uses the same table as subsequent openings. Every catalog car is eligible for both Alpha races. Roll for rarity and then choose uniformly within the tier. The odds are visible before purchase.

| Common | Uncommon | Rare | Epic | Legendary | Mythic |
|---:|---:|---:|---:|---:|---:|
| 63% | 25% | 9% | 2% | 0.8% | 0.2% |

Select and persist the reward before the horizontal roulette starts. Cards move right to left, decelerate, and stop on the selected car. Skip reveals the same result immediately. The result offers Keep, Sell, and Go to Garage. Sale uses the garage's protection rules.

| Temporary Alpha value | Coins |
|---|---:|
| Starting wallet | 60 |
| Subsequent Rookie Case | 120 |
| Race entry | 0 |
| Win | 100 |
| Loss | 60 |

Either outcome of the first race funds a second case without selling the starter car. Prices, payouts, resale values, and probabilities are configurable and pending balance review.

## 4. Races

Select an owned car and a tactic before entering a one-on-one auto race. Safe favors reliability at a cost to speed, Balanced uses base performance, and Push increases speed and acceleration at the cost of handling and reliability.

| Event | Speed | Acceleration | Handling | Reliability |
|---|---:|---:|---:|---:|
| Drag Race | 20% | 60% | 15% | 5% |
| Circuit Race | 35% | 15% | 40% | 10% |

Calculate the outcome and intermediate progress phases before the animation. Match a rival whose baseline score for the track differs by at most 2% of the pair's average score. The rival can use the same model if no distinct car offers a close match.

The score combines weighted stats and tactic effects with seeded variation of up to ±1% for Safe, ±2% for Balanced, and ±3% for Push. The rival uses Balanced variation. Equal rounded scores are settled by a seeded tie-break. The race view shows both cars and progress bars for approximately 12–15 seconds. The player can skip to the same result at any time and see a breakdown of the outcome and the coin reward.

## 5. Progress, accessibility, and recovery

Store wallet, owned cars, selection, race results, and counters as a versioned localStorage snapshot. A case purchase records its cost and car together. A race records its result and reward together. Reload during either animation recovers the saved result without re-rolling, losing a car, or applying the reward twice.

Support touch and keyboard interaction, readable rarity labels, and the browser's reduced-motion preference. A confirmed reset starts a fresh save. No account is required.

## 6. Implementation and validation

TypeScript owns game rules and state. Vite builds the static application, and HTML/CSS with browser animation APIs render the Alpha interface. Consider Phaser if future effects warrant a game renderer. No backend is required for Alpha.

- Vitest verifies economy, case odds, deterministic racing, and save integrity.
- Playwright checks the browser flow on desktop and at a mobile viewport and tests interrupted reveals and races.
- GitHub Actions builds the app and runs the tests. The production base for GitHub Pages is `/car-case-league/`. Public publication requires separate approval.

**Alpha acceptance:** Start with a clean save, open the free case, inspect the garage, complete a race, use the reward to buy a second case, and reload without losing or duplicating progress. Build and automated checks pass.

## 7. Deferred decisions

Championships, complex tuning, multiplayer, ads, and payments are outside Alpha. Further cases, weather and endurance races, class-restricted events, and larger catalogs are candidates for later design review.

Session length, onboarding completion, and return rates remain design hypotheses. Validate release constraints and metrics before any CrazyGames submission. See the [Basic Launch guide](https://docs.crazygames.com/resources/basic-launch-metrics/) and [technical requirements](https://docs.crazygames.com/requirements/technical/).
