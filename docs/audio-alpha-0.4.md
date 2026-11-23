# Alpha 0.4 audio and animation

The HUD Sound panel controls the master, engine and effects channels. The game saves the three levels and the on/off preference in browser storage. The previous Race Sound preference supplies the initial on/off value for existing installs. Development retains its own preference key.

## Audio sources

All effects are original procedural Web Audio synthesis in `src/ui/audio.ts`. The game generates oscillator tones, envelopes and short filtered noise in the browser. There are no imported audio files, sampled commercial sounds, external license obligations or audio downloads.

| Surface | Cues |
| --- | --- |
| Race | Three countdown beeps, GO, layered engine, variable revs and filter, shifts, passes, finish, victory and defeat |
| Cases | Case selection, opening impact and mechanism, reel ticks at passing cards, stop, and a separate reward sound for each of the six rarities |
| Interface | Main buttons, car selection, coins, sale and new-league unlock |

Vintage, sport and hypercar profiles vary in fundamental frequency, pitch range, harmonics and filtering. The master limiter and concurrent voice limit control overlap. The audio context opens from a user gesture. If the browser prevents playback or cannot provide Web Audio, the game continues silently.

## Foreground playback

Race and reel timelines advance only while the page is visible. When the page is hidden, active audio sources stop and the mixer suspends. Returning resumes from the current foreground position without playing missed cues. The persistent save and outcome flow remains independent of the sound and presentation.

Skip Race ends the race sound immediately. Skipping the reel ends its mechanism and plays the single reward cue. Reduced Motion reveals the already saved outcome without a race or reel timeline.

## Browser measurements

The local production build was profiled in headless Chrome on Windows, at 1440 px desktop width and with Playwright's Pixel 7 viewport and device scale. Over about 2.3 seconds of active playback, the test counted Canvas draws and reel transform writes. Canvas timing measures JavaScript paint submission and excludes GPU presentation.

| Profile | Wet Circuit Canvas draws/s | Reel transform writes/s | Canvas paint submission p95 | Canvas backing scale |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 60 | 60 | 1.0 ms | 1.0× |
| Pixel 7 emulation | 60 | 59 | 0.8 ms | 1.4× |

The renderer caps pixel count and scale, and reduces curve samples, rain and optional reflections on constrained devices. Both timelines use elapsed time and a 60 Hz update budget. The mixer reuses a single AudioContext and removes owned audio nodes on skip, mute and backgrounding. Browser automation covers those resource lifecycles and simulates playback rejection. No physical Android device or iPhone was used.
