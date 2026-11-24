/* --- src/core/eval.js
 * Owns: 5-card evaluator (eval5) and PLO5 2-hole+3-board evaluator (evalPLO), plus the 10 hole and 10 board combo lists (H2, B3).
 * Depends on: nothing (first core module). Used by Monte Carlo, matchups and flop modules.
 */
// ==CORE== shared by page, worker and node
function eval5(a,b,c,d,e){
  var r0=a>>2,r1=b>>2,r2=c>>2,r3=d>>2,r4=e>>2;
  var fl=((a&3)===(b&3))&&((a&3)===(c&3))&&((a&3)===(d&3))&&((a&3)===(e&3));
  var cnt=[0,0,0,0,0,0,0,0,0,0,0,0,0];cnt[r0]++;cnt[r1]++;cnt[r2]++;cnt[r3]++;cnt[r4]++;
  var mask=(1<<r0)|(1<<r1)|(1<<r2)|(1<<r3)|(1<<r4);
  var st=-1;
  if(((mask>>>0)&(mask-1))!==0 || true){
    var bits=0;for(var i=0;i<13;i++)if(cnt[i])bits++;
    if(bits===5){
      for(var h=12;h>=4;h--){var m=31<<(h-4);if((mask&m)===m){st=h;break;}}
      if(st<0&&mask===0x100F)st=3; // wheel A2345
    }
  }
  if(st>=0&&fl)return 8e6+st;
  // build kicker key ordered by (count desc, rank desc)
  var q=-1,t=-1,p1=-1,p2=-1,k=0;
  for(var r=12;r>=0;r--){var n=cnt[r];if(n===4)q=r;else if(n===3)t=r;else if(n===2){if(p1<0)p1=r;else p2=r;}}
  var kick=0;
  if(q>=0){for(r=12;r>=0;r--)if(cnt[r]===1)kick=r;return 7e6+q*13+kick;}
  if(t>=0&&p1>=0)return 6e6+t*13+p1;
  if(fl){kick=0;for(r=12;r>=0;r--)if(cnt[r])kick=kick*13+r;return 5e6+kick;}
  if(st>=0)return 4e6+st;
  kick=0;for(r=12;r>=0;r--)if(cnt[r]===1)kick=kick*13+r;
  if(t>=0)return 3e6+t*169+kick;
  if(p2>=0)return 2e6+(p1*13+p2)*13+kick;
  if(p1>=0)return 1e6+p1*2197+kick;
  return kick;
}
var H2=[],B3=[];
(function(){for(var i=0;i<5;i++)for(var j=i+1;j<5;j++){H2.push([i,j]);for(var k=j+1;k<5;k++)B3.push([i,j,k]);}})();
function evalPLO(h,b){var best=0;for(var x=0;x<10;x++){var p=H2[x],c1=h[p[0]],c2=h[p[1]];for(var y=0;y<10;y++){var q=B3[y];var v=eval5(c1,c2,b[q[0]],b[q[1]],b[q[2]]);if(v>best)best=v;}}return best;}
/* --- src/core/montecarlo.js
 * Owns: Monte Carlo equity: mcEquity (vs N random), mcVsRandom (win/tie/eq vs N random), mcH2H (exact hand vs exact hand).
 * Depends on: eval.js (evalPLO). Used by matchups (muEq) and the page worker.
 */
// Monte Carlo: equity of hero vs nOpp random hands; ties split
function mcEquity(hero,nOpp,trials,rnd){
  rnd=rnd||Math.random;var used=new Array(52).fill(false);hero.forEach(function(c){used[c]=true;});
  var deck=[];for(var c=0;c<52;c++)if(!used[c])deck.push(c);
  var need=5*nOpp+5,eq=0,n=deck.length,opp=[],board=[0,0,0,0,0];
  for(var o=0;o<nOpp;o++)opp.push([0,0,0,0,0]);
  for(var t=0;t<trials;t++){
    for(var i=0;i<need;i++){var j=i+Math.floor(rnd()*(n-i));var tmp=deck[i];deck[i]=deck[j];deck[j]=tmp;}
    var idx=0;for(o=0;o<nOpp;o++)for(i=0;i<5;i++)opp[o][i]=deck[idx++];
    for(i=0;i<5;i++)board[i]=deck[idx++];
    var hv=evalPLO(hero,board),win=true,ties=1;
    for(o=0;o<nOpp;o++){var v=evalPLO(opp[o],board);if(v>hv){win=false;break;}if(v===hv)ties++;}
    if(win)eq+=1/ties;
  }
  return eq/trials;
}
// Hero vs nOpp random hands (fresh opponents + board each trial, same dealing as mcEquity). Returns {w,t,eq} fractions:
// w = hero beats every opponent, t = hero ties for best with k-1 others, eq = w + sum over ties of 1/k
function mcVsRandom(hero,nOpp,trials,rnd){
  rnd=rnd||Math.random;var used=new Array(52).fill(false);hero.forEach(function(c){used[c]=true;});
  var deck=[];for(var c=0;c<52;c++)if(!used[c])deck.push(c);
  var need=5*nOpp+5,w=0,t=0,eq=0,n=deck.length,opp=[],board=[0,0,0,0,0];
  if(nOpp<1||need>n)throw new Error('mcVsRandom: '+nOpp+' opponents need '+need+' cards, only '+n+' left'); // with 5 hero cards, up to 8 opponents fit (9 would need 50 of the 47 left)
  for(var o=0;o<nOpp;o++)opp.push([0,0,0,0,0]);
  for(var k=0;k<trials;k++){
    for(var i=0;i<need;i++){var j=i+Math.floor(rnd()*(n-i));var tmp=deck[i];deck[i]=deck[j];deck[j]=tmp;}
    var idx=0;for(o=0;o<nOpp;o++)for(i=0;i<5;i++)opp[o][i]=deck[idx++];
    for(i=0;i<5;i++)board[i]=deck[idx++];
    var hv=evalPLO(hero,board),win=true,ties=1;
    for(o=0;o<nOpp;o++){var v=evalPLO(opp[o],board);if(v>hv){win=false;break;}if(v===hv)ties++;}
    if(win){if(ties===1)w++;else t++;eq+=1/ties;}
  }
  return {w:w/trials,t:t/trials,eq:eq/trials};
}
// Head-to-head: exact hands h1 vs h2, random board. Returns {w1,w2,t} fractions
function mcH2H(h1,h2,trials,rnd){
  rnd=rnd||Math.random;var used=new Array(52).fill(false);
  h1.concat(h2).forEach(function(c){if(used[c])throw new Error('duplicate card '+c);used[c]=true;});
  var deck=[];for(var c=0;c<52;c++)if(!used[c])deck.push(c);
  var n=deck.length,b=[0,0,0,0,0],w1=0,w2=0,t=0;
  for(var k=0;k<trials;k++){
    for(var i=0;i<5;i++){var j=i+Math.floor(rnd()*(n-i));var tmp=deck[i];deck[i]=deck[j];deck[j]=tmp;b[i]=deck[i];}
    var v1=evalPLO(h1,b),v2=evalPLO(h2,b);if(v1>v2)w1++;else if(v2>v1)w2++;else t++;
  }
  return {w1:w1/trials,w2:w2/trials,t:t/trials};
}
/* --- src/core/cards.js
 * Owns: Deck constants (RANKS, SUITS) and parseHand (string like AsKh... to card ids 0–51).
 * Depends on: nothing else in core. handStr lives in score.js next to heuristic, which is its only core caller.
 */
var RANKS='23456789TJQKA',SUITS='shdc';
function parseHand(s){var out=[];for(var i=0;i<s.length;i+=2)out.push(RANKS.indexOf(s[i])*4+SUITS.indexOf(s[i+1]));return out;}
/* --- src/core/score-old.js
 * Owns: Previous point systems kept for comparison: heuristicOld (original rules) and heuristicLinear (refit weights W).
 * Depends on: cards.js (RANKS). The live score is Approach 1 in score.js; this is shown as “old linear” in the UI.
 */
function heuristicOld(h){
  var br=[],score=0,rk=h.map(function(c){return c>>2;}),su=h.map(function(c){return c&3;});
  var cnt=new Array(13).fill(0);rk.forEach(function(r){cnt[r]++;});
  var used=[false,false,false,false,false];
  function add(l,v){if(v){br.push([l,v]);score+=v;}}
  // pairs
  var prs=[];for(var r=12;r>=0;r--)if(cnt[r]>=2)prs.push(r);
  if(prs.length){var p=prs[0],pv=p===12?8:p===11?6:p===10?5:p===9?4:p===8?3:p>=5?2:1;add('Pair '+RANKS[p]+RANKS[p],pv);
    if(prs.length>1&&prs[1]>=8)add('Second pair '+RANKS[prs[1]]+RANKS[prs[1]],1);
    rk.forEach(function(r,i){if(cnt[r]>=2)used[i]=true;});}
  for(r=0;r<13;r++)if(cnt[r]>=3)add((cnt[r]===4?'Quads ':'Trips ')+RANKS[r],-3);
  // rundown: values 1..14 (ace both)
  var has={};rk.forEach(function(r){has[r+2]=true;if(r===12)has[1]=true;});
  var cats=[[5,4,8,'5-card rundown'],[4,3,6,'4 connected'],[4,4,4,'4 with one gap'],[3,2,2,'3 connected'],[3,3,1,'3 with one gap']];
  var run=null;
  for(var ci=0;ci<cats.length&&!run;ci++){var need=cats[ci][0],span=cats[ci][1];
    for(var top=14;top>=1+span&&!run;top--){if(!has[top]||!has[top-span])continue;var c=0,mem=[];for(var v=top-span;v<=top;v++)if(has[v]){c++;mem.push(v);}
      if(c>=need)run={cat:cats[ci],top:top,mem:mem};}}
  if(run){add(run.cat[3]+' ('+run.mem.slice().reverse().map(function(v){return RANKS[(v===1?14:v)-2];}).join('')+')',run.cat[2]);
    if(run.top>=10)add('Run top card T+',2);else if(run.top<=7)add('Run top card ≤7',-2);
    rk.forEach(function(r,i){if(run.mem.indexOf(r+2)>=0||(r===12&&run.mem.indexOf(1)>=0))used[i]=true;});}
  // suits
  var sc=[0,0,0,0];su.forEach(function(s){sc[s]++;});
  var groups=[];for(var s=0;s<4;s++)if(sc[s]>=2){var mx=-1;h.forEach(function(c){if((c&3)===s&&(c>>2)>mx)mx=c>>2;});groups.push({s:s,top:mx,n:sc[s],v:mx===12?3:mx===11?1:0.5});}
  groups.sort(function(a,b){return b.v-a.v||b.top-a.top;});
  groups.slice(0,2).forEach(function(g,i){add((i?'Second suit ':'Suited ')+RANKS[g.top]+'-high '+'♠♥♦♣'[g.s],g.v);});
  groups.forEach(function(g){if(g.n>=3)add(g.n+' of one suit','♠♥♦♣'[g.s]&&-1);su.forEach(function(x,i){if(x===g.s)used[i]=true;});});
  var aceSuit={};groups.forEach(function(g){if(g.top===12)aceSuit[g.s]=true;});
  var dang=used.filter(function(u){return !u;}).length;if(dang)add(dang+' dangler'+(dang>1?'s':''),-2*dang);
  var low=0;h.forEach(function(c){if((c>>2)<=3&&!aceSuit[c&3])low++;});if(low)add(low+' card'+(low>1?'s':'')+' 5 or lower',-low);
  var tier=score>=16?'Premium':score>=12?'Open any position':score>=8?'Late position':score>=5?'Limp/call in position':'Fold';
  return {score:score,breakdown:br,tier:tier};
}
// New PLO5 point system (coach refit vs 4-way equity, 1 pt ~ 0.67pp). Features = old breakdown items (see plo5-weights/feat.js).
var W={pAA:8,pKK:5.9,pQQ:5.55,pJJ:3.95,pTT:2.77,p97:0,p62:-0.46,pair2T:4.39,trips:-12,run5:3.23,run4c:0.78,run4g:0.58,run3c:-0.31,run3g:-0.31,topT:3.05,top7:-0.44,suitA:6.85,suitK:6.39,suitO:4.01,suit3:-1.56,dang:0,low:-2.05};
function heuristicLinear(h){
  var o=heuristicOld(h),br=[],score=0;
  o.breakdown.forEach(function(b){var l=b[0],v=b[1],k,n=1;
    if(l.indexOf('Pair ')===0){var p=RANKS.indexOf(l[5]);k=p===12?'pAA':p===11?'pKK':p===10?'pQQ':p===9?'pJJ':p===8?'pTT':p>=5?'p97':'p62';}
    else if(l.indexOf('Second pair')===0)k='pair2T';
    else if(l.indexOf('Trips')===0||l.indexOf('Quads')===0)k='trips';
    else if(l.indexOf('5-card')===0)k='run5';else if(l.indexOf('4 connected')===0)k='run4c';else if(l.indexOf('4 with')===0)k='run4g';
    else if(l.indexOf('3 connected')===0)k='run3c';else if(l.indexOf('3 with')===0)k='run3g';
    else if(l==='Run top card T+')k='topT';else if(l.indexOf('Run top card')===0)k='top7';
    else if(l.indexOf('Suited')===0||l.indexOf('Second suit')===0)k=v===3?'suitA':v===1?'suitK':'suitO';
    else if(/of one suit/.test(l))k='suit3';else if(/dangler/.test(l)){k='dang';n=-v/2;}else if(/5 or lower/.test(l)){k='low';n=-v;l=l.replace('5 or lower','2–5 (not in A-suit)');}
    var pts=Math.round(W[k]*n*100)/100;score+=W[k]*n;br.push([l,pts,k]);});
  score=Math.round(score*100)/100;
  var tier=score>=12.3?'Premium':score>=8.6?'Open any position':score>=5.5?'Late position':score>=3.4?'Limp/call in position':'Fold';
  return {score:score,breakdown:br,tier:tier,old:o};
}
/* --- src/core/score.js
 * Owns: Live preflop score: loads A1 (score_a1.js) and T3 (score_3bet.js), T3_LABELS, vs3() helper, handStr, and heuristic() (Approach 1 + facing-3-bet decision + linear comparison).
 * Depends on: score_a1.js / score_3bet.js (provided by build.js in the page, or required from this folder in Node). score-old.js (heuristicLinear). cards.js (RANKS, SUITS). Do not edit the coach files; this module only wraps them.
 */
// MAIN SCORE: coach's "Approach 1 patched additive" + raised-pot alt (score_a1.js = plo5-approaches/score_6.js verbatim)
var A1=(typeof A1!=='undefined'&&A1)?A1:require('./score_a1.js');
// FACING A 3-BET: coach's refined model (score_3bet.js + s6copy.js, verbatim copies from plo5-3bet; see its report.md)
var T3=(typeof T3!=='undefined'&&T3)?T3:require('./score_3bet.js');
// rule labels = score_3bet.js LBL verbatim (test.js checks); spot -> which v3 score + equity estimate the decision uses
var T3_LABELS={AA:'Pair of aces',DS:'Double-suited',PQ:'Best pair QQ or lower (no AA/KK)',KK:'Best pair KK',oneA:'Exactly one ace',s3:'3+ cards of one suit',QQ:'Best pair QQ (offsets part of PQ)',aceSuit:'Ace is suited'};
function vs3(H,type,folds,pos,stack){var key=type==='tight'&&folds?'tight_ifFoldsToFourBet':type,tm=type==='tight',v=H.v3,
  sp=pos+stack,c=T3.CUTS[key][sp],e=tm?v.estEquityPct.fromTight:v.estEquityPct.fromWide;
  return {key:key,spot:sp,mode:tm?'tight':'wide',score:tm?v.tight:v.wide,breakdown:tm?v.tightBreakdown:v.wideBreakdown,action:H.decision[key][sp],
   call:c.call,fourbet:c.fourbet,eq:e[type],eqC:e['c_'+type]};}
function handStr(h){return h.map(function(c){return RANKS[c>>2]+SUITS[c&3];}).join('');}
function heuristic(h){var hs=handStr(h),r=A1.score(hs),t=T3.score(hs);
  return {score:r.points,percentile:r.percentile,tier:r.tier,breakdown:r.breakdown,alt:r.alt,altBreakdown:r.altBreakdown,v3:t.v3,decision:t.decision,linear:heuristicLinear(h).score};}
/* --- src/core/info-tables.js
 * Owns: A1_LABELS, A1_GROUPS and LIN_LABELS — the (i) button tables. Labels must stay verbatim with score_a1.js L1 / feature list / W; test.js checks this.
 * Depends on: score.js (A1). Used by the info UI, not by scoring itself.
 */
// ---- info-button explanation tables (labels = score_a1.js L1 verbatim, weights read live from A1.W / W; test.js checks both) ----
var A1_LABELS={pA:'Top pair AA',pK:'Top pair KK',pQ:'Top pair QQ',pJ:'Top pair JJ',pT:'Top pair TT',p97:'Top pair 99-77',p62:'Top pair 66-22',
 p2hi:'Second pair TT+',p2mid:'Second pair 99-66',p2lo:'Second pair 55-22',trips:'Trips (dead 3rd card)',tripsHi:'Trips are TTT+',quads:'Quads',
 s1A:'Best suit A-high',s1K:'Best suit K-high',s1Q:'Best suit Q/J-high',s1T:'Best suit T-8-high',s1L:'Best suit 7-high or lower',
 s2A:'Second suit A-high',s2K:'Second suit K-high',s2Q:'Second suit Q/J-high',s2T:'Second suit T-8-high',s2L:'Second suit 7-high or lower',
 s3:'3 cards in one suit',s4:'4+ cards in one suit',pairSuit:'Suit made only by paired cards',
 run5:'5 ranks in a 5-rank window',run4:'4 ranks in a 5-rank window',run3:'3 ranks in a 5-rank window',runHi:'Run window tops at Q+',runLo:'Run window tops at 7 or lower',
 hA:'Has an Ace',hK:'Has a King',hQ:'Has a Queen',hJ:'Has a Jack',hT:'Has a Ten',lowDang:'Low dangler (2-6, unpaired, unsuited, outside run)',hiDang:'Dangler 7+',
 AAds:'AA and double-suited',tripsFH:'Trips + another pair (full-house shape)',tripsConn:'Trips rank sits inside a 3+ card run',lowTwoPair:'Two pair, both 99 or lower',AAdang:'AA + each dangler',KKds:'KK and double-suited'};
var A1_GROUPS=[
 ['Highest pair (trips/quads also count as their pair)',['pA','pK','pQ','pJ','pT','p97','p62']],
 ['Second-highest pair',['p2hi','p2mid','p2lo']],
 ['Trips, quads, two-pair shapes (per occurrence)',['trips','tripsHi','quads','tripsFH','tripsConn','lowTwoPair']],
 ['Best suit = suited group (2+ cards) with the highest top card',['s1A','s1K','s1Q','s1T','s1L']],
 ['Second suit = the next suited group',['s2A','s2K','s2Q','s2T','s2L']],
 ['Suit shape (per suit)',['s3','s4','pairSuit']],
 ['Run = most different ranks inside one 5-rank window (A plays high or low); needs 3+',['run5','run4','run3','runHi','runLo']],
 ['High cards (once per rank held)',['hA','hK','hQ','hJ','hT']],
 ['Danglers = cards that are unpaired, in no suited group and outside the run (per card)',['lowDang','hiDang']],
 ['AA / KK extras',['AAds','AAdang','KKds']]];
var LIN_LABELS=[['pAA','Pair AA'],['pKK','Pair KK'],['pQQ','Pair QQ'],['pJJ','Pair JJ'],['pTT','Pair TT'],['p97','Pair 99-77'],['p62','Pair 66-22'],['pair2T','Second pair TT+'],['trips','Trips or quads (each)'],
 ['run5','5-card rundown'],['run4c','4 connected'],['run4g','4 with one gap'],['run3c','3 connected'],['run3g','3 with one gap'],['topT','Run top card T+'],['top7','Run top card ≤7'],
 ['suitA','Suited, A-high (up to 2 suits)'],['suitK','Suited, K-high'],['suitO','Suited, Q-high or lower'],['suit3','3+ cards of one suit (each)'],['dang','Each dangler'],['low','Each 2–5 not in an A-high suit']];
/* --- src/core/deal-points.js
 * Owns: Points-slider dealing: binomial/colex ranks, top.json list decode, ptsRange/ptsAtLeast/ptsBetween, dealRange and dealByPoints (uniform random hand in a points band, avoiding blocked cards).
 * Depends on: score.js (A1.pts, handStr). Data: top.json (built by gen_top.js).
 */
// ---- per-player points slider + RND: exact uniform random hand with lo <= Approach 1 points <= hi, avoiding blocked cards ----
// top = top.json (gen_top.js): exact points histogram of all 2,598,960 hands + every hand in the two rare tails
// (points >= top.cut and points <= top.bcut) as 3-byte colex ranks.
// If the range contains any points value between the tails ("middle" mass > 0): rejection sampling — deal 5 random unblocked
//  cards until lo <= points <= hi. Exact (covers listed hands in range too); every middle value has >= 1,416 hands (0.054%).
// Else (range lies wholly in the listed tails): pick uniformly from the listed hands in range that avoid the blocked cards.
var BINOM=(function(){var b=[],n,k;for(n=0;n<=52;n++){b[n]=[];for(k=0;k<=5;k++)b[n][k]=k===0?1:n===0?0:b[n-1][k-1]+(k<=n-1?b[n-1][k]:0);}return b;})();
function colexUnrank(r){var out=[],k,c;for(k=5;k>=1;k--){c=k-1;while(c<51&&BINOM[c+1][k]<=r)c++;r-=BINOM[c][k];out.push(c);}return out.reverse();}
function decRanks(b64,n){var s=typeof atob==='function'?atob(b64):Buffer.from(b64,'base64').toString('binary'),r=new Int32Array(n),i;
 for(i=0;i<n;i++)r[i]=(s.charCodeAt(3*i)<<16)|(s.charCodeAt(3*i+1)<<8)|s.charCodeAt(3*i+2);return r;}
function topRanks(top){return top._r||(top._r=decRanks(top.b64,top.n));}
function botRanks(top){return top._br||(top._br=decRanks(top.bb64||'',top.bn||0));}
// all listed hands as {h:cards,p:points}; points come from the list order (sorted by points) + the histogram
function listedHands(top){if(top._L)return top._L;var L=[],pr=ptsRange(top),R=topRanks(top),B=botRanks(top),i=0,p,k;
 for(p=pr[1];p>=top.cut;p--)for(k=0;k<(top.hist[p]||0);k++,i++)L.push({h:colexUnrank(R[i]),p:p});
 i=0;if(top.bn)for(p=pr[0];p<=top.bcut;p++)for(k=0;k<(top.hist[p]||0);k++,i++)L.push({h:colexUnrank(B[i]),p:p});return top._L=L;}
function ptsAtLeast(top,p){var n=0,k;for(k in top.hist)if(+k>=p)n+=top.hist[k];return n;}
function ptsBetween(top,lo,hi){var n=0,k;for(k in top.hist)if(+k>=lo&&+k<=hi)n+=top.hist[k];return n;}
function ptsRange(top){var ks=Object.keys(top.hist).map(Number);return [Math.min.apply(null,ks),Math.max.apply(null,ks)];}
function isListed(top,p){return p>=top.cut||(top.bn>0&&p<=top.bcut);}
function dealRange(top,lo,hi,blocked,rnd,budgetMs){rnd=rnd||Math.random;blocked=blocked||[];var bl={},i,h,k,mid=0;for(i=0;i<blocked.length;i++)bl[blocked[i]]=1;
 var desc=function(a,b){return b-a;};if(lo>hi){k=lo;lo=hi;hi=k;}
 if(!ptsBetween(top,lo,hi))return {h:null,why:'none'};
 for(k in top.hist)if(+k>=lo&&+k<=hi&&!isListed(top,+k))mid+=top.hist[k];
 if(!mid){var L=listedHands(top),ok=[];
  for(i=0;i<L.length;i++){if(L[i].p<lo||L[i].p>hi)continue;h=L[i].h;if(!bl[h[0]]&&!bl[h[1]]&&!bl[h[2]]&&!bl[h[3]]&&!bl[h[4]])ok.push(h);}
  if(!ok.length)return {h:null,why:'none'};return {h:ok[Math.floor(rnd()*ok.length)].slice().sort(desc),tries:1,pool:ok.length,list:true};}
 var d=[];for(i=0;i<52;i++)if(!bl[i])d.push(i);var end=Date.now()+(budgetMs||400),t=0,j,x,m=d.length,q;
 for(;;){for(i=0;i<5;i++){j=i+Math.floor(rnd()*(m-i));x=d[i];d[i]=d[j];d[j]=x;}t++;h=d.slice(0,5);q=A1.pts(handStr(h)).points;
  if(q>=lo&&q<=hi)return {h:h.sort(desc),tries:t};
  if((t&255)===0&&Date.now()>end)return {h:null,why:'slow',tries:t};}}
function dealByPoints(top,minP,blocked,rnd,budgetMs){var mx=ptsRange(top)[1];if(minP>mx)return {h:null,why:'none'};return dealRange(top,minP,ptsRange(top)[1],blocked,rnd,budgetMs);}
/* --- src/core/classes.js
 * Owns: The 16 PLO5 hand-class taxonomy (MU_CLASSES), muFeat, handClass and sampleClass. Trips/quads are classified but never sampled in Matchups. Do not change this taxonomy without a dedicated task.
 * Depends on: cards.js (card ids). Used by matchups.js and the range-chart core/UI.
 */
// ---- matchups (crossed-swords sheet): which PLO5 hand classes do best / worst heads-up vs a hero hand ----
// ---- Matchups (crossed swords): opponent hand classes + strongest specific hands vs a hero; trips/quads are never dealt ----
var MU_CLASSES=[
 ['aces','Aces','exactly two aces (AA + any side cards, incl. AAxx double pairs)'],
 ['hidp','High double pair','two pairs, both TT or higher (e.g. QQJJT, KKQQ5)'],
 ['goodkk','Good KK','one pair of kings plus an ace, or no ace and at least two of Q, J, T, 9 beside them (e.g. AKKQJ, AKK72, KKQJT, KKJT4)'],
 ['badkk','Bad KK','one pair of kings, no ace, fewer than two of Q/J/T/9 beside them (e.g. KK842, KKQ63, KK876)'],
 ['mixeddp','Mixed double pair','two pairs, one TT or higher and one 99 or lower (e.g. KK55, JJ99)'],
 ['hirun','High rundown','no pair, 4–5 cards in a 5-rank window whose top card is A–Q (e.g. AKQJT, KQJT9, QJT98, AKQJ5)'],
 ['pairrun','Pair + rundown (77+)','one pair 77–QQ, and the four different ranks fit in a 5-rank window (e.g. QQJT9, JJT98, 99876); 22–66 in a rundown are Small rundowns, KK rundowns are Good KK'],
 ['bigpair','Big pair (QQ–TT)','one pair QQ, JJ or TT, side cards not a rundown'],
 ['unpds','Unpaired DS with A/K','no pair, not a rundown, double-suited (two suits of 2+ cards) with the A or K in one of those suits (e.g. A♠9♠7♥4♥2♦, K♥Q♥8♣5♣2♦)'],
 ['midpair','Mid pair (77–99)','one pair 77, 88 or 99, side cards not a rundown'],
 ['midrun','Middle rundown','no pair, 4–5 cards in a 5-rank window whose top card is J–9 (e.g. JT987, T9876, 98765)'],
 ['unpbw','Unpaired broadway','no pair, not a rundown, not DS with a suited A/K, and at least two of A, K, Q, J, T (e.g. AKQ95, KJ842)'],
 ['smalldp','Small double pair','two pairs, both 99 or lower (e.g. 55667, 9944K, 2266Q)'],
 ['smallrun','Small rundown','no pair and 4–5 cards in a 5-rank window whose top card is 8 or lower (e.g. 87654, 5432A), or one pair 22–66 whose four ranks fit in a 5-rank window (e.g. 55432, 66987)'],
 ['lowpair','Low pair (22–66)','one pair 22–66, side cards not a rundown (set-mining hand)'],
 ['junk','Unpaired junk','no pair, not a rundown, fewer than two A–T cards and not DS with a suited A/K (e.g. K9742, 98532, A♥9♥7♣4♠2♦)']];
var MU_SUIT='♠♥♦♣',MU_RN='23456789TJQKA';
// features: cnt per rank, pairs (desc), max count, rundown (best = most distinct ranks in a 5-rank window, highest such window; rt = top value held there, A=14, wheel A=1)
function muFeat(h){var cnt=[0,0,0,0,0,0,0,0,0,0,0,0,0],sc=[0,0,0,0],i,r,prs=[],mx=0,v,lo,k,best=0,bw=0,has={},sa=false,rt=0,rs=[];
 for(i=0;i<5;i++){r=h[i]>>2;cnt[r]++;sc[h[i]&3]++;has[r+2]=1;if(r===12)has[1]=1;}
 for(r=12;r>=0;r--){if(cnt[r]===2)prs.push(r);if(cnt[r]>mx)mx=cnt[r];}
 for(lo=10;lo>=1;lo--){k=0;for(v=lo;v<lo+5;v++)if(has[v])k++;if(k>best){best=k;bw=lo;}}
 for(v=bw+4;v>=bw;v--)if(has[v]){if(!rt)rt=v;rs.push(v);}
 for(i=0;i<5;i++)if((h[i]>>2)===12&&sc[h[i]&3]>=2)sa=true;
 var ns=0;for(i=0;i<4;i++)if(sc[i]>=2)ns++;
 return {cnt:cnt,sc:sc,prs:prs,mx:mx,best:best,bw:bw,rt:rt,rs:rs,sa:sa,ds:ns>=2,suited:ns>=1,top:prs.length?prs[0]:-1};}
function handClass(h){var f=muFeat(h),i,nb=0,nut=false;
 if(f.mx>=3)return 'trips'; // not a Matchups class: never sampled
 if(f.cnt[12]===2)return 'aces';
 if(f.prs.length===2){if(f.prs[1]>=8)return 'hidp';if(f.prs[0]>=8)return 'mixeddp';return 'smalldp';}
 if(f.prs[0]===11)return (f.cnt[12]||f.cnt[10]+f.cnt[9]+f.cnt[8]+f.cnt[7]>=2)?'goodkk':'badkk';
 if(f.prs.length===1){if(f.best>=4)return f.prs[0]>=5?'pairrun':'smallrun';return f.prs[0]>=8?'bigpair':f.prs[0]>=5?'midpair':'lowpair';}
 if(f.best>=4)return f.rt>=12?'hirun':f.rt>=9?'midrun':'smallrun';
 if(f.ds)for(i=0;i<5;i++)if((h[i]>>2)>=11&&f.sc[h[i]&3]>=2)nut=true;
 if(nut)return 'unpds';
 for(i=8;i<13;i++)if(f.cnt[i])nb++;
 return nb>=2?'unpbw':'junk';}
// uniform random hand of class k from the cards the hero isn't holding (rejection; null if none found in maxTries)
function sampleClass(k,hero,rnd,maxTries){rnd=rnd||Math.random;var d=[],i,j,x,t;for(i=0;i<52;i++)if(hero.indexOf(i)<0)d.push(i);
 for(t=0;t<(maxTries||200000);t++){for(i=0;i<5;i++){j=i+Math.floor(rnd()*(d.length-i));x=d[i];d[i]=d[j];d[j]=x;}var h=d.slice(0,5);if(handClass(h)===k)return h.sort(function(a,b){return b-a;});}return null;}
/* --- src/core/matchups.js
 * Owns: Matchups engine: board pool, class vs hero equity, strongest-hands search, outcome breakdown (flush/straight/set/boat/other), reasons and muWhy/muPick/muGen/matchups().
 * Depends on: eval.js, montecarlo.js (mcH2H), classes.js (MU_CLASSES, muFeat, handClass, sampleClass).
 */
// opponent's heads-up all-in preflop equity vs hero (random 5-card board; ties split)
function muEq(hero,opp,trials,rnd){var r=mcH2H(hero,opp,trials,rnd);return r.w2+r.t/2;}
// shared board pool: boards dealt from the cards the hero isn't holding, hero's value pre-computed once;
// an opponent uses the boards that don't touch its cards (unbiased: those are uniform boards from the remaining 42 cards)
function muPool(hero,nb,rnd){var d=[],i,j,x,k,P={b:[],hv:[],hc:new Int8Array(nb),fs:new Int8Array(nb),lo:new Int32Array(nb),hi:new Int32Array(nb),n:nb};for(i=0;i<52;i++)if(hero.indexOf(i)<0)d.push(i);
 for(k=0;k<nb;k++){var b=[0,0,0,0,0],lo=0,hi=0,sc=[0,0,0,0];for(i=0;i<5;i++){j=i+Math.floor(rnd()*(d.length-i));x=d[i];d[i]=d[j];d[j]=x;b[i]=x;sc[x&3]++;if(x<32)lo|=1<<x;else hi|=1<<(x-32);}
  var v=evalPLO(hero,b);P.b.push(b);P.hv.push(v);P.hc[k]=Math.floor(v/1e6);P.fs[k]=sc[0]>=3?0:sc[1]>=3?1:sc[2]>=3?2:sc[3]>=3?3:-1;P.lo[k]=lo;P.hi[k]=hi;}return P;}
// outcome breakdown per board: both best hands in the same category -> fl (flush v flush), st (straight v straight), set (trips v trips), fh (full house v full house); everything else -> oth
var MU_BD=['fl','st','set','fh','oth'],MU_BDN={fl:'Flush v flush',st:'Straight v straight',set:'Set v set',fh:'Boat v boat',oth:'Everything else'};
function muSt(opp,start){var lo=0,hi=0;opp.forEach(function(x){if(x<32)lo|=1<<x;else hi|=1<<(x-32);});return {h:opp,lo:lo,hi:hi,s:start||0,pos:0,w:0,t:0,n:0,e:0,bd:new Int32Array(15),bs:new Int32Array(12)};}
function muRun(P,st,want){var bd=st.bd,bs=st.bs;while(st.n<want&&st.pos<P.n){var k=(st.s+st.pos++)%P.n;if((P.lo[k]&st.lo)||(P.hi[k]&st.hi))continue;var v=evalPLO(st.h,P.b[k]),hv=P.hv[k],r=v>hv?1:v===hv?2:0,
   oc=Math.floor(v/1e6),c=oc===P.hc[k]?(oc===5?0:oc===4?1:oc===3?2:oc===6?3:4):4;bd[c*3+r]++;if(c===0&&P.fs[k]>=0)bs[P.fs[k]*3+r]++;
  if(r===1)st.w++;else if(r===2)st.t++;st.n++;}
 st.e=st.n?(st.w+st.t/2)/st.n:0;return st.e;}
// breakdown as fractions of all boards (r: 0 = you win, 1 = they win, 2 = tie): p = share of boards, you/them = equity those boards give each side, net = you - them
function muBreak(bd,bs,N){function one(a,i){var y=a[i],o=a[i+1],t=a[i+2];return {p:(y+o+t)/N,you:(y+t/2)/N,them:(o+t/2)/N,net:(y-o)/N,n:y+o+t};}
 var r={N:N,suit:[]};MU_BD.forEach(function(k,i){r[k]=one(bd,i*3);});for(var s=0;s<4;s++)r.suit.push(one(bs,s*3));return r;}
function muStBreak(st){return muBreak(st.bd,st.bs,st.n);}
// biased random opponent for the strongest-hands search: high pairs/aces, higher rundowns over the hero's ranks, the hero's suits (to contest flushes); never trips
function muGen(hero,f,rnd){var used=new Array(52).fill(false),h=[],i,mode=Math.floor(rnd()*6),hsu=[],tries=0;hero.forEach(function(c){used[c]=true;});
 for(i=0;i<4;i++)if(f.sc[i]>=2)hsu.push(i);
 function ri(n){return Math.floor(rnd()*n);}
 function cntR(r){var n=0;h.forEach(function(c){if((c>>2)===r)n++;});return n;}
 function add(r){if(r<0||r>12||cntR(r)>=2)return false;var order=[0,1,2,3].sort(function(){return rnd()-.5;}),inH=h.map(function(c){return c&3;});
  if(rnd()<.6){var pref=hsu.concat(inH.filter(function(s){return inH.filter(function(t){return t===s;}).length===1;}));if(pref.length){var s0=pref[ri(pref.length)];order=[s0].concat(order.filter(function(s){return s!==s0;}));}}
  for(var q=0;q<4;q++){var c=r*4+order[q];if(!used[c]){used[c]=true;h.push(c);return true;}}return false;}
 var hmax=0;hero.forEach(function(c){if((c>>2)>hmax)hmax=c>>2;});
 if(mode===0){add(12);add(12);}
 else if(mode===1){var pr=Math.max(8,Math.min(12,(f.top>=0?f.top:hmax)+1+ri(3)));add(pr);add(pr);}
 else if(mode===2){var a=8+ri(5),b=8+ri(5);add(a);add(a);if(b!==a){add(b);add(b);}}
 else if(mode===3||mode===4){var top=Math.min(14,Math.max(6,f.rt+(mode===3?1+ri(3):ri(2)))),k=4+ri(2),rs=[];for(i=top;i>top-5;i--)rs.push(i);rs.sort(function(){return rnd()-.5;});
  rs.slice(0,k).forEach(function(v){add(v===1?12:v-2);});if(rnd()<.3&&h.length<5)add(h.length?(h[0]>>2):12);}
 while(h.length<5&&tries++<60){var r=rnd()<.45?8+ri(5):(h.length?Math.max(0,Math.min(12,(h[ri(h.length)]>>2)+ri(5)-2)):ri(13));add(r);}
 if(h.length<5)return null;return h.sort(function(a,b){return b-a;});}
// specific, computed reasons for one matchup (opp vs hero). g: true = good for you, false = bad for you, null = neutral
function muReasons(hero,opp,B){var H=muFeat(hero),O=muFeat(opp),R=[],RN=MU_RN,rk=function(c){return c>>2;},cs=function(c){return RN[c>>2]+MU_SUIT[c&3];},pr=function(r){return RN[r]+RN[r];};
 var hMax=Math.max.apply(null,hero.map(rk)),oMax=Math.max.apply(null,opp.map(rk)),hMin=Math.min.apply(null,hero.map(rk)),oMin=Math.min.apply(null,opp.map(rk));
 function add(k,g,p,t){R.push({k:k,g:g,p:p,t:t});}
 var hp=H.prs[0],op=O.prs[0];
 if(op!==undefined){if(op>hMax)add('opair',false,10,'Their '+pr(op)+' is above all your cards (overpair)');else if(hp!==undefined&&op>hp)add('oset',false,10,'Their '+pr(op)+' sets beat your '+pr(hp)+' sets');}
 if(hp!==undefined){if(hp>oMax)add('hpair',true,10,'Your '+pr(hp)+' is above all their cards (overpair)');else if(op!==undefined&&hp>op)add('hset',true,10,'Your '+pr(hp)+' sets beat their '+pr(op)+' sets');
  else if(op===hp)add('same',null,9,'You both hold '+pr(hp)+': side cards and suits decide');
  var an=function(r){return (r===12||r===6?'an ':'a ')+RN[r];},b=op===hp?0:O.cnt[hp];if(b===2)add('oblkset',false,7,'They hold both other '+RN[hp]+'s: you can\'t make a set');else if(b===1)add('oblkset',false,5,'They hold '+an(hp)+': one '+RN[hp]+' left for your set');}
 if(op!==undefined&&op!==hp){var an2=function(r){return (r===12||r===6?'an ':'a ')+RN[r];},c=H.cnt[op];if(c===2)add('hblkset',true,7,'You hold both other '+RN[op]+'s: they can\'t make a set');else if(c===1)add('hblkset',true,5,'You hold '+an2(op)+': one '+RN[op]+' left for their set');}
 // flushes: with both making a flush in one suit, the higher top hole card in that suit wins
 var s,hh,oh,shared=0;for(s=0;s<4;s++){hh=-1;oh=-1;hero.forEach(function(c){if((c&3)===s&&rk(c)>hh)hh=rk(c);});opp.forEach(function(c){if((c&3)===s&&rk(c)>oh)oh=rk(c);});
  if(H.sc[s]>=2&&O.sc[s]>=2){shared++;if(oh>hh)add('oflush',false,8,'Higher '+MU_SUIT[s]+' flush: their '+RN[oh]+MU_SUIT[s]+' beats your '+RN[hh]+MU_SUIT[s]);else add('hflush',true,8,'Higher '+MU_SUIT[s]+' flush: your '+RN[hh]+MU_SUIT[s]+' beats their '+RN[oh]+MU_SUIT[s]);}
  else if(O.sc[s]>=2&&H.sc[s]<2){if(H.sc[s]===1&&hh>oh)add('hblkfl',true,4,'You hold '+RN[hh]+MU_SUIT[s]+', above their best '+MU_SUIT[s]+' ('+RN[oh]+MU_SUIT[s]+')');else add('osuit',false,4,'They can make a '+MU_SUIT[s]+' flush; you can\'t');}
  else if(H.sc[s]>=2&&O.sc[s]<2){if(O.sc[s]===1&&oh>hh)add('oblkfl',false,4,'They hold '+RN[oh]+MU_SUIT[s]+', above your best '+MU_SUIT[s]+' ('+RN[hh]+MU_SUIT[s]+')');else add('hsuit',true,4,'Your '+MU_SUIT[s]+' flush isn\'t shared: they can\'t make one');}}
 var sty=function(F){return F.ds?'double-suited':F.suited?'single-suited':'rainbow';};
 if(O.ds&&!H.ds)add('ods',false,5,'Double-suited vs your '+sty(H)+' hand');else if(H.ds&&!O.ds)add('hds',true,5,'Your double-suited vs their '+sty(O)+' hand');
 // straights: most connected 5-rank window of each hand
 var VN=function(v){return v===1?'A':RN[v-2];},rsS=function(F){return F.rs.map(VN).join('');};
 if(H.best>=3&&O.best>=3&&Math.abs(O.rt-H.rt)<=4&&(O.rt>H.rt?O.best:H.best)>=4){if(O.rt>H.rt)add('orun',false,7,'Higher straights: their '+rsS(O)+' runs over your '+rsS(H));else if(H.rt>O.rt)add('hrun',true,7,'Higher straights: your '+rsS(H)+' runs over their '+rsS(O));}
 else if(O.best>=4&&H.best<=2)add('ocon',false,6,'Their connected '+rsS(O)+' vs your disconnected cards');
 else if(H.best>=4&&O.best<=2)add('hcon',true,6,'Your connected '+rsS(H)+' vs their disconnected cards');
 var inRun=function(F,c){var v=rk(c)+2;return F.rs.indexOf(v)>=0||(v===14&&F.rs.indexOf(1)>=0);},
  uniq=function(L){var sn={};return L.filter(function(c){if(sn[c>>2])return false;sn[c>>2]=1;return true;});};
 if(H.best>=4){var bl=uniq(opp.filter(function(c){return inRun(H,c);}));if(bl.length>=2)add('oblk',false,6,'They block your straights: they hold '+bl.slice(0,3).map(cs).join(' '));}
 if(O.best>=4){var bh=uniq(hero.filter(function(c){return inRun(O,c);}));if(bh.length>=2)add('hblk',true,6,'You block their straights: you hold '+bh.slice(0,3).map(cs).join(' '));}
 var nb=opp.filter(function(c){return rk(c)<hMin;}).length,na=opp.filter(function(c){return rk(c)>hMax;}).length;
 if(nb>=4)add('obelow',true,3,nb+' of their cards are below all of yours');if(na>=4)add('oabove',false,3,na+' of their cards are above all of yours');
 // measured equity swing next to the matching reason (only with a refined run: >= 1000 boards)
 if(B&&B.N>=1000)R.forEach(function(x){var m,lab;
  if(x.k==='oflush'||x.k==='hflush'){var s=MU_SUIT.indexOf(x.t.match(/Higher (.) flush/)[1]);m=B.suit[s];lab=MU_SUIT[s]+' flush v flush';}
  else if(x.k==='orun'||x.k==='hrun'){m=B.st;lab='straight v straight';}
  else if(x.k==='oset'||x.k==='hset'||x.k==='same'){m=B.set;lab='set v set';}
  // shown only when the measured swing points the same way as the reason (✗ = negative for you, ✓ = positive) and is at least 0.3%
  if(m&&m.n>0&&Math.abs(m.net)>=0.003&&(x.g===null||(x.g?m.net>0:m.net<0)))x.m={net:m.net,p:m.p,you:m.you,them:m.them,lab:lab};});
 return R.sort(function(a,b){return b.p-a.p;});}
// pick up to n reasons, at least one for the given side (side 1 = they do well -> lead with a red one)
function muPick(R,side,n){n=n||3;var want=side>0?false:true,first=R.filter(function(x){return x.g===want;})[0],out=first?[first]:[];
 R.forEach(function(x){if(out.length<n&&out.indexOf(x)<0)out.push(x);});return out;}
// o: n hands per class, t boards per hand, rt boards to re-measure shown examples; search: sc candidates, refine to top st with sb boards
function matchups(hero,o,rnd,prog,part){o=o||{};rnd=rnd||Math.random;var n=o.n||14,T=o.t||120,RT=o.rt||300,EX=o.ex||1200,S=o.show||3,SC=o.sc===undefined?220:o.sc,SB=o.sb||1500,NT=o.top||5,cl=[],i,j;
 var P=muPool(hero,o.pool||Math.max(3000,Math.ceil(SB*2)),rnd),f=muFeat(hero),steps=MU_CLASSES.length+3,step=0;
 for(i=0;i<MU_CLASSES.length;i++){var k=MU_CLASSES[i][0],hs=[];
  for(j=0;j<n;j++){var h=sampleClass(k,hero,rnd,j?200000:400000);if(!h)break;var st=muSt(h,Math.floor(rnd()*P.n));muRun(P,st,T);hs.push(st);}
  var avg=hs.length?hs.reduce(function(a,b){return a+b.e;},0)/hs.length:null;hs.sort(function(a,b){return b.e-a.e;});
  var cb=new Int32Array(15),cs=new Int32Array(12),cn=0;hs.forEach(function(st){for(var q=0;q<15;q++)cb[q]+=st.bd[q];for(q=0;q<12;q++)cs[q]+=st.bs[q];cn+=st.n;});
  cl.push({k:k,name:MU_CLASSES[i][1],rule:MU_CLASSES[i][2],n:hs.length,avg:avg,hs:hs,bk:cn?muBreak(cb,cs,cn):null});if(prog)prog(++step,steps);}
 var ok=cl.filter(function(c){return c.n>0;}).sort(function(a,b){return b.avg-a.avg;});
 var beat=ok.slice(0,S),dom=ok.slice(Math.max(S,ok.length-S)).reverse();
 // examples: re-measure the 3 most extreme sampled hands + the median one; show the most extreme (after re-measuring) + the median
 function ex(c,side){var L=c.hs.length,mi=Math.floor(L/2),cand=[],q;
  for(q=0;q<Math.min(3,L);q++)cand.push(side>0?q:L-1-q);if(cand.indexOf(mi)<0)cand.push(mi);
  var M=cand.map(function(i){var st=c.hs[i];muRun(P,st,RT);return {i:i,h:st.h,e:st.e};});
  var best=M.reduce(function(a,b){return side>0?(b.e>a.e?b:a):(b.e<a.e?b:a);}),med=M.filter(function(x){return x.i===mi;})[0],out=[{h:best.h,e:best.e,tag:side>0?'strongest':'weakest'}];
  if(med&&med!==best)out.push({h:med.h,e:med.e,tag:'typical'});
  // the shown examples are extended to EX boards so their outcome breakdown and reason numbers are supported
  return out.map(function(x){var st=c.hs.filter(function(z){return z.h===x.h;})[0];muRun(P,st,EX);x.e=st.e;x.n=st.n;x.bk=muStBreak(st);x.why=muPick(muReasons(hero,x.h,x.bk),side,3);return x;});}
 beat.forEach(function(c){c.ex=ex(c,1);});dom.forEach(function(c){c.ex=ex(c,-1);});
 var res={classes:ok.map(function(c){return {k:c.k,name:c.name,rule:c.rule,n:c.n,avg:c.avg,bk:c.bk};}),
  missing:cl.filter(function(c){return !c.n;}).map(function(c){return c.k;}),
  beat:beat.map(function(c){return {k:c.k,name:c.name,n:c.n,avg:c.avg,ex:c.ex,bk:c.bk};}),dom:dom.map(function(c){return {k:c.k,name:c.name,n:c.n,avg:c.avg,ex:c.ex,bk:c.bk};}),
  o:{n:n,t:T,rt:RT,ex:EX,sc:SC,sb:SB},top:null};
 if(part)part(res);
 if(SC>0){// strongest-hands search: candidates = sampled hands of the top 4 classes + biased generated hands; screen on common boards, refine the best
  var seen={},C=[];function put(h){var key=h.join();if(!seen[key]){seen[key]=1;C.push(muSt(h,0));}}
  ok.slice(0,4).forEach(function(c){c.hs.forEach(function(st){put(st.h);});});
  var g=0;while(C.length<SC+64&&g++<SC*4){var x=muGen(hero,f,rnd);if(x&&handClass(x)!=='trips')put(x);}
  var nc=C.length;C.forEach(function(st){muRun(P,st,50);});C.sort(function(a,b){return b.e-a.e;});if(prog)prog(++step,steps);
  C=C.slice(0,30);C.forEach(function(st){muRun(P,st,250);});C.sort(function(a,b){return b.e-a.e;});if(prog)prog(++step,steps);
  C=C.slice(0,15);C.forEach(function(st){muRun(P,st,SB);});C.sort(function(a,b){return b.e-a.e;});if(prog)prog(++step,steps);
  // the top 5 are re-measured on fresh, independent boards (removes the winner's-curse bias of picking the max of 15 noisy estimates)
  var FB=o.fb||1200,P2=muPool(hero,Math.ceil(FB*2.1),rnd);
  res.top=C.slice(0,NT).map(function(st){var s2=muSt(st.h,0);muRun(P2,s2,FB);var bk=muStBreak(s2);return {h:st.h,e:s2.e,sel:st.e,n:s2.n,k:handClass(st.h),bk:bk,why:muPick(muReasons(hero,st.h,bk),1,3)};}).sort(function(a,b){return b.e-a.e;});res.nc=nc;res.o.fb=FB;}
 return res;}
// one-line, rule-based class "why" (structure only; the numbers come from the simulation). side 1 = they do well, -1 = they do badly
// one-line, rule-based class "why" (structure only; the numbers come from the simulation). side 1 = they do well, -1 = they do badly
function muWhy(k,hero,side,avg){var f=muFeat(hero),RN=MU_RN,pr=function(r){return RN[r]+RN[r];},pct=Math.round(avg*100)+'%',run=f.best>=4&&!f.prs.length,
  KK=(k==='goodkk'||k==='badkk'),PT={aces:12,hidp:8,mixeddp:8,bigpair:8,goodkk:11,badkk:11}[k],UNP=(k==='unpds'||k==='unpbw'||k==='junk');
 if(side>0){
  if(k==='aces'&&f.top===12)return 'Aces vs aces: you share the top pair, so side cards and suits decide.';
  if(PT!==undefined&&f.top>=0&&f.top<PT)return 'Their '+(KK?'kings':k==='aces'?'aces':'higher pairs')+' make bigger sets and overpairs than your '+pr(f.top)+' (set over set).';
  if(PT!==undefined&&f.top<0)return 'Their '+(KK?'KK':k==='aces'?'AA':'high pair')+' is an overpair to most of your cards – you need your draws to get there.';
  if(k==='goodkk')return 'KK with an ace or connected broadway cards: overpairs plus high straights, nut flushes and top two pair.';
  if((k==='hirun'||k==='midrun')&&run&&f.rt<(k==='hirun'?12:9))return 'Their higher rundown holds the top end of the straights your cards make.';
  if((k==='hirun'||k==='midrun'||k==='smallrun'||k==='pairrun')&&f.best<4)return 'Connected cards make straights and two pair on boards that miss your hand.';
  if(k==='smalldp')return 'Two pairs = two chances at a set.';
  if(k==='unpds')return 'Double-suited with the A or K: two ways to the top flush'+(f.best>=4?', while your rundown needs to hit':'')+'.';
  if(UNP&&f.best>=4)return 'Their high cards make bigger pairs and top-card flushes; your rundown needs to hit.';
  return 'They win '+pct+' vs you on average – no single structural edge; see the reasons under each hand.';}
 if(f.top===12&&(KK||k==='hidp'||k==='mixeddp'||k==='smalldp'||k==='bigpair'||k==='pairrun'||k==='midpair'||k==='lowpair'))return 'Your AA outranks their pairs: your sets and overpairs beat theirs.';
 if(f.top===11&&(k==='bigpair'||k==='midpair'||k==='lowpair'||k==='smalldp'||k==='mixeddp'))return 'Your KK outranks their pairs: your sets and overpairs beat theirs.';
 if((k==='midpair'&&f.top>=8)||(k==='lowpair'&&f.top>=5))return 'Your '+pr(f.top)+' outranks their pairs: your sets and overpairs beat theirs.';
 if(k==='goodkk'&&f.cnt[12]>=1)return 'Your ace blocks their aces: their kings have fewer ways to the top flush or top two pair.';
 if(k==='pairrun'&&run)return 'Their pair wastes a card: your five connected cards make more straights.';
 if(k==='junk')return 'Few high cards, no double-suited nut flush and little connection: they rarely make the nuts against you.';
 if(UNP)return 'Unpaired, disconnected cards rarely make the nuts against you.';
 if(k==='smallrun'&&run&&f.rt>8)return 'Your straights are higher: they often hold the low end.';
 if(k==='smallrun')return 'Low cards: their straights and two pair are often second-best.';
 if(k==='midpair'||k==='lowpair')return 'A '+(k==='lowpair'?'low':'middle')+' pair mostly needs to flop a set to continue.';
 if(k==='smalldp'&&f.top>=8)return 'Their small pairs make small sets: your bigger pairs and draws are ahead.';
 if(k==='smalldp'&&run)return 'Small pairs need a set; your connected cards make straights and two pair more often.';
 return 'They win only '+pct+' vs you on average in this sample.';}
// display-key + vars for i18n; muWhy() stays English (tests assert those strings)
function muWhyParts(k,hero,side,avg){var f=muFeat(hero),RN=MU_RN,pr=function(r){return RN[r]+RN[r];},pct=Math.round(avg*100)+'%',run=f.best>=4&&!f.prs.length,
  KK=(k==='goodkk'||k==='badkk'),PT={aces:12,hidp:8,mixeddp:8,bigpair:8,goodkk:11,badkk:11}[k],UNP=(k==='unpds'||k==='unpbw'||k==='junk');
 if(side>0){
  if(k==='aces'&&f.top===12)return {id:'mu.w.aces',vars:{}};
  if(PT!==undefined&&f.top>=0&&f.top<PT)return {id:'mu.w.bigger.pair',vars:{whatKey:KK?'mu.w.what.kings':k==='aces'?'mu.w.what.aces':'mu.w.what.hpairs',pair:pr(f.top)}};
  if(PT!==undefined&&f.top<0)return {id:'mu.w.over.pair',vars:{whatKey:KK?'mu.w.what.KK':k==='aces'?'mu.w.what.AA':'mu.w.what.hpair'}};
  if(k==='goodkk')return {id:'mu.w.goodkk.up',vars:{}};
  if((k==='hirun'||k==='midrun')&&run&&f.rt<(k==='hirun'?12:9))return {id:'mu.w.higher.run',vars:{}};
  if((k==='hirun'||k==='midrun'||k==='smallrun'||k==='pairrun')&&f.best<4)return {id:'mu.w.conn.miss',vars:{}};
  if(k==='smalldp')return {id:'mu.w.smalldp.up',vars:{}};
  if(k==='unpds')return {id:f.best>=4?'mu.w.unpds.hit':'mu.w.unpds',vars:{}};
  if(UNP&&f.best>=4)return {id:'mu.w.unp.vsrun',vars:{}};
  return {id:'mu.w.generic.up',vars:{pct:pct}};}
 if(f.top===12&&(KK||k==='hidp'||k==='mixeddp'||k==='smalldp'||k==='bigpair'||k==='pairrun'||k==='midpair'||k==='lowpair'))return {id:'mu.w.aa.down',vars:{}};
 if(f.top===11&&(k==='bigpair'||k==='midpair'||k==='lowpair'||k==='smalldp'||k==='mixeddp'))return {id:'mu.w.kk.down',vars:{}};
 if((k==='midpair'&&f.top>=8)||(k==='lowpair'&&f.top>=5))return {id:'mu.w.pair.down',vars:{pair:pr(f.top)}};
 if(k==='goodkk'&&f.cnt[12]>=1)return {id:'mu.w.aceblk',vars:{}};
 if(k==='pairrun'&&run)return {id:'mu.w.pairrun.waste',vars:{}};
 if(k==='junk')return {id:'mu.w.junk',vars:{}};
 if(UNP)return {id:'mu.w.unp.down',vars:{}};
 if(k==='smallrun'&&run&&f.rt>8)return {id:'mu.w.smallrun.hi',vars:{}};
 if(k==='smallrun')return {id:'mu.w.smallrun',vars:{}};
 if(k==='midpair'||k==='lowpair')return {id:k==='lowpair'?'mu.w.lowpair':'mu.w.midpair',vars:{}};
 if(k==='smalldp'&&f.top>=8)return {id:'mu.w.smalldp.hi',vars:{}};
 if(k==='smalldp'&&run)return {id:'mu.w.smalldp.run',vars:{}};
 return {id:'mu.w.generic.down',vars:{pct:pct}};}
/* --- src/core/flop.js
 * Owns: Flop-chances enumeration over all C(47,3)=16,215 flops: FL_MADE/FL_DRAW labels, nut-straight helpers (flTop, flNutTop, flPop, flSt), flHand/flCat and flopOdds (made exclusive, draws overlapping, outs histograms).
 * Depends on: eval.js (eval5, H2). Nut helpers are also used by flop-advanced.js.
 */
// ---- Flop chances: exact over every flop (C(47,3) = 16,215 from the 47 cards you can't see), PLO5 rule = exactly 2 hole + 3 flop cards.
// Made hand = best 2+3 hand on the flop (exclusive rows, sum 100%). Draws (overlap with made rows and with each other) count only when the
// draw is to a better hand class than the made hand: flush draw = 2+ hole cards of a suit with exactly 2 of it on the flop (and no flush or better made);
// straight draw (no straight or better made) = number of ranks whose turn card would complete a straight (live ranks only): 1 gutshot, 2 open-ended / double gutshot, 3+ wrap.
var FL_MADE=[['sf','Straight flush'],['quads','Quads'],['fh','Full house'],['fl','Flush'],['st','Straight'],['set','Set','pocket pair + flop card'],['trips','Trips','paired flop + hole card'],['tp','Two pair'],['pair','One pair'],['hc','High card']];
var FL_DRAW=[['nfd','Nut flush draw'],['fd','Flush draw','not the nut'],['wrap','Wrap','3+ ranks'],['oe','Open-ended','or double gutshot, 2 ranks'],['gs','Gutshot','1 rank'],['combo','Combo draw','flush + open-ended/wrap'],['any','Any draw','flush or straight']];
var FL_WIN=(function(){var w=[(1<<12)|15];for(var hi=4;hi<=12;hi++)w.push(31<<(hi-4));return w;})();
// straights on a board rank mask: highest window index we can make (2 hole + 3 board) / anyone can make (board has 3+ of the window); -1 if none
function flTop(hm,bm){for(var i=FL_WIN.length-1;i>=0;i--){var w=FL_WIN[i],m=w&~bm;if(flPop(m)<=2&&(m&~hm)===0&&flPop(hm&w)>=2)return i;}return -1;}
function flNutTop(bm){for(var i=FL_WIN.length-1;i>=0;i--)if(flPop(FL_WIN[i]&bm)>=3)return i;return -1;}
function flPop(m){var c=0;while(m){m&=m-1;c++;}return c;}
// can 2 hole ranks (mask hm) + 3 board ranks (mask bm) make a straight?
function flSt(hm,bm){for(var i=0;i<FL_WIN.length;i++){var w=FL_WIN[i],m=w&~bm;if(flPop(m)<=2&&(m&~hm)===0&&flPop(hm&w)>=2)return true;}return false;}
// per-hand info for flCat: cards held, rank counts, suit counts, rank mask
function flHand(h){var I={h:h,inH:[],hc:[0,0,0,0,0,0,0,0,0,0,0,0,0],hs:[0,0,0,0],hm:0,fc:[0,0,0,0,0,0,0,0,0,0,0,0,0],fs:[0,0,0,0]};
 for(var i=0;i<5;i++){I.inH[h[i]]=1;I.hc[h[i]>>2]++;I.hs[h[i]&3]++;I.hm|=1<<(h[i]>>2);}return I;}
var FL_CAT=['hc','pair','tp','trips','st','fl','fh','quads','sf'];
// one flop: made key, flush draw (0 none / 1 non-nut / 2 nut), nr = live ranks that complete a straight, outs = live cards of those ranks
function flCat(I,b0,b1,b2){var h=I.h,best=0,x,hc=I.hc,fc=I.fc,fs=I.fs;
 for(x=0;x<10;x++){var v=eval5(h[H2[x][0]],h[H2[x][1]],b0,b1,b2);if(v>best)best=v;}
 var cat=Math.floor(best/1e6),key=FL_CAT[cat];if(cat===3)key=hc[Math.floor((best-3e6)/169)]>=2?'set':'trips';
 fc[b0>>2]++;fc[b1>>2]++;fc[b2>>2]++;fs[b0&3]++;fs[b1&3]++;fs[b2&3]++;
 var fd=0,nr=0,outs=0,su=-1,sm=0;
 if(cat<5)for(var s=0;s<4;s++)if(I.hs[s]>=2&&fs[s]===2){var r=12;while(r>=0&&(r*4+s===b0||r*4+s===b1||r*4+s===b2))r--;fd=I.inH[r*4+s]?2:1;su=s;}
 if(cat<4){var bm=(1<<(b0>>2))|(1<<(b1>>2))|(1<<(b2>>2));for(var r2=0;r2<13;r2++){var live=4-hc[r2]-fc[r2];if(live>0&&!(bm>>r2&1)&&flSt(I.hm,bm|1<<r2)){nr++;outs+=live;sm|=1<<r2;}}}
 fc[b0>>2]--;fc[b1>>2]--;fc[b2>>2]--;fs[b0&3]--;fs[b1&3]--;fs[b2&3]--;
 return {key:key,fd:fd,nr:nr,outs:outs,su:su,sm:sm};}
function flopOdds(h){var I=flHand(h),d=[],i,j,k;for(i=0;i<52;i++)if(!I.inH[i])d.push(i);
 var R={n:0,made:{},draw:{},outs:{wrap:0,oe:0,gs:0},oh:{wrap:{},oe:{},gs:{}}},M=R.made,D=R.draw;FL_MADE.forEach(function(m){M[m[0]]=0;});FL_DRAW.forEach(function(m){D[m[0]]=0;});
 for(k=2;k<d.length;k++)for(j=1;j<k;j++)for(i=0;i<j;i++){var c=flCat(I,d[i],d[j],d[k]),nr=c.nr,fd=c.fd;R.n++;M[c.key]++;
  if(fd===2)D.nfd++;else if(fd===1)D.fd++;
  var dk=nr>=3?'wrap':nr===2?'oe':nr===1?'gs':'';if(dk){D[dk]++;R.outs[dk]+=c.outs;R.oh[dk][c.outs]=(R.oh[dk][c.outs]||0)+1;}
  if(fd&&nr>=2)D.combo++;if(fd||nr)D.any++;}
 return R;}
/* --- src/core/flop-advanced.js
 * Owns: Advanced flop matrix (FLA_G × FLA_D) and flAdv(): outs counted fill-up → flush → straight, each card once, with nut/non-nut split (fN/fX, sN/sX) and discrete mixes (sig).
 * Depends on: eval.js (eval5, H2), flop.js (flHand, flCat, flTop, flNutTop).
 */
// ---- Advanced flop chances: made hand x draw combos, with outs split so no card is counted twice
var FLA_G=[['set','Set'],['top2','Top two pair'],['tp2','Other two pair'],['trips','Trips'],['st','Straight'],['pair','One pair'],['none','No pair']];
var FLA_D=[['fw','flush draw + wrap'],['fs','flush draw + straight draw'],['f','flush draw'],['w','wrap'],['s','straight draw'],['x','no draw']];
// outs on the turn (44 unseen after hand + flop), each card once, in order: fill-up (set/two pair/trips only) = live cards that make a full house or quads
// (only flop or hole ranks can); flush = live cards of the draw suit not already fill-up; straight = live cards of completing ranks, not flush suit, not fill-up
function flAdv(h){var I=flHand(h),d=[],i,j,k,G={},fplus=0,n=0;for(i=0;i<52;i++)if(!I.inH[i])d.push(i);
 FLA_G.forEach(function(g){G[g[0]]={n:0};FLA_D.forEach(function(x){G[g[0]][x[0]]={n:0,f:0,s:0,b:0,fN:0,sN:0,sig:{}};});});
 for(k=2;k<d.length;k++)for(j=1;j<k;j++)for(i=0;i<j;i++){var b0=d[i],b1=d[j],b2=d[k],c=flCat(I,b0,b1,b2),key=c.key,g;n++;
  if(key==='set'||key==='trips'||key==='st'||key==='pair')g=key;else if(key==='hc')g='none';
  else if(key==='tp'){var r0=b0>>2,r1=b1>>2,r2=b2>>2,hi=Math.max(r0,r1,r2),lo=Math.min(r0,r1,r2),mid=r0+r1+r2-hi-lo;g=(hi!==mid&&mid!==lo&&I.hc[hi]&&I.hc[mid])?'top2':'tp2';}
  else{fplus++;continue;}
  var fl=c.fd>0,wr=c.nr>=3,sd=c.nr>0,dk=fl?(wr?'fw':sd?'fs':'f'):(wr?'w':sd?'s':'x'),C=G[g][dk];G[g].n++;C.n++;
  var FU={};if(g==='set'||g==='top2'||g==='tp2'||g==='trips')for(var q=0;q<d.length;q++){var t=d[q],tr=t>>2;
   if(t===b0||t===b1||t===b2||(tr!==b0>>2&&tr!==b1>>2&&tr!==b2>>2&&!I.hc[tr]))continue;
   var B=[b0,b1,b2,t],ok=false;for(var x=0;x<10&&!ok;x++)for(var y=0;y<4&&!ok;y++){var e=[];for(var z=0;z<4;z++)if(z!==y)e.push(B[z]);var v=eval5(h[H2[x][0]],h[H2[x][1]],e[0],e[1],e[2]);if(v>=6e6&&v<8e6)ok=true;}
   if(ok){FU[t]=1;C.b++;}}
  var nb=0,fN=0,fX=0,sN=0,sX=0;for(var fu in FU)nb++;
  // flush out is nut if, with that card on the board, you hold the highest card of the suit not on the board
  if(fl)for(var r1=0;r1<13;r1++){var cf=r1*4+c.su;if(!I.inH[cf]&&cf!==b0&&cf!==b1&&cf!==b2&&!FU[cf]){var tp=12;while(tp*4+c.su===b0||tp*4+c.su===b1||tp*4+c.su===b2||tp*4+c.su===cf)tp--;if(I.inH[tp*4+c.su])fN++;else fX++;}}
  // straight out is nut if your best straight is the highest straight possible on the 4-card board
  if(sd){var bm=(1<<(b0>>2))|(1<<(b1>>2))|(1<<(b2>>2));for(var r=0;r<13;r++)if(c.sm>>r&1){var nut=flTop(I.hm,bm|1<<r)===flNutTop(bm|1<<r);
   for(var s=0;s<4;s++){var cd=r*4+s;if(!I.inH[cd]&&s!==c.su&&!FU[cd]){if(nut)sN++;else sX++;}}}}
  C.f+=fN+fX;C.fN+=fN;C.s+=sN+sX;C.sN+=sN;var sk=nb+','+fN+','+fX+','+sN+','+sX;C.sig[sk]=(C.sig[sk]||0)+1;}
 return {n:n,g:G,fplus:fplus};}
/* --- src/core/range.js
 * Owns: Range-chart layout helpers: RG_COLS (3 family columns), RG_SHORT names, colour scale rgColor (0–30 pts), rgLayout/rgRows/rgPct. Taxonomy is the 16 classes in classes.js; do not change it here.
 * Depends on: classes.js (keys), score.js (A1.PCT). Data: range.json (built by gen_range.js).
 */
// ---- Range chart (Holdem-style, adapted to PLO5): the 16 Matchups classes laid out in 3 family columns, coloured by Approach 1 points.
// Data: range.json (gen_range.js: exact over all 2,598,960 hands). Columns = hand families; each column is sorted by average points,
// trips/quads (not a Matchups class) fill the last cell, greyed out.
var RG_COLS=[['Aces, KK, 2-pair',['aces','hidp','goodkk','badkk','mixeddp','smalldp']],['One pair',['bigpair','pairrun','midpair','lowpair']],['No pair',['hirun','midrun','smallrun','unpds','unpbw','junk']]];
var RG_SHORT={aces:'Aces',hidp:'High 2-pair',goodkk:'Good KK',badkk:'Bad KK',mixeddp:'Mixed 2-pair',smalldp:'Small 2-pair',
 bigpair:'Big pair',pairrun:'Pair + run 77+',midpair:'Mid pair 77–99',lowpair:'Low pair 22–66',hirun:'High run',midrun:'Middle run',smallrun:'Small run',
 unpds:'DS A/K',unpbw:'Broadway',junk:'Junk',trips:'Trips / quads'};
var RG_LO=0,RG_HI=30; // colour scale (points): <=0 deep red ... >=30 deep green; tier cuts 10/12/16/20 sit inside it
function rgLayout(RC){return RG_COLS.map(function(c){var ks=c[1].slice().sort(function(a,b){return RC[b].mean-RC[a].mean;});if(c[0]==='One pair')ks.push('trips');return {name:c[0],keys:ks};});}
function rgRows(L){return Math.max.apply(null,L.map(function(c){return c.keys.length;}));}
function rgColor(p){var t=Math.max(0,Math.min(1,(p-RG_LO)/(RG_HI-RG_LO)));return 'hsl('+Math.round(t*130)+',72%,'+Math.round(50-6*Math.abs(t-0.45))+'%)';}
// percentile (0-100, ties half) of a points value over all 2,598,960 hands, from score_a1.js PCT
function rgPct(p){var x=Math.round(p);return A1.PCT[x]!==undefined?A1.PCT[x]:(x<A1.MINP?0:100);}
/* --- src/core/exports.js
 * Owns: Node export surface for test.js (require("./core.js")) and the trailing // ==ENDCORE== marker that build.js / test.js require (must keep the newline).
 * Depends on: every core module above (names referenced here must stay in scope when this file is concatenated last).
 */
if(typeof module!=='undefined')module.exports={eval5:eval5,evalPLO:evalPLO,mcEquity:mcEquity,parseHand:parseHand,heuristic:heuristic,heuristicLinear:heuristicLinear,heuristicOld:heuristicOld,handStr:handStr,W:W,mcH2H:mcH2H,mcVsRandom:mcVsRandom,T3:T3,T3_LABELS:T3_LABELS,vs3:vs3,A1_LABELS:A1_LABELS,A1_GROUPS:A1_GROUPS,LIN_LABELS:LIN_LABELS,dealByPoints:dealByPoints,dealRange:dealRange,ptsBetween:ptsBetween,listedHands:listedHands,botRanks:botRanks,ptsAtLeast:ptsAtLeast,ptsRange:ptsRange,colexUnrank:colexUnrank,topRanks:topRanks,MU_CLASSES:MU_CLASSES,muFeat:muFeat,handClass:handClass,sampleClass:sampleClass,matchups:matchups,muWhy:muWhy,muWhyParts:muWhyParts,muEq:muEq,muReasons:muReasons,muBreak:muBreak,muStBreak:muStBreak,MU_BD:MU_BD,MU_BDN:MU_BDN,muPick:muPick,muGen:muGen,muPool:muPool,muSt:muSt,muRun:muRun,FL_MADE:FL_MADE,FL_DRAW:FL_DRAW,flopOdds:flopOdds,flSt:flSt,flHand:flHand,flCat:flCat,flAdv:flAdv,flTop:flTop,flNutTop:flNutTop,FLA_G:FLA_G,FLA_D:FLA_D,RG_COLS:RG_COLS,RG_SHORT:RG_SHORT,rgLayout:rgLayout,rgRows:rgRows,rgColor:rgColor,rgPct:rgPct,A1:A1};
// ==ENDCORE==
