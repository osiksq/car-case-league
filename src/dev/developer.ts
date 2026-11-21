import { economy } from '../game/config';
import { openCase, storageKey, type GameState } from '../game/save';

if (import.meta.env.DEV) void import('./developer.css');

export const developerSaveKey = `${storageKey}.dev`;

export function openDeveloperCase(state: GameState): GameState {
  const purchase = openCase({ ...state, coins: Math.max(state.coins, economy.casePrice) });
  return { ...purchase, coins: state.coins };
}

export function addDeveloperCoins(state: GameState): GameState {
  return { ...state, coins: Math.min(Number.MAX_SAFE_INTEGER, state.coins + 10_000) };
}

export function developerButton(disabled: boolean): string {
  return `<button class="dev-button" type="button" data-action="dev-tools" aria-haspopup="dialog"${disabled ? ' disabled' : ''}>DEV</button>`;
}

export function developerDialog(infiniteMoney: boolean): string {
  return `<dialog class="settings-dialog dev-dialog panel" aria-labelledby="developer-title">
    <div class="panel-heading"><h2 id="developer-title">Developer Tools</h2></div>
    <p>Changes apply to your local development save.</p>
    <button type="button" class="dev-toggle" role="switch" aria-label="Infinite Money" aria-checked="${infiniteMoney}" data-action="dev-money">
      <span>Infinite Money</span><span aria-hidden="true">${infiniteMoney ? 'ON' : 'OFF'}</span>
    </button>
    <div class="dev-actions button-row">
      <button type="button" class="button button-secondary" data-action="dev-add-coins">Add 10,000 Coins</button>
      <button type="button" class="button button-secondary" data-action="dev-reset">Reset Progress</button>
      <button type="button" class="button button-secondary" data-action="dev-close">Close</button>
    </div>
  </dialog>`;
}
