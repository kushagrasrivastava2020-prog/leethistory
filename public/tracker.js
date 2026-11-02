// Draws the 120-day plan and keeps every box, count and map cell in step with the ticks
import { DAYS, PHASES, PROJECTS } from './plan.js';

const HIDE_KEY = 'service-to-product.hide-done';
const $ = id => document.getElementById(id);
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dayId = (n, i) => `d${String(n).padStart(3, '0')}-${i + 1}`;
const projId = (n, i) => `p${n}-${i + 1}`;
const isReview = d => d.title.includes('REVIEW');
const isMilestone = d => d.desc.startsWith('MILESTONE:');
const cellClass = d => (isReview(d) ? ' review' : '') + (isMilestone(d) ? ' milestone' : '');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TOTAL_DAILY = DAYS.reduce((sum, d) => sum + d.tasks.length, 0);
const TOTAL_PROJ = PROJECTS.reduce((sum, p) => sum + p.tasks.length, 0);

let ticks = {};
let heroDay = 1;
let heroTimer = null;

const STATUS = {
  loading: ['Loading your progress…', 'wait'],
  saving: ['Saving…', 'wait'],
  saved: ['Saved', 'ok'],
  offline: ['Offline, will save when back', 'warn'],
  failed: ['Not saved, reload and try again', 'warn'],
};

export function setStatus(name) {
  const [text, tone] = STATUS[name];
  $('statusText').textContent = text;
  $('status').dataset.tone = tone;
}

function taskText(t) {
  const m = t.match(/^(Learn|Study|Code|Solve|Write|Design|Draw|Deep dive|Compare|Refactor|M[1-6]):?\s(.*)$/);
  return m ? `<b>${esc(m[1])}${m[1].startsWith('M') && m[1].length === 2 ? '' : ':'}</b> ${esc(m[2])}` : esc(t);
}

function box(prefix, id, text) {
  return `<li class="task"><label for="${prefix}${id}"><input type="checkbox" id="${prefix}${id}" data-t="${id}"><span>${taskText(text)}</span></label></li>`;
}

function dayCard(d, prefix) {
  const kind = isReview(d) ? ' review' : '';
  const body = isMilestone(d)
    ? `<p class="flag">${esc(d.desc)}</p>`
    : `<p class="desc">${esc(d.desc)}</p>`;
  return `<article class="day${kind}" data-day="${d.n}">
    <div class="day-head"><span class="n">DAY ${String(d.n).padStart(2, '0')}</span><h3>${esc(d.title)}</h3><span class="count"></span></div>
    <div class="day-body">${body}<ul>${d.tasks.map((t, i) => box(prefix, dayId(d.n, i), t)).join('')}</ul></div>
  </article>`;
}

function projectCard(p) {
  return `<article class="day big" data-project="${p.n}">
    <div class="day-head"><span class="n">PROJECT ${p.n}</span><h3>${esc(p.name)}, ${esc(p.sub)}</h3><span class="count"></span></div>
    <div class="day-body"><p class="desc">${esc(p.plan)}</p><ul>${p.tasks.map((t, i) => box('', projId(p.n, i), t)).join('')}</ul></div>
  </article>`;
}

function build() {
  $('map').innerHTML = PHASES.map(p => `
    <div class="map-row">
      <div class="map-head"><span>Phase ${p.n} <em>${esc(p.name.split(':')[0])}</em></span><span class="count" data-phase-count="${p.n}"></span></div>
      <div class="cells">${DAYS.slice(p.from - 1, p.to).map(d =>
        `<button class="cell${cellClass(d)}" type="button" data-go="${d.n}">${d.n}</button>`).join('')}</div>
    </div>`).join('');

  $('phases').innerHTML = PHASES.map(p => `
    <section class="phase" data-phase="${p.n}">
      <div class="ph-head">
        <div class="ph-eyebrow"><p class="label">Phase ${p.n} | Days ${p.from} to ${p.to}</p><span class="count" data-phase-count="${p.n}"></span></div>
        <h3>${esc(p.name)}</h3>
        <p>${esc(p.blurb)}</p>
      </div>
      <div class="grid">${DAYS.slice(p.from - 1, p.to).map(d => dayCard(d, '')).join('')}</div>
    </section>`).join('');

  $('projectCards').innerHTML = PROJECTS.map(projectCard).join('');
}

function firstOpenDay() {
  const d = DAYS.find(d => d.tasks.some((_, i) => !ticks[dayId(d.n, i)]));
  return d ? d.n : 0;
}

function renderHero() {
  const d = DAYS[heroDay - 1];
  $('next').innerHTML = d
    ? `<div class="big">${dayCard(d, 'next-')}</div>`
    : `<p class="alldone">All 120 days done. Keep momentum: 1 mock + 2 problems daily until offers.</p>`;
  $('jump').hidden = !d;
  if (d) $('jump').textContent = `Day ${d.n}`;
}

function paint(jumpToNext) {
  document.querySelectorAll('input[data-t]').forEach(b => { b.checked = !!ticks[b.dataset.t]; });

  const next = firstOpenDay();
  let daily = 0, daysDone = 0;
  const perDay = {};
  for (const d of DAYS) {
    const done = d.tasks.filter((_, i) => ticks[dayId(d.n, i)]).length;
    perDay[d.n] = done;
    daily += done;
    if (done === d.tasks.length) daysDone++;
  }

  document.querySelectorAll('.day[data-day]').forEach(card => {
    const d = DAYS[card.dataset.day - 1];
    card.classList.toggle('done', perDay[d.n] === d.tasks.length);
    card.querySelector('.count').textContent = `${perDay[d.n]}/${d.tasks.length}`;
  });
  document.querySelectorAll('.cell[data-go]').forEach(cell => {
    const d = DAYS[cell.dataset.go - 1];
    const done = perDay[d.n];
    cell.style.setProperty('--f', done / d.tasks.length);
    cell.classList.toggle('full', done === d.tasks.length);
    cell.classList.toggle('next', d.n === next);
    cell.setAttribute('aria-label', `Day ${d.n}, ${d.title.toLowerCase()}, ${done} of ${d.tasks.length} done`);
  });

  for (const p of PHASES) {
    const days = DAYS.slice(p.from - 1, p.to);
    const done = days.reduce((sum, d) => sum + perDay[d.n], 0);
    const total = days.reduce((sum, d) => sum + d.tasks.length, 0);
    document.querySelectorAll(`[data-phase-count="${p.n}"]`).forEach(el => { el.textContent = `${done}/${total}`; });
    document.querySelector(`.phase[data-phase="${p.n}"]`).classList.toggle('finished', done === total);
  }

  let proj = 0;
  for (const p of PROJECTS) {
    const done = p.tasks.filter((_, i) => ticks[projId(p.n, i)]).length;
    proj += done;
    const card = document.querySelector(`[data-project="${p.n}"]`);
    card.classList.toggle('done', done === p.tasks.length);
    card.querySelector('.count').textContent = `${done}/${p.tasks.length}`;
  }

  const all = TOTAL_DAILY + TOTAL_PROJ;
  const pct = (daily + proj) / all * 100;
  $('pct').textContent = `${pct > 0 && pct < 1 ? '<1' : Math.floor(pct)}%`;
  $('totals').textContent = `${daily + proj} of ${all} boxes ticked`;
  $('bar').style.width = `${pct}%`;
  $('sDays').textContent = `${daysDone}/${DAYS.length}`;
  $('sTasks').textContent = `${daily}/${TOTAL_DAILY}`;
  $('sProj').textContent = `${proj}/${TOTAL_PROJ}`;
  $('projCount').textContent = `${proj}/${TOTAL_PROJ}`;

  // Leave a just-finished day on screen for a moment before the next one takes its place
  clearTimeout(heroTimer);
  if (next !== heroDay) {
    const move = () => { heroDay = next; renderHero(); paint(); };
    if (jumpToNext) move(); else heroTimer = setTimeout(move, 800);
  }
}

function goToDay(n) {
  const card = document.querySelector(`#phases .day[data-day="${n}"]`);
  if (card.classList.contains('done') && $('hide').checked) {
    $('hide').checked = false;
    applyHide();
  }
  card.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
  card.classList.remove('flash');
  void card.offsetWidth;
  card.classList.add('flash');
}

function applyHide() {
  document.body.classList.toggle('hide-done', $('hide').checked);
  try { localStorage.setItem(HIDE_KEY, $('hide').checked ? '1' : ''); } catch { /* storage blocked */ }
}

export function loginMapCells() {
  return DAYS.map(d => `<span class="cell${cellClass(d)}">${d.n}</span>`).join('');
}

export function setTicks(next, jumpToNext) {
  ticks = next;
  paint(jumpToNext);
}

export function startTracker(onToggle) {
  build();
  renderHero();
  paint();
  try { $('hide').checked = localStorage.getItem(HIDE_KEY) === '1'; } catch { /* storage blocked */ }
  document.body.classList.toggle('hide-done', $('hide').checked);

  document.addEventListener('change', e => {
    const id = e.target.dataset.t;
    if (!id) return;
    ticks = { ...ticks, [id]: e.target.checked };
    paint();
    onToggle(id, e.target.checked);
  });
  document.addEventListener('click', e => {
    const cell = e.target.closest('[data-go]');
    if (cell) goToDay(+cell.dataset.go);
  });
  const toTop = () => scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
  $('toTop').addEventListener('click', toTop);
  $('jump').addEventListener('click', toTop);
  $('hide').addEventListener('change', applyHide);
}
