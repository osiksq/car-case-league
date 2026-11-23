# Alpha 0.4 racing

Drag and Circuit keep their existing scoring weights. Wet Circuit and Endurance are free-race disciplines and use the same scoring formula and reward rules.

| Discipline | Speed | Acceleration | Handling | Reliability | Rival variation in free races |
| --- | ---: | ---: | ---: | ---: | ---: |
| Drag Race | 20% | 60% | 15% | 5% | ±2% |
| Circuit Race | 35% | 15% | 40% | 10% | ±2% |
| Wet Circuit | 15% | 10% | 50% | 25% | ±7% |
| Endurance | 20% | 10% | 20% | 50% | ±8.5% |

The wider variation on the two new tracks leaves room for the evenly matched rival to win when Safe is strongly favored by the track weights. A deterministic fingerprint for 30,720 career outcomes and scores matches Alpha 0.3 exactly across all eight competitions, 40 cars, three tactics and 32 fixed seeds. The comparison excludes presentation phases, which now represent different track sectors.

The free-race preview selects the opponent from the same seed used at entry. The game saves the outcome and payout before it starts the scene. The scene interpolates saved positions and cues synthesized Web Audio from the countdown, launch, pace, gear changes, passes and finish. Skip Race stops the scene and its sound. Reduced Motion displays the saved result immediately. Reloading an in-progress race restores its result. Browser settings and policies can affect audio playback.

## New discipline simulations

Run `node scripts/race-simulation.mjs` from the repository root. The following 393,216 races use 8,192 fixed seeds per car, discipline and tactic. Each car faces its normal free-race matchmaking pool. Rows show how often a car wins that matchup and do not rank absolute vehicle strength.

| Car | Rarity · class | Wet Safe | Wet Balanced | Wet Push | Endurance Safe | Endurance Balanced | Endurance Push |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Bravik 110 | Common · Classic | 83.6% | 42.8% | 20.7% | 90.3% | 48.0% | 29.9% |
| Petrel S1 | Common · Street | 88.1% | 49.8% | 29.4% | 92.0% | 49.3% | 31.0% |
| Kestovan RX | Uncommon · Muscle | 96.6% | 52.8% | 29.3% | 88.6% | 45.2% | 26.4% |
| Thalven GT | Rare · Sport | 81.1% | 50.3% | 33.6% | 82.7% | 48.5% | 33.8% |
| Dorsenne V12 | Rare · Collector | 76.8% | 45.4% | 28.3% | 90.0% | 55.7% | 41.1% |
| Kairox R | Epic · Track | 79.2% | 54.0% | 41.0% | 75.3% | 45.1% | 32.6% |
| Sorevik T9 | Legendary · Track | 73.0% | 50.2% | 37.4% | 82.5% | 54.0% | 42.0% |
| Orvane Eclipse | Mythic · Exotic | 74.0% | 51.6% | 39.4% | 75.7% | 49.6% | 38.8% |

Safe was the strongest tactic for this sample. In both disciplines, the outcome still varied by car and seed.

## Browser checks

A desktop Chromium headless run of the production build measured 60 Canvas paints per second on Drag, 57 on Circuit, 56 on Wet Circuit and 59 on Endurance in 2.4-second samples. The 95th-percentile measured JavaScript paint submission time was 0.5–1.5 ms. These measurements describe this environment and exclude GPU presentation time. The renderer limits Canvas updates to 60 Hz and reduces the particle count on narrow screens.

Playwright verifies the four track options, the preselected rival, visual finish order for both outcomes, result recovery on reload, and Reduced Motion. It also verifies that skipping releases active audio sources and the Canvas resize observer, and that the audio setting is saved.
