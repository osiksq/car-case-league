# Car Case League

Car Case League is a browser game about collecting fictional cars and choosing the right vehicle and tactic for automated races.

## Run locally

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
```

Open [localhost:5173/car-case-league/](http://localhost:5173/car-case-league/). Open the free Junkyard Case and keep the starter car. Win either Rookie League competition or sell spare Junkyard cars to save for a paid Rookie Case. Junkyard can be opened again as soon as the previous result is resolved. Progress is stored in the current browser.

The development server shows **DEV** next to Settings. It can temporarily waive case costs without debiting the wallet, add test coins, or reset development progress. The switch starts off on each page load. Development uses a separate save, and the built game served by `npm run preview` uses the release save.

The public demo temporarily offers **Sandbox** (∞) next to Settings. Enabling it opens an independent garage with unlimited coins for case purchases. Exiting Sandbox or reloading returns to the regular save.

## Build and test

```sh
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run simulate:economy
```

Playwright checks the production build under the GitHub Pages base path and runs the developer tools tests against a separate Vite development server. To explore the production build manually, run `npm run preview` and open [localhost:4173/car-case-league/](http://localhost:4173/car-case-league/).

## Publish a demo

With **Settings → Pages → Source** set to **GitHub Actions**, a push to `main`, including a merged pull request, runs **Publish to GitHub Pages**. The workflow builds the game and runs Vitest and Playwright before uploading `dist/`. It publishes only a successful build of the current `main`.

Check the run in **Actions → Publish to GitHub Pages** and open its deployment link after **Deploy build** succeeds. You can also use **Run workflow** and select `main` to publish manually. The site is available at [osiksq.github.io/car-case-league/](https://osiksq.github.io/car-case-league/).

## Project materials

- [Game Design Document](GDD.md)
- [Repository instructions](AGENTS.md)
- [Alpha 0.3 economy simulation](docs/economy-alpha-0.3.md)
- The fifty car illustrations in `public/cars` are original, generated studio-style Alpha artwork optimized as WebP.
