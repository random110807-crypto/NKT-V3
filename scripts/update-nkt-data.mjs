import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const API = 'https://api.chess.com/pub';
const SLUG = 'nashediyon-ki-toli-nkt';
const UA = process.env.CHESSCOM_USER_AGENT || 'NKT-Club-Sidebar/1.0 (automated public-data collector)';
const now = new Date();
const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}
async function getJson(url, { attempts = 2, timeoutMs = 10000 } = {}) {
  let last;
  for (let i=0; i<attempts; i++) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
      if (response.status === 304) return null;
      if (response.status === 404 || response.status === 410) return null;
      if (response.status === 429 || response.status >= 500) {
        const retry = Number(response.headers.get('retry-after'));
        await sleep(Number.isFinite(retry) && retry > 0 ? Math.min(10000, retry*1000) : Math.min(8000, 1000*2**i));
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return await response.json();
    } catch (error) {
      last = error;
      if (i < attempts-1) await sleep(Math.min(3000, 500*2**i));
    }
  }
  throw last || new Error(`Request failed: ${url}`);
}
function validNumber(v) { return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null; }
function ratingSet(stats={}) {
  const out = {};
  for (const [key, label] of [['chess_rapid','Rapid'],['chess_blitz','Blitz'],['chess_bullet','Bullet']]) {
    const rating = validNumber(stats?.[key]?.last?.rating);
    if (rating) out[key] = rating;
  }
  return out;
}
function gameTotals(stats={}) {
  const out = { games: 0, wins: 0, losses: 0, draws: 0 };
  for (const key of ['chess_rapid','chess_blitz','chess_bullet']) {
    const record = stats?.[key]?.record || {};
    const w = Math.max(0, Number(record.win)||0), l = Math.max(0, Number(record.loss)||0), d = Math.max(0, Number(record.draw)||0);
    out.wins += w; out.losses += l; out.draws += d;
  }
  out.games = out.wins + out.losses + out.draws;
  return out;
}
function delta(a,b) { return Number.isFinite(a) && Number.isFinite(b) ? b-a : 0; }
function normalise(values, value) {
  const max = Math.max(1, ...values.map(v => Math.max(0, v)));
  return Math.max(0, value) / max;
}
function getMembers(payload) {
  const merged = [...(payload?.weekly||[]), ...(payload?.monthly||[]), ...(payload?.all_time||[])];
  const seen = new Set();
  return merged.filter(x => {
    const u = String(x?.username||'').trim().toLowerCase();
    if (!u || seen.has(u)) return false;
    seen.add(u); return true;
  }).sort((a,b) => Number(b.joined||0)-Number(a.joined||0));
}
function publicProfile(stats, username) {
  const ratings = ratingSet(stats);
  return { username, ratings, games: gameTotals(stats) };
}

await fs.mkdir(DATA, { recursive: true });
const statePath = path.join(DATA, 'nkt-state.json');
const previous = await readJson(statePath, { schema: 1, createdAt: now.toISOString(), members: {}, monthly: {}, matchIds: [] });
const state = { ...previous, members: previous.members || {}, monthly: previous.monthly || {}, matchIds: previous.matchIds || [] };

// Fetch and validate the club endpoints before replacing any previously good dashboard.
const [club, memberPayload, matchPayload] = await Promise.all([
  getJson(`${API}/club/${SLUG}`),
  getJson(`${API}/club/${SLUG}/members`),
  getJson(`${API}/club/${SLUG}/matches`)
]);
if (!club || !memberPayload || !matchPayload) throw new Error('A required club endpoint returned no public data; retaining the previous published dashboard.');
const members = getMembers(memberPayload);
if (!members.length) throw new Error('Club members endpoint returned an empty roster; refusing to publish an empty leaderboard.');

const monthState = state.monthly[monthKey] || { startedAt: now.toISOString(), baselines: {} };
const statsByUser = {};
let processed = 0, failed = 0;
console.log(`Found ${members.length} club members. Collecting player stats (serial requests to respect Chess.com rate limits)…`);
for (let memberIndex = 0; memberIndex < members.length; memberIndex++) {
  const member = members[memberIndex];
  const username = String(member.username).toLowerCase();
  try {
    // Serial requests are intentional: Chess.com warns that parallel traffic can trigger 429s.
    const stats = await getJson(`${API}/player/${encodeURIComponent(username)}/stats`);
    if (!stats) { failed++; continue; }
    const current = publicProfile(stats, username);
    const old = state.members[username];
    const oldGames = old?.games || { games: 0, wins: 0, losses: 0, draws: 0 };
    const lifetimeGameDelta = Math.max(0, current.games.games - oldGames.games);
    const monthlyBaseline = monthState.baselines[username];
    if (!monthlyBaseline) monthState.baselines[username] = { ratings: current.ratings, games: current.games.games, firstSeenAt: now.toISOString() };
    const base = monthState.baselines[username];
    const formatChanges = {};
    for (const key of ['chess_rapid','chess_blitz','chess_bullet']) {
      if (Number.isFinite(base.ratings?.[key]) && Number.isFinite(current.ratings?.[key])) formatChanges[key] = current.ratings[key] - base.ratings[key];
    }
    const comparable = Object.values(formatChanges);
    const ratingChange = comparable.length ? comparable.reduce((a,b)=>a+b,0) : null;
    const winDelta = Math.max(0, current.games.wins - oldGames.wins);
    const lossDelta = Math.max(0, current.games.losses - oldGames.losses);
    const drawDelta = Math.max(0, current.games.draws - oldGames.draws);
    const activity = { games: winDelta + lossDelta + drawDelta, wins: winDelta, losses: lossDelta, draws: drawDelta };
    statsByUser[username] = { ...current, joined: Number(member.joined)||null, monthly: { ratingChange, formatChanges, games: activity.games, wins: activity.wins, losses: activity.losses, draws: activity.draws } };
    state.members[username] = { ratings: current.ratings, games: current.games, lastSeenAt: now.toISOString(), joined: Number(member.joined)||null };
    processed++;
  } catch (error) {
    failed++;
    // Preserve the last known state for a member if a transient request fails.
    const old = state.members[username];
    if (old) statsByUser[username] = { username, ratings: old.ratings||{}, games: old.games||{}, joined: Number(member.joined)||null, monthly: { ratingChange: null, formatChanges: {}, games: 0, wins: 0, losses: 0, draws: 0 }, stale: true };
    console.warn(`Could not refresh ${username}: ${error.message}`);
  }
  if ((memberIndex + 1) % 10 === 0 || memberIndex + 1 === members.length) console.log(`Player stats progress: ${memberIndex + 1}/${members.length} (success ${processed}, failed ${failed})`);
  await sleep(150);
}
if (processed < Math.min(5, Math.ceil(members.length * 0.35))) throw new Error(`Only ${processed}/${members.length} member stats succeeded; refusing to publish an unreliable snapshot.`);
state.monthly[monthKey] = monthState;

const rows = Object.values(statsByUser).filter(x => !x.stale);
const raceRows = rows.filter(x => Number.isFinite(x.monthly.ratingChange) && x.monthly.ratingChange !== 0).sort((a,b)=>b.monthly.ratingChange-a.monthly.ratingChange).map((x,i)=>({ rank:i+1, username:x.username, ratingChange:x.monthly.ratingChange, formats:x.monthly.formatChanges, games:x.monthly.games }));
const overallRaw = rows.filter(x => (Number(x.monthly.ratingChange)||0) !== 0 || (Number(x.monthly.games)||0) > 0).map(x => ({
  ...x,
  ratingMetric: Math.max(0, Number(x.monthly.ratingChange)||0),
  gamesMetric: Math.max(0, Number(x.monthly.games)||0),
  winRate: x.monthly.games ? x.monthly.wins/x.monthly.games : 0
}));
const ratingValues = overallRaw.map(x=>x.ratingMetric), gameValues = overallRaw.map(x=>x.gamesMetric), winValues = overallRaw.map(x=>x.winRate);
const overallRows = overallRaw.map(x=>({
  username:x.username,
  ratingChange:x.monthly.ratingChange,
  games:x.monthly.games,
  wins:x.monthly.wins,
  losses:x.monthly.losses,
  draws:x.monthly.draws,
  // Member-level match participation is not exposed by the club matches endpoint.
  score: Math.round((normalise(ratingValues,x.ratingMetric)*50 + normalise(gameValues,x.gamesMetric)*35 + normalise(winValues,x.winRate)*15)*10)/10,
  scoreBasis: 'rating progress 50% · game activity 35% · game win rate 15%'
})).sort((a,b)=>b.score-a.score).map((x,i)=>({...x,rank:i+1}));

const matchBuckets = ['registered','in_progress','finished'];
const matches = matchBuckets.flatMap(status => (matchPayload?.[status]||[]).map(m=>({
  id: m['@id'] || `${m.name||'match'}-${m.start_time||''}`,
  name: m.name || 'Club team match',
  opponent: typeof m.opponent === 'string' ? m.opponent.split('/').filter(Boolean).at(-1) : null,
  result: m.result || null,
  startTime: Number(m.start_time)||null,
  timeClass: m.time_class || null,
  status
}))).sort((a,b)=>(b.startTime||0)-(a.startTime||0));
const finished = matches.filter(m=>m.status==='finished');
const clubRecord = finished.reduce((r,m)=>{ if(m.result==='win')r.wins++; else if(m.result==='loss')r.losses++; else if(m.result==='draw')r.draws++; return r; },{wins:0,losses:0,draws:0});

// Recent joiners are based on the public joined timestamp, not the activity buckets.
const recentMembers = members.slice(0,3).map(m=>({ username:m.username, joined:Number(m.joined)||null }));
const topImproved = [...raceRows].filter(x=>x.ratingChange>0).sort((a,b)=>b.ratingChange-a.ratingChange)[0] || null;
const dashboard = {
  schema: 2,
  generatedAt: now.toISOString(),
  source: 'Chess.com PubAPI',
  club: { name: club.name || 'Nashediyon Ki Toli', slug: SLUG, memberCount: Number(club.members_count)||members.length, dailyRating: Number(club.average_daily_rating)||null, url: `https://www.chess.com/club/${SLUG}` },
  freshness: { memberRoster: 'Chess.com may cache public endpoint responses for up to 12 hours.', playerStatsProcessed: processed, playerStatsFailed: failed, membersTotal: members.length },
  recentMembers,
  monthlyRace: { month: monthKey, startedAt: monthState.startedAt, eligibleCount: raceRows.length, rows: raceRows.slice(0,50) },
  overallLeaderboard: { month: monthKey, methodology: 'Automated member score: rating progress 50%, games played 35%, game win rate 15%. Individual team-match participation is not exposed by the public club matches endpoint and is not included.', rows: overallRows.slice(0,50) },
  clubMatches: { record: clubRecord, totals: { registered: matches.filter(m=>m.status==='registered').length, inProgress: matches.filter(m=>m.status==='in_progress').length, finished: finished.length }, matches: matches.slice(0,30), limitation: 'Club-level match results only; the public endpoint does not identify individual member contributions.' },
  mostImprovedMember: topImproved,
  notes: { history: 'Tracking begins at first successful automation run. New members become eligible after their first successful baseline snapshot.', unsupported: ['MCA points leaderboard','Vote Chess points leaderboard','individual club-match contribution leaderboard'] }
};

state.updatedAt = now.toISOString();
state.lastSuccessfulMonth = monthKey;
await writeJson(statePath, state);
await writeJson(path.join(DATA,'nkt-dashboard.json'), dashboard);
console.log(`Published NKT dashboard: ${processed}/${members.length} player stats; ${raceRows.length} monthly rating entries; ${matches.length} club matches.`);
