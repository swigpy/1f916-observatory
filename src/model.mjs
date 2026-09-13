// Presentation only. Keep source bytes and deterministic source fields intact.
export function displayText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '');
}
export function escapeHtml(value) {
  return displayText(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
export function validId(value) { return Number.isSafeInteger(value) && value > 0; }
export function validTime(value) { return Number.isSafeInteger(value) && value > 0 && value <= 8_640_000_000_000_000; }
export function publicText(value, limit = 10000) {
  if (typeof value !== 'string' || value.length > limit) throw new Error('Invalid public text');
  return value;
}
export function excerpt(body, words = 22) {
  const parts = displayText(publicText(body)).trim().split(/\s+/);
  return parts.slice(0, words).join(' ') + (parts.length > words ? ' …' : '');
}
export function references(body) {
  return [...new Set([...publicText(body).matchAll(/(?:^|[\s(])#([1-9]\d{0,9})\b/g)].map(m => Number(m[1])))].sort((a,b) => a-b);
}
function checkRow(row) {
  if (!row || !validId(row.id) || !validTime(row.created_at)) throw new Error('Invalid source row');
  publicText(row.author, 80);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(row.author)) throw new Error('Unsupported public handle');
}
export function normalizeThread(payload) {
  if (!payload || !payload.post || !Array.isArray(payload.comments)) throw new Error('Invalid thread response');
  if(typeof payload.has_more!=='boolean' || !Number.isSafeInteger(payload.comments_total) || payload.comments_total<payload.comments.length) throw new Error('Invalid thread completeness metadata');
  const p = payload.post; checkRow(p);
  if (p.mod_state) throw new Error('Selected post is moderated; editorial review required');
  publicText(p.title, 300); publicText(p.body);
  if (!validTime(payload.now)) throw new Error('Missing source time');
  const seen = new Set();
  const comments = payload.comments.filter(c => !c.mod_state).map(c => {
    checkRow(c); publicText(c.body);
    if (seen.has(c.id)) throw new Error('Duplicate comment id');
    seen.add(c.id);
    return { id:c.id, author:c.author, author_model:c.author_model ?? null, created_at:c.created_at,
      parent_id:c.parent_id ?? null, intended_parent_id:c.intended_parent_id ?? null, body:c.body, votes:c.votes ?? null };
  }).sort((a,b) => a.created_at-b.created_at || a.id-b.id);
  return { id:p.id, title:p.title, body:p.body, author:p.author, author_model:p.author_model ?? null,
    created_at:p.created_at, votes:p.votes ?? null, observed_at:payload.now,
    comments_total:payload.comments_total, has_more:payload.has_more === true, comments, references:references(p.body) };
}
export function derive(threads, stories) {
  const sources = new Map(); const posts = new Map(); const edges = [];
  for (const t of threads) {
    if (posts.has(t.id)) throw new Error('Duplicate post');
    posts.set(t.id,t); sources.set(`p${t.id}`,{...t,kind:'post',post_id:t.id});
    const byId = new Map(t.comments.map(c=>[c.id,c]));
    for (const c of t.comments) {
      if (sources.has(`c${c.id}`)) throw new Error('Duplicate comment across threads');
      sources.set(`c${c.id}`,{...c,kind:'comment',post_id:t.id});
      const target = c.parent_id === null ? t.author : byId.get(c.parent_id)?.author;
      if (target && target !== c.author) edges.push({from:c.author,to:target,comment_id:c.id,post_id:t.id});
    }
  }
  const dossiers = stories.map(s => {
    if (!/^[a-z0-9-]+$/.test(s.slug)) throw new Error('Invalid story slug');
    const selectedPosts = s.posts.map(id => {if(!posts.has(id)) throw new Error(`Missing post ${id}`);return posts.get(id);});
    for(const event of [...s.events,...s.perspectives]) for(const ref of event.sources) {
      const source = sources.get(ref);
      if (!source || !s.posts.includes(source.post_id)) throw new Error(`Missing or out-of-scope source ${ref}`);
    }
    for(const e of s.events) if(!sources.has(e.at) || !e.sources.includes(e.at)) throw new Error('Missing or mismatched timeline anchor');
    if(!sources.has(s.latest.source) || !s.events.some(e=>e.at===s.latest.source)) throw new Error('Missing latest source');
    if(sources.get(s.latest.source).created_at!==Math.max(...s.events.map(e=>sources.get(e.at).created_at))) throw new Error('Latest turn does not match selected chronology');
    const events = [...s.events].sort((a,b) => sources.get(a.at).created_at-sources.get(b.at).created_at || a.at.localeCompare(b.at));
    const handles = new Set(selectedPosts.flatMap(t => [t.author,...t.comments.map(c=>c.author)]));
    for(const person of s.people) if(!handles.has(person.handle)) throw new Error('Citizen has no contribution in this story');
    return {...s,events,post_count:selectedPosts.length,comment_count:selectedPosts.reduce((n,t)=>n+t.comments.length,0),
      participant_count:handles.size,latest_at:sources.get(s.latest.source).created_at,checked_at:Math.min(...selectedPosts.map(t=>t.observed_at)),
      complete_threads:selectedPosts.every(t=>!t.has_more),citations:selectedPosts.flatMap(t=>t.references.filter(id=>s.posts.includes(id)).map(id=>({from:t.id,to:id}))) };
  });
  return {stories:dossiers,sources,posts,edges};
}
export function replyPartners(handle, edges, postIds) {
  const counts = new Map();
  for(const edge of edges) {
    if (!postIds.includes(edge.post_id)) continue;
    const other = edge.from === handle ? edge.to : edge.to === handle ? edge.from : null;
    if(other) counts.set(other,(counts.get(other) ?? 0)+1);
  }
  return [...counts].map(([handle,count])=>({handle,count})).sort((a,b)=>b.count-a.count || a.handle.localeCompare(b.handle));
}
export function freshness(observedAt, now = Date.now()) {
  if (!validTime(observedAt) || !validTime(now)) return { stale:true, label:'Date unavailable' };
  if(observedAt > now+300000) return {stale:true,label:'Source clock is ahead'};
  const date = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(observedAt));
  return {stale:false,label:`Saved ${date}`};
}
export function comparePulse(baseline, current) {
  const keys=['latest_post_id','latest_comment_id','latest_event_id'];
  if(!baseline || !current || keys.some(k=>!Number.isSafeInteger(baseline[k]) || !Number.isSafeInteger(current[k]) || current[k]<0)) throw new Error('Unexpected activity response');
  if(keys.some(k=>current[k]<baseline[k])) return 'uncertain';
  return keys.some(k=>current[k]>baseline[k]) ? 'newer' : 'unchanged';
}
