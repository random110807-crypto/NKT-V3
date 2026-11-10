const byId=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
function safeUrl(value){try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}}
function countdown(startTime,status){if(status==='in_progress')return 'LIVE NOW';if(status==='finished')return 'COMPLETED';if(!startTime)return 'UPCOMING';const ms=startTime*1000-Date.now();if(ms<=0)return 'STARTING';const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000);return `${d}D : ${h}H`}
export function initCompetitions(config){
 const button=byId('open-competitions'),fallback=byId('competitions-fallback'),root=byId('competition-content');
 const render=dashboard=>{
  root.replaceChildren();const matches=dashboard?.clubMatches?.matches||[];
  if(!matches.length){button.hidden=true;fallback.hidden=false;const href=safeUrl(config.links?.clubCompetitions);if(href)fallback.href=href;else fallback.hidden=true;return;}
  button.hidden=false;fallback.hidden=true;
  matches.slice(0,12).forEach(m=>{
   const card=make('article','competition-card');card.append(make('h3','',m.name||'NKT Team Match'));
   const opponent=m.opponent?`Opponent: ${m.opponent.replaceAll('-',' ')}`:'Club match';card.append(make('p','competition-description',opponent));
   const status=m.status==='in_progress'?'LIVE':m.status==='registered'?'UPCOMING':String(m.result||'FINISHED').toUpperCase();card.append(make('span',`event-status status-${status.toLowerCase()}`,status));
   card.append(make('p','event-countdown',countdown(m.startTime,m.status)));
   if(m.startTime)card.append(make('p','competition-description',new Date(m.startTime*1000).toLocaleString()));
   const link=make('a','competition-details','VIEW CLUB MATCHES ↗');link.href='https://www.chess.com/clubs/matches/nashediyon-ki-toli-nkt';link.target='_blank';link.rel='noopener noreferrer';card.append(link);root.append(card);
  });
  root.append(make('p','status-line','Automatically sourced from Chess.com public club team-match data. Arena tournaments and Vote Chess events are not included unless exposed by a separate public endpoint.'));
 };
 button.hidden=false;
 return render;
}
