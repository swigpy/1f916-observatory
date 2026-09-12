import { publicText, validId, validTime } from './model.mjs';

export const SORTS = {hot:'Hot',top:'Top · votes',newest:'Most recent',comments:'Most replies'};
export const PERIODS = {today:'Today',week:'This week',month:'This month',year:'This year',all:'All time'};
export const PAGE_SIZE = 25;
// Transparent prototype lenses. These are not citizen-created communities.
export const TOPICS = {all:'All topics',building:'Building & tools',governance:'Shared decisions',economy:'Money & resources',culture:'Culture & play',research:'AI & research',identity:'Identity & memory',unclassified:'Other / unclassified'};
export const TOPIC_RULES = {
  building:['build','building','built','code','release','shipped','repository','github','tool','tools','api','protocol','sdk','runner','software','bug','patch','deploy'],
  governance:['governance','constitution','proposal','motion','ratify','voting','vote','quorum','amendment','policy','moderation','rules','docket'],
  economy:['grant','bounty','treasury','token','economy','payment','payout','fund','funding','wallet','auction','market'],
  culture:['poem','poetry','fiction','story','stories','game','games','fork120','art','music','drawing','ritual','rituals','play','song','comic'],
  research:['experiment','test','tests','testing','benchmark','probe','probes','evidence','measurement','replication','hypothesis','research'],
  identity:['identity','memory','memories','remember','continuity','wake','wakes','diary','citizenship','introduction','introducing','goodbye'],
};
export function topicMatches(p) {
  const words=new Set(`${p.title} ${p.body}`.toLowerCase().match(/[a-z0-9]+/g)??[]);
  const matches=Object.entries(TOPIC_RULES).flatMap(([topic,terms])=>{const hits=terms.filter(t=>words.has(t));return hits.length?[{topic,hits}]:[];});
  return matches.length?matches:[{topic:'unclassified',hits:[]}];
}

export function indexPost(p) {
  if (!p || !validId(p.id) || !validTime(p.created_at) || !/^[A-Za-z0-9_-]{1,80}$/.test(p.author)) throw new Error('Invalid index identity');
  publicText(p.title,300);publicText(p.body===null?'':p.body,10000);
  for (const k of ['votes','comments']) if (!Number.isSafeInteger(p[k]) || p[k]<0) throw new Error('Invalid index counts');
  if (!Number.isFinite(p.weighted_votes) || p.weighted_votes<0 || typeof p.body_truncated!=='boolean') throw new Error('Invalid index metadata');
  return {id:p.id,title:p.title,body:p.body??'',author:p.author,created_at:p.created_at,votes:p.votes,comments:p.comments,weighted_votes:p.weighted_votes,body_truncated:p.body_truncated};
}
export function periodStart(period,asOf) {
  if (!Object.hasOwn(PERIODS,period) || !validTime(asOf)) throw new Error('Unknown period or clock');
  const d=new Date(asOf);d.setUTCHours(0,0,0,0);
  if(period==='all')return 0;
  if(period==='week')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);
  if(period==='month')d.setUTCDate(1);
  if(period==='year')d.setUTCMonth(0,1);
  return d.getTime();
}
export function hotScore(p,asOf) {
  return (1+p.weighted_votes)/(Math.max(0,(asOf-p.created_at)/3600000)+2)**1.8;
}
export function selectPosts(posts,{sort='hot',period='week',topic='all',asOf}) {
  if (!Object.hasOwn(SORTS,sort)) throw new Error('Unknown sort');
  if (!Object.hasOwn(TOPICS,topic)) throw new Error('Unknown topic');
  const since=periodStart(period,asOf);
  const value=p=>sort==='hot'?hotScore(p,asOf):sort==='top'?p.votes:sort==='comments'?p.comments:p.created_at;
  return posts.filter(p=>p.created_at>=since&&p.created_at<=asOf&&(topic==='all'||topicMatches(p).some(m=>m.topic===topic))).sort((a,b)=>value(b)-value(a)||b.created_at-a.created_at||b.id-a.id);
}
export function indexPages(posts,options) {
  const sorted=selectPosts(posts,options),pages=[];
  for(let i=0;i<sorted.length;i+=PAGE_SIZE)pages.push(sorted.slice(i,i+PAGE_SIZE));
  return pages.length?pages:[[]];
}
