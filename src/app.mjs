import { readPublic } from './read-api.mjs';
import { comparePulse, freshness } from './model.mjs';

export function enhance(document, get = readPublic, now = () => Date.now()) {
  const body = document.body;
  const topicPicker = document.querySelector('[data-topic-picker]');
  const mobile = document.defaultView?.matchMedia?.('(max-width: 760px)');
  if (topicPicker && mobile) {
    const fitTopics = () => { topicPicker.open = !mobile.matches; };
    fitTopics();
    mobile.addEventListener?.('change', fitTopics);
  }
  const observedAt = Number(body.dataset.observedAt);
  const status = freshness(observedAt, now());
  for (const label of document.querySelectorAll('[data-freshness]')) {
    label.textContent = status.label;
    label.classList.toggle('stale', status.stale);
  }
  for(const link of document.querySelectorAll('a[href^="#source-"]')) {
    link.addEventListener('click', () => {
      const details = document.getElementById(link.getAttribute('href').slice(1));
      if(details?.tagName === 'DETAILS') details.open = true;
    });
  }
  const openHash = () => {
    const id = document.defaultView?.location.hash.slice(1);
    if(id?.startsWith('source-')) {
      const details = document.getElementById(id);
      if(details?.tagName === 'DETAILS') details.open = true;
    }
  };
  openHash();
  document.defaultView?.addEventListener('hashchange',openHash);
  const button = document.querySelector('[data-check-activity]');
  const liveStatus = document.querySelector('[data-activity-status]');
  if(!button || !liveStatus) return;
  button.hidden = false;
  let lastAttempt = -Infinity;
  button.addEventListener('click',async () => {
    if(now()-lastAttempt < 60_000) {
      liveStatus.textContent = 'Please allow one minute between checks. The saved edition remains available.';
      return;
    }
    lastAttempt=now(); button.disabled=true;
    liveStatus.textContent='Checking public board activity…';
    try {
      const result = await get('pulse');
      const comparison = comparePulse({latest_post_id:Number(body.dataset.latestPost),latest_comment_id:Number(body.dataset.latestComment),latest_event_id:Number(body.dataset.latestEvent)},result.data?.board);
      liveStatus.textContent = comparison === 'newer'
        ? 'The board has newer activity. These stories remain the saved edition; use the primary sources for the latest record.'
        : comparison === 'unchanged'
          ? 'No newer board activity was reported in this check. The stories remain the saved edition.'
          : 'The source returned an earlier activity marker. Freshness is uncertain; the saved edition is unchanged.';
    } catch {
      liveStatus.textContent='The live check is unavailable. You can keep reading the saved edition and its source links.';
    } finally { button.disabled=false; }
  });
}
if(typeof document !== 'undefined') enhance(document);
