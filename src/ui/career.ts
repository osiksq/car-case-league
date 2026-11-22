import { careerEvents, leagueIds, leagues, type LeagueId } from '../game/career';
import { cars, events } from '../game/config';
import type { GameState } from '../game/save';
import { carImage, escapeHtml, icon } from './components';

export function careerScreen(game: GameState): string {
  const completed = new Set(game.career.completed);
  const current = game.career.unlocked.at(-1) ?? 'rookie';
  const currentLeague = leagues[current];
  const next = leagueIds[leagueIds.indexOf(current) + 1];
  const currentClears = currentLeague.eventIds.filter((id) => completed.has(id)).length;
  const totalEvents = Object.keys(careerEvents).length;
  const finished = !next && currentClears === currentLeague.eventIds.length;

  return `<section class="career-screen" aria-labelledby="screen-title">
    <h1 id="screen-title" tabindex="-1">Career</h1>
    <div class="career-overview panel" data-league-theme="${current}">
      <div class="career-overview-main">
        <div class="career-emblem" aria-hidden="true">${icon('career')}</div>
        <div class="career-overview-title">
          <p class="career-label">${finished ? 'Career complete' : 'Current league'}</p>
          <h2 data-testid="career-current-league">${escapeHtml(currentLeague.name)}</h2>
          <p>${completed.size} of ${totalEvents} competitions won</p>
        </div>
      </div>
      <div class="career-overview-goal">
        <div class="career-goal-heading">
          <h3>${next ? `Next: ${escapeHtml(leagues[next].name)}` : finished ? 'Final league completed' : 'Complete Elite League'}</h3>
          <span>${currentClears}/${currentLeague.eventIds.length} wins</span>
        </div>
        <progress aria-label="Current league wins" value="${currentClears}" max="${currentLeague.eventIds.length}"></progress>
        <p>${next ? 'Win all competitions in this league to advance.' : finished ? 'Every league badge has been earned.' : 'Win all competitions to earn the final badge.'}</p>
      </div>
    </div>
    <div class="career-leagues">
      ${leagueIds.map((id, index) => {
        const league = leagues[id];
        const wins = league.eventIds.filter((eventId) => completed.has(eventId)).length;
        const cleared = wins === league.eventIds.length;
        const unlocked = game.career.unlocked.includes(id);
        const status = cleared ? 'Completed' : id === current ? 'Current' : unlocked ? 'Unlocked' : 'Locked';
        const previous = leagueIds[index - 1];
        return `<section class="career-league panel" aria-labelledby="career-league-${id}" data-testid="career-league"
          data-league-id="${id}" data-league-theme="${id}" data-league-status="${status.toLowerCase()}">
          <div class="career-league-heading">
            <div class="career-league-title">
              <span class="career-league-icon" aria-hidden="true">${icon(cleared ? 'check' : unlocked ? 'career' : 'lock')}</span>
              <h2 id="career-league-${id}">${escapeHtml(league.name)}</h2>
            </div>
            <span class="career-status">${status}</span>
          </div>
          ${!unlocked && previous ? `<p class="career-lock-rule">Win all competitions in ${escapeHtml(leagues[previous].name)} to unlock.</p>` : ''}
          <ul class="career-events" aria-label="${escapeHtml(league.name)} competitions">
            ${league.eventIds.map((eventId) => {
              const competition = careerEvents[eventId];
              const rivalCar = cars.find((car) => car.id === competition.rivalCarId);
              const won = completed.has(eventId);
              return `<li><button type="button" class="career-event" aria-label="${escapeHtml(competition.name)}"
                aria-describedby="career-event-details-${eventId} career-event-status-${eventId}" data-action="career-event" data-id="${eventId}"${unlocked ? '' : ' disabled'}>
                <span class="career-event-icon" aria-hidden="true">${icon(competition.eventId === 'drag' ? 'bolt' : 'races')}</span>
                <span class="career-event-body">
                  <strong>${escapeHtml(competition.name)}</strong>
                  <span id="career-event-details-${eventId}" class="career-event-details">
                    ${escapeHtml(events[competition.eventId].name)} · ${escapeHtml(competition.rivalName)} · ${escapeHtml(competition.difficulty)}
                  </span>
                </span>
                ${rivalCar ? `<span class="career-event-car">${carImage(rivalCar)}</span>` : ''}
                <span id="career-event-status-${eventId}" class="career-event-status${won ? ' career-event-won' : ''}">
                  ${won ? `${icon('check')} Won` : unlocked ? 'Enter' : `${icon('lock')} Locked`}
                </span>
              </button></li>`;
            }).join('')}
          </ul>
          <div class="career-league-reward">
            ${icon('crest')}
            <span>${cleared ? 'Earned' : 'League reward'} <strong>${escapeHtml(league.badge)}</strong></span>
            <span>${wins}/${league.eventIds.length}</span>
          </div>
        </section>`;
      }).join('')}
    </div>
  </section>`;
}

export function careerAward(leagueId: LeagueId): string {
  const next = leagueIds[leagueIds.indexOf(leagueId) + 1];
  return `<section class="career-award" data-testid="career-award" data-league-theme="${leagueId}" aria-label="Career reward">
    <span aria-hidden="true">${icon('career')}</span>
    <div>
      <h3>${escapeHtml(leagues[leagueId].badge)} earned</h3>
      <p>${next ? `${escapeHtml(leagues[next].name)} unlocked.` : 'All leagues completed.'}</p>
    </div>
  </section>`;
}
