# Car Case League — Game Design Document

- **Version:** 0.3 · Alpha 0.2 (Career Update)
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

## 3. Case lineup and economy

Alpha offers four cases. Every case has a separate vehicle pool. Roll for rarity using the selected case's table and then choose uniformly among its vehicles in that tier. The odds are visible before purchase. The first opening is free when the player chooses Rookie. Every catalog car is eligible for both Alpha races.

| Case | Price (coins) | Common | Uncommon | Rare | Epic | Legendary | Mythic |
|---|---:|---:|---:|---:|---:|---:|---:|
| Rookie | 120 | 70% | 25% | 5% | 0% | 0% | 0% |
| Street | 240 | 35% | 45% | 18% | 2% | 0% | 0% |
| Performance | 420 | 0% | 25% | 45% | 26% | 4% | 0% |
| Elite | 700 | 0% | 0% | 20% | 55% | 24% | 1% |

Select and persist the reward before constructing the horizontal reel. The visual cards come from the selected case's pool and favor its common outcomes. Legendary and Mythic filler appearances are limited and kept away from the marker's neighboring slots at the stop. The reel illustrates the opening. The published table governs the actual draw. Cards move right to left, decelerate, and stop on the selected car. Skip reveals the same result immediately. The result offers Keep, Sell, and Go to Garage. Sale uses the garage's protection rules.

| Temporary Alpha value | Coins |
|---|---:|
| Starting wallet | 60 |
| Race entry | 0 |
| Win | 100 |
| Loss | 60 |

Either outcome of the first race funds a second Rookie Case without selling the starter car. The four prices are temporary and configurable. Local development can waive the price of any case with Infinite Money.

## 4. Races

Select an owned car and a tactic before entering a one-on-one auto race. Safe favors reliability at a cost to speed, Balanced uses base performance, and Push increases speed and acceleration at the cost of handling and reliability.

| Event | Speed | Acceleration | Handling | Reliability |
|---|---:|---:|---:|---:|
| Drag Race | 20% | 60% | 15% | 5% |
| Circuit Race | 35% | 15% | 40% | 10% |

Calculate the outcome and intermediate progress phases before the animation. In a free race, match a rival whose baseline score for the track differs by at most 2% of the pair's average score. The rival can use the same model if no distinct car offers a close match.

The score combines weighted stats and tactic effects with seeded variation of up to ±1% for Safe, ±2% for Balanced, and ±3% for Push. The rival uses Balanced variation. Equal rounded scores are settled by a seeded tie-break. The race view shows both cars and progress bars for approximately 12–15 seconds. The player can skip to the same result at any time and see a breakdown of the outcome and the coin reward.

### 4.1 Career

The Career screen shows the current league, event clears, promotion rules, and league rewards. Start in Rookie League. Win both distinct competitions in a league to earn its crest and unlock the next league. Completing Elite earns the final crest. Free races, repeat wins, losses, and coin spending do not advance the career.

| League | Competitions | One-time reward |
|---|---|---|
| Rookie | Depot Sprint and Foundry Loop | Rookie Crest and access to Street League |
| Street | Neon Straight and Harbor Loop | Street Crest and access to Pro League |
| Pro | Apex Sprint and Ridge Circuit | Pro Crest and access to Elite League |
| Elite | Crown Sprint and Summit Circuit | Elite Crest |

Career competitions use the existing Drag and Circuit rules and automatic race animation. A rival's base score is the track-weighted score of their own car multiplied by the event's pace factor. Seeded variation uses a fixed range for each event. The same competition and seed give the same rival score for every player car and tactic. Both tracks get progressively stronger rivals from Rookie to Elite.

Either Common starter can clear Rookie. Higher leagues favor stronger cars and track specialists. Elite leaves room for a competitive Legendary car and for a Mythic car to lose. Every owned car can enter every unlocked competition, and a competition can be retried or replayed. Free races remain a way to earn coins and improve the garage.

Free races remain available in Race Control. Career races use the same standard win and loss payments as free races, including replays. Promotions award crests and access to competitions without a coin bonus. The career configuration defines the leagues, events, rivals, difficulty, and crests.

## 5. Progress, accessibility, and recovery

Store wallet, owned cars, selection, race results, and counters as a versioned localStorage snapshot. A case purchase records its cost and car together. A race records its result and reward together. Reload during either animation recovers the saved result without re-rolling, losing a car, or applying the reward twice.

Keep the career's cleared competitions and unlocked leagues in the same snapshot as the race outcome and wallet. A league crest is earned once. A pending result can show the same promotion after reload without granting a second reward. Saves from Alpha 0.1 retain their inventory, wallet, and race history and start in Rookie League. Keep competition IDs and league assignments stable for existing saves.

Support touch and keyboard interaction, readable rarity labels, and the browser's reduced-motion preference. A confirmed reset starts a fresh save. No account is required.

## 6. Implementation and validation

TypeScript owns game rules and state. Vite builds the static application, and HTML/CSS with browser animation APIs render the Alpha interface. Consider Phaser if future effects warrant a game renderer. No backend is required for Alpha.

- Vitest verifies economy, case odds, deterministic racing, save integrity, and promotion across all four leagues.
- Playwright checks the browser flow on desktop and at a mobile viewport, including interrupted reveals, promotions, and career replays.
- GitHub Actions builds the app and runs the tests. The production base for GitHub Pages is `/car-case-league/`. Public publication requires separate approval.

**Alpha acceptance:** Start with a clean save, open the free case, inspect the garage, complete a race, use the reward to buy a second case, and reload without losing or duplicating progress. Win two Rookie competitions, confirm the Street unlock and Rookie Crest after reload, and replay a completed event without earning the crest again. Build and automated checks pass.

## 7. Deferred decisions

Championships, complex tuning, multiplayer, ads, and payments are outside Alpha. Weather and endurance races, class-restricted events, and larger catalogs are candidates for later design review.

Session length, onboarding completion, and return rates remain design hypotheses. Validate release constraints and metrics before any CrazyGames submission. See the [Basic Launch guide](https://docs.crazygames.com/resources/basic-launch-metrics/) and [technical requirements](https://docs.crazygames.com/requirements/technical/).
