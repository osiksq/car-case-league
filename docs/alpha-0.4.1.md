# Alpha 0.4.1 bug fix and sound rework

## Junkyard

The unmodified production build from commit `bf53446` allowed a second normal-mode Junkyard opening 1,371 ms after the first. The browser sequence was opening the free case, dismissing the result, confirming Reset Progress, and opening Junkyard again. Reset assigned an empty timing record, so the domain validator no longer had a last-opening timestamp. Case changes, a garage visit, and a regular reload preserved the cooldown in that baseline run.

Reset now retains an active Junkyard timestamp and the corresponding clock anchor. Normal case purchases continue to check 60 seconds in the saved game transition. The progression reset still clears cars and wallet, racing and career progress. Sandbox and development continue to use separate saves and explicitly authorize unlimited openings only in their respective test modes.

When the browser supplies a zero or unavailable performance time origin, the game's clock anchors the monotonic timer to the wall clock once at startup. This keeps saved timestamps comparable on subsequent loads.

## Recorded audio

The existing mixer now loads compressed MP3 clips and decodes them into Web Audio buffers. The engine loop uses a distinct recorded sample per vehicle profile. The visual pace controls its pitch and loudness, a gear change briefly dips the playback rate, and the finish fades the engine. Scoped sources and late file loads are cancelled on skip, mute or backgrounding. The game continues if playback or decoding fails. Case chirps are replaced by mechanical Foley and recorded reward effects.

The published build exposes a Sound panel link to the audio credits. The individual files, versions, edits and redistribution terms are documented in [case and interface sources](audio-case-sources.md) and [race sources](audio-race-sources.md).
