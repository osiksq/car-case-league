# Junkyard economy

The free Junkyard Case has no cooldown. Finish the current reveal to open another case. The rarity odds remain 95% Common and 5% Uncommon. The first case uses the original starter pool and the last-car protection keeps that starter available for races. Later draws choose uniformly among the 11 eligible Common or three eligible Uncommon models in the rolled rarity. The resale values average 22 and 41 coins by tier, so each sold drop has an expected resale of **22.95 coins**.

| Opening and sale cadence | 10 minutes | 30 minutes | 60 minutes |
| --- | ---: | ---: | ---: |
| Full animation, 8 seconds per cycle | 1,698.30 | 5,140.80 | 10,304.55 |
| Skip, 4 seconds per cycle | 3,419.55 | 10,304.55 | 20,632.05 |

Estimates are net coins from Junkyard only, with the first car kept and every later drop sold. They exclude the initial wallet of 60 coins, assume no idle time, and include the button presses and the sale in each modeled cycle. The formula is the number of completed cycles minus one starter opening, multiplied by 22.95. For comparison, the original 60-second cooldown with the previous 40-car catalog yielded about 1,402 coins per hour. At the new skip cadence, expected one-hour earnings can cover the unchanged 16,000-coin Elite Case price.

A run of 1,000 fixed-seed sessions per cadence through the production save transitions gave 1,699.67 / 5,140.97 / 10,305.01 coins for full openings and 3,420.18 / 10,305.01 / 20,638.39 for Skip. The table reports the exact expectation.

Run `npm run simulate:economy` to recalculate from the current production odds and resale values, and compare the expectation with seeded simulations of the same two opening patterns. Racing income and progression are outside the Junkyard-only estimates.
