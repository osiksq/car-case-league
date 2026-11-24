import type { AudioSettings } from './audio';
import { icon } from './components';

const controls = [
  ['master', 'Master Volume'],
  ['engine', 'Engine Volume'],
  ['effects', 'Effects Volume'],
] as const;

export function soundButton(settings: AudioSettings, expanded: boolean) {
  const audible = settings.enabled && settings.master > 0;
  return `<button class="settings-button sound-button" type="button" data-action="sound"
    aria-label="Sound" aria-controls="sound-dialog" aria-expanded="${expanded}" aria-haspopup="dialog"
    title="Sound${audible ? '' : ' (muted)'}" data-audible="${audible}">${icon(audible ? 'audio' : 'mute')}</button>`;
}

export function syncSoundButton(root: ParentNode, settings: AudioSettings, expanded: boolean) {
  const button = root.querySelector<HTMLButtonElement>('[data-action="sound"]');
  if (!button) return;
  const audible = settings.enabled && settings.master > 0;
  button.setAttribute('aria-expanded', String(expanded));
  if (button.dataset.audible !== String(audible)) {
    button.dataset.audible = String(audible);
    button.title = audible ? 'Sound' : 'Sound (muted)';
    button.innerHTML = icon(audible ? 'audio' : 'mute');
  }
}

export function createSoundPanel(onChange: (settings: AudioSettings, trusted: boolean) => void, onClose: () => void) {
  const panel = document.createElement('dialog');
  panel.id = 'sound-dialog';
  panel.className = 'sound-panel panel';
  panel.setAttribute('aria-labelledby', 'sound-title');
  panel.innerHTML = `<div class="sound-panel-heading">
    <h2 id="sound-title">${icon('audio')} Sound</h2>
    <form method="dialog"><button class="button button-secondary" type="submit">Close</button></form>
  </div>
  <button type="button" class="sound-toggle" role="switch" aria-label="Sound" aria-checked="true">
    <span>Sound</span><strong data-sound-status>ON</strong>
  </button>
  ${controls.map(([key, label]) => `<div class="sound-channel">
    <label for="sound-${key}">${label}</label><output for="sound-${key}" aria-hidden="true"></output>
    <input id="sound-${key}" type="range" min="0" max="100" step="1">
  </div>`).join('')}
  <a class="sound-credits" href="${import.meta.env.BASE_URL}audio/credits.html" target="_blank" rel="noopener noreferrer">Audio credits</a>`;
  const toggle = panel.querySelector<HTMLButtonElement>('.sound-toggle')!;
  const status = panel.querySelector<HTMLElement>('[data-sound-status]')!;
  let settings: AudioSettings;
  const levels = controls.map(([key]) => ({
    key,
    input: panel.querySelector<HTMLInputElement>(`#sound-${key}`)!,
    output: panel.querySelector<HTMLOutputElement>(`output[for="sound-${key}"]`)!,
  }));

  function sync(next: AudioSettings) {
    settings = next;
    toggle.setAttribute('aria-checked', String(settings.enabled));
    status.textContent = settings.enabled ? 'ON' : 'OFF';
    for (const { key, input, output } of levels) {
      input.value = String(settings[key]);
      const text = `${settings[key]}%`;
      output.value = text;
      input.setAttribute('aria-valuetext', text);
    }
  }

  function change(next: AudioSettings, event: Event) {
    sync(next);
    onChange(next, event.isTrusted);
  }

  toggle.addEventListener('click', (event) => change({ ...settings, enabled: !settings.enabled }, event));
  for (const { key, input } of levels) {
    input.addEventListener('input', (event) => change({ ...settings, [key]: input.valueAsNumber }, event));
  }
  panel.addEventListener('close', onClose);
  document.body.append(panel);
  return { panel, sync };
}
