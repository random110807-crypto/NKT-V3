const byId = id => document.getElementById(id);
const el = (tag, cls, value) => { const n=document.createElement(tag); if(cls)n.className=cls; if(value!==undefined)n.textContent=value; return n; };
function personLink(username, label=username) {
  const a=el('a','clubhouse-user',label || `@${username}`);
  if(username){a.href=`https://www.chess.com/member/${encodeURIComponent(username)}`;a.target='_blank';a.rel='noopener noreferrer';}
  return a;
}
function section(root,title){const s=el('section','clubhouse-section');s.append(el('h3','clubhouse-subtitle',title));root.append(s);return s;}
function renderBoard(root,title,rows,valueLabel='pts',podium=false){
  if(!Array.isArray(rows)||!rows.length)return;
  const s=section(root,title);
  if(podium){const wrap=el('div','podium');[1,0,2].forEach(i=>{const r=rows[i];if(!r)return;const p=el('div',`podium-place place-${i+1}`);p.append(el('span','podium-rank',String(i+1)),personLink(r.username),el('strong','podium-points',`${Number(r.score??r.ratingChange??0)>0?'+':''}${Number(r.score??r.ratingChange??0).toFixed(1)} ${valueLabel}`),el('span','podium-block',i===0?'CHAMPION':`P${i+1}`));wrap.append(p);});s.append(wrap);return;}
  const list=el('div','clubhouse-board');rows.slice(0,10).forEach((r,i)=>{const line=el('div','clubhouse-board-row');const val=Number(r[valueLabel==='pts'?'score':'ratingChange']??0);line.append(el('b','board-rank',`#${i+1}`),personLink(r.username),el('strong','board-points',`${val>0?'+':''}${Number.isInteger(val)?val:val.toFixed(1)} ${valueLabel}`));list.append(line);});s.append(list);
}
function renderMatches(root,data){
  const s=section(root,'NKT TEAM MATCH RECORD');
  const r=data?.record||{wins:0,losses:0,draws:0};
  const summary=el('p','competition-description',`Finished matches: ${data?.totals?.finished||0} · Wins ${r.wins||0} · Losses ${r.losses||0} · Draws ${r.draws||0}`);s.append(summary);
  const list=el('div','clubhouse-board');
  (data?.matches||[]).slice(0,8).forEach(m=>{const row=el('div','clubhouse-board-row');const date=m.startTime?new Date(m.startTime*1000).toLocaleDateString():'Date pending';const opponent=m.opponent?` vs ${m.opponent.replaceAll('-',' ')}`:'';const status=m.status==='in_progress'?'LIVE':m.status==='registered'?'UPCOMING':String(m.result||'FINISHED').toUpperCase();row.append(el('b','board-rank',status),el('span','',`${m.name}${opponent} · ${date}`),el('strong','board-points',m.timeClass||''));list.append(row);});
  if(list.childElementCount)s.append(list);else s.append(el('p','competition-description','No public team matches are currently listed.'));
  s.append(el('p','status-line','Match results are club-level; Chess.com does not publish individual player contributions in this endpoint.'));
}
function renderAward(root,title,username,detail){if(!username)return;const s=section(root,title);const card=el('div','award-card');const copy=el('div','award-copy');copy.append(personLink(username));if(detail)copy.append(el('p','',detail));card.append(copy);s.append(card);}
function renderUnavailable(root,title,reason){const s=section(root,title);s.append(el('p','competition-description',reason));}
function renderManualMca(root, rows){
  if (!Array.isArray(rows)) return;
  const valid = rows.map(row => ({ ...row, points: Number(row?.points) }))
    .filter(row => row.username && Number.isFinite(row.points) && row.points >= 0)
    .sort((a,b) => b.points-a.points);
  if (!valid.length) return;
  const s = section(root,'MCA TOP PERFORMERS');
  const list = el('div','clubhouse-board');
  valid.slice(0,20).forEach((row,index) => {
    const line = el('div','clubhouse-board-row');
    line.append(el('b','board-rank',`#${index+1}`),personLink(row.username,row.name || row.username),el('strong','board-points',`${row.points} pts`));
    list.append(line);
  });
  s.append(list);
  s.append(el('p','status-line','Manually maintained MCA standings. Edit clubhouse.mcaLeaderboard in js/config.js; the section stays hidden until valid entries are added.'));
}
export function initClubhouse(config){
  const button=byId('open-clubhouse'),root=byId('clubhouse-content');
  button.hidden=false;
  return dashboard=>{
    root.replaceChildren();
    const month=dashboard?.monthlyRace?.month||'Current month';
    renderBoard(root,`MONTHLY RATING RACE · ${month}`,dashboard?.monthlyRace?.rows?.map(x=>({...x,score:x.ratingChange})),'rating pts');
    renderBoard(root,'OVERALL CLUB LEADERBOARD',dashboard?.overallLeaderboard?.rows,'pts',true);
    renderMatches(root,dashboard?.clubMatches);
    const monthlyLeader = dashboard?.overallLeaderboard?.rows?.[0];
    if (monthlyLeader && Number(monthlyLeader.score) > 0) renderAward(root,'MEMBER OF THE MONTH',monthlyLeader.username,'Highest automated overall contribution score this month.');
    renderAward(root,'MOST RAPIDLY IMPROVED MEMBER',dashboard?.mostImprovedMember?.username, dashboard?.mostImprovedMember?`${dashboard.mostImprovedMember.ratingChange>0?'+':''}${dashboard.mostImprovedMember.ratingChange} combined rating points this month.`:'No comparable monthly rating change yet.');
    renderManualMca(root, config?.clubhouse?.mcaLeaderboard);
    renderUnavailable(root,'VOTE CHESS LEADERBOARD','Vote Chess point totals are not available from the public club API. No manual or invented standings are shown.');
    renderUnavailable(root,'GAME OF THE MONTH','A public, verifiable game-selection and analysis feed is not available in this automation. No game is selected or labelled a winner without evidence.');
    const note=el('p','status-line',`Automation last updated: ${dashboard?.generatedAt?new Date(dashboard.generatedAt).toLocaleString(): 'Waiting for first GitHub Actions run'}.`);root.append(note);
  };
}
