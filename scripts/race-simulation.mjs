import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
try {
  const { cars, events, tactics } = await vite.ssrLoadModule('/src/game/config.ts');
  const { simulateRace } = await vite.ssrLoadModule('/src/game/race.ts');
  const eventIds = ['wet-circuit', 'endurance'];
  const featureCars = [
    'bravik-110', 'petrel-s1', 'kestovan-rx', 'thalven-gt', 'dorsenne-v12',
    'kairox-r', 'sorevik-t9', 'orvane-eclipse',
  ];
  const samples = 8192;
  const headers = eventIds.flatMap((id) => tactics.map((tactic) => `${events[id].name} · ${tactic}`));
  console.log(`Each result uses ${samples} seeds, 0–${samples - 1}, and the normal free-race opponent matching.\n`);
  console.log(`| Model | Rarity / class | ${headers.join(' | ')} |`);
  console.log(`| --- | --- | ${headers.map(() => '---:').join(' | ')} |`);
  for (const id of featureCars) {
    const car = cars.find((candidate) => candidate.id === id);
    if (!car) throw new Error(`Missing simulation car: ${id}`);
    const rates = eventIds.flatMap((eventId) => tactics.map((tactic) => {
      let wins = 0;
      for (let seed = 0; seed < samples; seed++) {
        if (simulateRace('fixture', eventId, tactic, car, seed).won) wins++;
      }
      return `${(100 * wins / samples).toFixed(1)}%`;
    }));
    console.log(`| ${car.name} | ${car.rarity} / ${car.class} | ${rates.join(' | ')} |`);
  }
} finally {
  await vite.close();
}
