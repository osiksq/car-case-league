# Car Case League — repository instructions for Codex

## Project contract
- Read `GDD.md` before proposing or implementing features; treat it as the current design baseline.
- Build a browser-first, responsive car collection and tactical auto-racing game; never substitute full 3D driving for the agreed design without explicit approval.
- Use original fictional car names and legally cleared artwork. Do not add real brands, logos, copyrighted textures or scraped assets.
- Case purchases use **earnable-only virtual coins**. Do not implement real money, transferable currency/items, betting, user deposits, or cash-out features.
- Prioritize a small, polished, playable vertical slice before adding content.

## Implementation conventions
- Prefer TypeScript + Vite + Phaser, with pure game logic separate from UI/animation.
- Keep race score calculations, drop probabilities, car data and prices in testable pure functions/config tables.
- Use deterministic RNG seeds for automated tests and reproducible bug reports.
- Save versioned local progress reliably. Gracefully handle corrupt/old save data.
- Avoid unnecessary dependencies, backend services and API keys.
- Consider desktop and mobile layouts, accessibility and reduced-motion settings.

## Development / testing workflow
- Before editing, briefly state the change and its acceptance criteria. Preserve existing working behavior.
- Implement one scoped feature at a time.
- Run `npm run build`, `npm run test`, and `npm run test:e2e` when configured; report exact success/failure, never claim unexecuted tests passed.
- For UI changes, open the game with a browser automation tool where available, inspect browser console/errors, test user interactions and capture a screenshot if supported.
- Mandatory smoke path: first visit -> free case -> garage -> choose race -> results -> save/reload.
- Explain changes, files touched, test commands/results and remaining limitations in each task report.
- Favor meaningful tests over screenshots alone.

## Git and deployment safety
- Work in a feature branch / pull request for nontrivial changes. Never force-push or overwrite unrelated work.
- Request approval for deploying a public preview, creating credentials, changing GitHub permissions or introducing payments/analytics.
- Never commit secrets, passwords, or real user personal data.
- Update GDD.md only when the game designer approves a design change; otherwise put suggestions in a separate section of the task report.
- If a requested feature conflicts with platform rules, IP constraints, or safe age ratings, flag the issue and suggest a compliant alternative.
