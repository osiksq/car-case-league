# Car Case League

Car Case League is a browser game about collecting fictional cars and choosing the right vehicle and tactic for automated races.

## Run locally

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open [localhost:5173/car-case-league/](http://localhost:5173/car-case-league/). The first Rookie Case is free. Keep the car, run a Drag or Circuit race, then use the reward to open another case. Progress is stored in the current browser.

The development server shows **DEV** next to Settings. It can temporarily waive case costs without debiting the wallet, add test coins, or reset development progress. The switch starts off on each page load. Development uses a separate save, and the built game served by `npm run preview` uses the release save.

## Build and test

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

Playwright checks the production build under the GitHub Pages base path and runs the developer tools tests against a separate Vite development server. To explore the production build manually, run `npm run preview` and open [localhost:4173/car-case-league/](http://localhost:4173/car-case-league/).

## Publish a demo

After publication is approved and the release is merged into `main`, set **Settings → Pages → Source** to **GitHub Actions** and run **Publish to GitHub Pages** manually from `main`. The workflow tests the build before uploading `dist/`. The expected address is [osiksq.github.io/car-case-league/](https://osiksq.github.io/car-case-league/). The workflow has no push trigger.

## Project materials

- [Game Design Document](GDD.md)
- [Repository instructions](AGENTS.md)
- The twelve car illustrations in `public/cars` are original, AI-generated Alpha placeholders, prepared as WebP from a single studio-style contact sheet. Review names and artwork before public release.
