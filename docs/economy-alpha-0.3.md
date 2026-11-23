# Alpha 0.3 economy and collection

## Rewards and cases

Players start with 60 coins. The first Junkyard Case rolls at the same rarity odds as later ones and restricts the pool to Bravik 110, Petrel S1 and Merovar Sprint. The 60-second cooldown starts when the case is awarded. Spare cars can be sold.

| League | First win per competition | Replay win |
| --- | ---: | ---: |
| Rookie | 190 | 48 |
| Street | 575 | 105 |
| Pro | 1,700 | 190 |
| Elite | 3,800 | 420 |

Free-race wins pay 18 coins. Losses pay zero. A paid replay or free-race win starts a shared 60-second reward cooldown. Players can still race immediately. First wins in career competitions are one-time payouts that bypass and leave the shared cooldown in place. The result and award are fixed when the race starts, so skipping the animation cannot change either.

| Case | Price | Common | Uncommon | Rare | Epic | Legendary | Mythic |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Junkyard | 0 | 95% | 5% | 0% | 0% | 0% | 0% |
| Rookie | 250 | 52% | 30% | 18% | 0% | 0% | 0% |
| Street | 700 | 18% | 37% | 32% | 13% | 0% | 0% |
| Sport | 2,000 | 0% | 16% | 52% | 29% | 3% | 0% |
| Performance | 5,500 | 0% | 0% | 25% | 50% | 25% | 0% |
| Heritage | 9,000 | 0% | 0% | 40% | 42% | 18% | 0% |
| Elite | 16,000 | 0% | 0% | 0% | 65% | 32% | 3% |
| Hyper | 30,000 | 0% | 0% | 0% | 50% | 42% | 8% |

Heritage contains Collector cars exclusively. The game draws a rarity, then chooses a car uniformly among the selected case's models in that tier. The reel uses eligible cars and lands on the saved reward.

## New cars

| Rarity | New models | Total models |
| --- | --- | ---: |
| Common | Dorvik 75, Talmor Pico, Norwyn Kite, Velska Cargo, Ruskell 120, Havrix Cabrio, Elden Boxer | 9 |
| Uncommon | Narvik Rally, Issara Twin, Malkor SS, Vesryn Dune, Selaire Roadster, Ordane Sedan | 8 |
| Rare | Tavren Cup, Karsen V8, Vossari Spyder, Aldoven 63, Bellovar Mk II, Cirven Sport | 8 |
| Epic | Quorven RS, Ralvex Turbo, Solvara SR6, Melvane GT1, Ventari S4 | 7 |
| Legendary | Trevos R90, Ardenza Proto, Ikhara GT | 5 |
| Mythic | Novaryn Zero | 3 |

The original 12 models retain their IDs, stats and resale values. Each new model has a distinct original generated WebP illustration.

## Save compatibility

Version 1 saves migrate under the existing storage key on the next write. The wallet, garage, locks, recorded races, pending rewards, and career progression carry over. Existing players can open their first Junkyard Case immediately. In version 2, timings are saved together with the reward. The browser's monotonic clock drives the countdown within a loaded page. If it detects a clock rollback after a reload, the game resumes the remaining cooldown from the new page's clock. A forward clock change across restarts or editing browser storage can still bypass local timing.

## Simulation

Run `npm run simulate:economy` from the repository root. The script uses the production save transitions, random reward draws, opponent scoring, sale values and cooldowns. It uses a separate seeded matchup sample to pick cars and tactics, then plays independent progressions from new saves. The simulated session uses plausible menu and animation durations and checks the wallet after each action. Results are balance estimates from scripted strategies.

- **Junkyard** keeps the starter and sells all subsequent free drops.
- **Career** keeps cars, attempts first clears, and buys upgrades when the current garage has very low odds at an unlocked event.
- **Frequent losses** deliberately enters a difficult race on most attempts with the starter. It keeps free drops and attempts productive races occasionally.
- **Sell all duplicates** uses the career strategy and immediately sells each repeated model.
- **Skip every animation** uses the career strategy with shorter interaction times.
- **Farm best replays** advances to higher-paying events where possible and repeatedly enters lucrative replays during the cooldown.

### Results

Sessions per strategy: 600; horizon: 180 minutes; race cycles: 24s normal / 7s skipped; case cycles: 8s / 4s.

| Strategy | Income 10 min | 30 min | 60 min | Race win rate |
| --- | ---: | ---: | ---: | ---: |
| Junkyard | 233 | 702 | 1402 | — |
| Career | 3607 | 9061 | 16771 | 86% |
| Frequent losses | 727 | 1313 | 2178 | 11% |
| Sell all duplicates | 3759 | 9917 | 18682 | 85% |
| Skip every animation | 4163 | 9494 | 17488 | 84% |
| Farm best replays | 3794 | 8680 | 16182 | 68% |

| Strategy | Rookie Case | Street Case | Sport Case | Performance Case | Heritage Case | Elite Case | Hyper Case |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Junkyard | 8.8 min (100%) | 28.0 min (100%) | 83.6 min (100%) | — (0%) | — (0%) | — (0%) | — (0%) |
| Career | 0.6 min (100%) | 4.9 min (100%) | 12.9 min (100%) | 48.2 min (100%) | 100.7 min (80%) | 114.2 min (66%) | 141.7 min (36%) |
| Frequent losses | 0.9 min (100%) | 16.3 min (100%) | 50.1 min (100%) | 172.7 min (21%) | — (0%) | — (0%) | — (0%) |
| Sell all duplicates | 0.6 min (100%) | 4.4 min (100%) | 11.3 min (100%) | 42.8 min (100%) | 97.9 min (87%) | 111.6 min (75%) | 137.3 min (44%) |
| Skip every animation | 0.2 min (100%) | 3.7 min (100%) | 10.9 min (100%) | 46.8 min (100%) | 99.6 min (81%) | 111.9 min (69%) | 134.1 min (40%) |
| Farm best replays | 0.2 min (100%) | 4.9 min (100%) | 13.1 min (100%) | 50.9 min (100%) | 102.3 min (74%) | 115.8 min (61%) | 140.2 min (30%) |

| Strategy | All eight competitions won | Alternative Hyper price (24,000 coins) |
| --- | ---: | ---: |
| Junkyard | — (0%) | — (0%) |
| Career | 80.7 min (65%) | 127.3 min (46%) |
| Frequent losses | — (0%) | — (0%) |
| Sell all duplicates | 75.7 min (66%) | 126.2 min (55%) |
| Skip every animation | 79.7 min (64%) | 122.6 min (48%) |
| Farm best replays | 86.6 min (62%) | 130.3 min (42%) |

Times are means among sessions reaching the goal by 180 minutes. The percentage is coverage. Income excludes the initial wallet and does not subtract case purchases.

| Case | Price | Expected resale |
| --- | ---: | ---: |
| Junkyard Case | 0 | 23.37 |
| Rookie Case | 250 | 37.41 |
| Street Case | 700 | 61.52 |
| Sport Case | 2000 | 92.13 |
| Performance Case | 5500 | 144.02 |
| Heritage Case | 9000 | 146.97 |
| Elite Case | 16000 | 177.18 |
| Hyper Case | 30000 | 199.31 |
First Junkyard theoretical resale: 27.53 coins (the last-car protection prevents selling it immediately).

### Balance decisions

A first Rookie career win funds the 250-coin case. In the simulations, Career produced 16,771 coins over the first hour. The replay-farming strategy produced 16,182, and the frequent-loss strategy produced 2,178. Selling duplicates improved income without turning case purchases into a profitable resale loop.

The initial Performance pool and rarity mix yielded a 44% career-completion rate within three hours for the Career profile. Giving Ralvex Turbo a stronger drag specialization, adding it to Performance, and increasing the case's Legendary odds from 15% to 25% raised the completion rate to 65%. Elite still has a long tail. The 80.7-minute mean counts only runs that finished within three hours.

The configured Hyper price remains 30,000. Compare 24,000 in playtests if Hyper should be reachable within three hours for more players. In the same Career runs, coverage rose from 36% to 46%, and the mean among runs reaching the threshold fell from 141.7 to 127.3 minutes. This alternate threshold measures wallet affordability on the same trajectories.
