import type { Car, Rarity, Stat } from '../game/config';
import { rarities } from '../game/config';

const iconPaths = {
  logo: '<path d="m4 16 4-8h12l2 4H11l-2 4H4Zm4 0-2 3h10l2-3M11 6h8"/>',
  cases: '<rect x="3" y="6" width="18" height="14" rx="3"/><path d="M8 6V4h8v2M3 13h18m-11 0v2h4v-2"/>',
  garage: '<path d="m3 11 9-7 9 7v9H3v-9Z"/><path d="M7 20v-7h10v7m-10-3h10"/>',
  races: '<path d="M4 21V4m0 1c5-4 10 4 16 0v10c-6 4-11-4-16 0m5-10v5m5 0v5m-5-5v4"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M9 12h6m-3-3v6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m10 3-.5 2.5L7 7l-2.5-.7L3 9l2 2v2l-2 2 1.5 2.7L7 17l2.5 1.5L10 21h4l.5-2.5L17 17l2.5.7L21 15l-2-2v-2l2-2-1.5-2.7L17 7l-2.5-1.5L14 3h-4Z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z"/>',
  crest: '<path d="m3 7 4 3 5-6 5 6 4-3-2 11H5L3 7Zm3 8h12"/>',
};

const statNames: Record<Stat, string> = {
  speed: 'Speed',
  acceleration: 'Acceleration',
  handling: 'Handling',
  reliability: 'Reliability',
};

export const statEntries = Object.entries(statNames) as [Stat, string][];
export const rarityClass = (rarity: Rarity) => 'rarity-' + rarity.toLowerCase();
export const carStyle = (car: Car) => `${rarityClass(car.rarity)}${car.class === 'Collector' ? ' collector' : ''}`;
export const icon = (name: keyof typeof iconPaths) =>
  `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name]}</svg>`;

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export const rarityBadge = (rarity: Rarity) => `<span class="rarity-badge ${rarityClass(rarity)}">${rarity}</span>`;
export const carImage = (car: Car, eager = false) =>
  `<img src="${import.meta.env.BASE_URL}cars/${car.artIndex}.webp" alt="" width="384" height="260" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} draggable="false">`;
export const money = (value: number) => value.toLocaleString('en-US');

export function pageHeading(eyebrow: string, title: string, description: string) {
  return `<header class="screen-header">
    <p class="eyebrow">${eyebrow}</p>
    <h1 tabindex="-1" id="screen-title">${title}</h1>
    <p class="screen-description">${description}</p>
  </header>`;
}

export function carStats(car: Car) {
  return `<dl class="stats-list">
    ${statEntries.map(([stat, label]) => `<div class="stat-row">
      <dt>${label}</dt>
      <dd>
        <span class="stat-track" aria-hidden="true"><span style="--stat-value:${car.stats[stat]}%"></span></span>
        <span class="stat-value">${car.stats[stat]}</span>
      </dd>
    </div>`).join('')}
  </dl>`;
}

export function carCard(car: Car, options: { actions?: string; stats?: boolean; selected?: boolean } = {}) {
  return `<article class="car-card ${carStyle(car)}${options.selected ? ' is-selected' : ''}"${options.actions ? ' data-testid="garage-car"' : ''}>
    <div class="car-art">
      ${carImage(car)}
      <div class="car-art-badges">${rarityBadge(car.rarity)}${options.selected ? '<span class="selected-badge">Selected</span>' : ''}</div>
    </div>
    <div class="car-details">
      <div class="car-card-heading"><h3>${escapeHtml(car.name)}</h3><span class="car-class">${car.class}</span></div>
      ${options.stats ? carStats(car) : ''}
      ${options.actions ?? ''}
    </div>
  </article>`;
}

export function oddsTable(odds: Record<Rarity, number>) {
  return `<ul class="odds-list">${rarities.map((rarity) =>
    `<li${odds[rarity] === 0 ? ' class="odds-unavailable"' : ''}>${rarityBadge(rarity)}<span class="odds-percent">${odds[rarity]}%</span></li>`
  ).join('')}</ul>`;
}
