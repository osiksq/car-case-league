import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true, ws: false }, appType: 'custom' });
try {
  const { simulateEconomy } = await vite.ssrLoadModule('/scripts/economy-simulation.ts');
  console.log(simulateEconomy());
} finally {
  await vite.close();
}
