/* Game logic, UI, dice, sound, confetti. Classic scripts so index.html works by double-click. */
(async function(){const S=window.SL,$=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches,esc=s=>s.replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');
let D;try{const [c,b]=await Promise.all(['data/config.json','data/boards.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw 0;return r.json()})));D={c,b}}catch(e){D=S.fallback}
D.b.forEach(b=>b.paths=b.snakes.map((s,k)=>S.snakePath(s[0],s[1],k)));
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
const cfg=Object.assign({n:2,cpu:[0,1,1,1],names:[],board:0,exact:D.c.rules.exact,again:D.c.rules.again,mute:false},store.get('sl.cfg',{}));
/* ---- sound ---- */
let AC;const tone=(f,d=.1,ty='sine',v=.14,at=0,f2)=>{if(cfg.mute)return;try{AC=AC||new AudioContext();const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime+at;o.type=ty;o.frequency.setValueAtTime(f,t);f2&&o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(AC.destination);o.start(t);o.stop(t+d)}catch(e){}};
const sfx={roll:()=>[0,1,2,3,4].forEach(i=>tone(200+Math.random()*300,.05,'square',.05,i*.07)),hop:n=>tone(380+n*5,.09,'triangle'),up:()=>[523,659,784,1046].forEach((f,i)=>tone(f,.16,'triangle',.15,i*.09)),down:()=>tone(520,.8,'sawtooth',.09,0,80),win:()=>[523,659,784,1046,1318].forEach((f,i)=>tone(f,.35,'triangle',.18,i*.13))};
/* ---- setup screen ---- */
const saveCfg=()=>store.set('sl.cfg',cfg);
function drawPreview(){const b=D.b[cfg.board];S.paint($('#pv'),b,Math.min(540,$('#pv').parentElement.clientWidth-24||400));$('#pvd').textContent=b.note}
function renderSetup(){
 $('#count').innerHTML=[1,2,3,4].map(n=>`<button type="button" aria-pressed="${n==cfg.n}" data-n="${n}">${n==1?'Solo':n+' players'}</button>`).join('');
 $('#rows').innerHTML=Array.from({length:cfg.n},(_,i)=>`<div class="prow"><i style="background:${D.c.colors[i].hex}"></i><input type="text" maxlength="14" aria-label="Player ${i+1} name" data-i="${i}" value="${esc(cfg.names[i]||(cfg.cpu[i]?D.c.cpuNames[i]:D.c.names[i]))}"><label class="chk"><input type="checkbox" data-c="${i}" ${cfg.cpu[i]?'checked':''}> CPU</label></div>`).join('');
 $('#boards').innerHTML=D.b.map((b,i)=>`<button type="button" aria-pressed="${i==cfg.board}" data-b="${i}">${b.name}</button>`).join('');
 $('#exact').checked=cfg.exact;$('#again').checked=cfg.again;drawPreview()}
$('#count').onclick=e=>{const n=e.target.dataset.n;if(n){cfg.n=+n;renderSetup()}};
$('#boards').onclick=e=>{const b=e.target.dataset.b;if(b!=null){cfg.board=+b;renderSetup()}};
$('#rows').oninput=e=>{const t=e.target;if(t.dataset.i!=null)cfg.names[t.dataset.i]=t.value;if(t.dataset.c!=null){cfg.cpu[t.dataset.c]=+t.checked;cfg.names[t.dataset.c]='';renderSetup()}};
$('#exact').onchange=e=>cfg.exact=e.target.checked;$('#again').onchange=e=>cfg.again=e.target.checked;
addEventListener('resize',()=>!$('#setup').hidden&&drawPreview());
/* ---- dice ---- */
const cube=document.createElement('div');cube.className='cube';$('#die').append(cube);
const PIPS={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]},FACE={1:[0,0],2:[0,-90],3:[-90,0],4:[90,0],5:[0,90],6:[0,180]};
for(let f=1;f<=6;f++){const d=document.createElement('div');d.className='face f'+f;d.innerHTML=Array.from({length:9},(_,i)=>`<span class="pip${PIPS[f].includes(i)?' on':''}"></span>`).join('');cube.append(d)}
let spin=0;const rollDie=v=>{spin++;const[x,y]=FACE[v];cube.style.transform=`rotateX(${x+720*spin}deg) rotateY(${y+720*spin}deg)`;return sleep(RM?120:950)};
/* ---- game ---- */
let G,cache,run=false;
const anim=(ms,f)=>new Promise(r=>{const s=performance.now(),d=RM?1:ms;(function k(n){const t=Math.min(1,(n-s)/d);f(t);t<1?requestAnimationFrame(k):r()})(s)});
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2,cur=()=>G.p[G.i];
function log(p,msg){const li=document.createElement('li');li.innerHTML=`<b style="color:${p.col}">${esc(p.name)}</b> ${msg}`;$('#log').append(li);$('#log').scrollTop=1e9}
async function banner(t,k){const b=$('#banner');b.textContent=t;b.className='on '+k;await sleep(RM?400:1100);b.className=''}
function renderPlayers(){$('#plist').innerHTML=G.p.map((p,i)=>`<div class="pc${i==G.i?' act':''}" ${i==G.i?'aria-current="true"':''}><i style="background:${p.col}"></i><b>${esc(p.name)}${p.cpu?' (CPU)':''}</b><small>Square ${p.pos||'start'}: ${p.rolls} rolls, ${p.up} ladders, ${p.dn} snakes</small><div class="bar"><span style="width:${p.pos}%;background:${p.col}"></span></div></div>`).join('')}
function startGame(){
 const b=D.b[cfg.board];G={b,jump:{},i:0,busy:0,over:0,exact:cfg.exact,again:cfg.again,p:Array.from({length:cfg.n},(_,i)=>{const t=S.tray(i);return{name:(cfg.names[i]||(cfg.cpu[i]?D.c.cpuNames[i]:D.c.names[i])).trim()||'Player '+(i+1),col:D.c.colors[i].hex,cpu:!!cfg.cpu[i],pos:0,x:t.x,y:t.y,h:0,ox:0,oy:0,rolls:0,up:0,dn:0}})};
 b.ladders.forEach(([a,t])=>G.jump[a]={to:t,up:1});b.snakes.forEach(([a,t],k)=>G.jump[a]={to:t,k});
 saveCfg();$('#setup').hidden=true;$('#game').hidden=false;$('#log').innerHTML='';
 log(G.p[0],cfg.n==1?'is on a solo run. Reach 100 in the fewest rolls.':'goes first.');renderPlayers();fit();if(!run){run=true;frame()}next(0)}
function fit(){const f=$('#frame'),w=f.clientWidth-24,cv=$('#bd');if(w<50)return;cache=document.createElement('canvas');S.paint(cache,G.b,w);cv.width=cache.width;cv.height=cache.height}
new ResizeObserver(()=>G&&!$('#game').hidden&&fit()).observe($('#frame'));
const OFF={2:[[-.18,0],[.18,0]],3:[[-.2,.05],[.2,.05],[0,-.12]],4:[[-.2,-.1],[.2,-.1],[-.2,.12],[.2,.12]]};
function pawn(g,x,y,col,act,t){g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(x,y+.2,.16,.06,0,0,7);g.fill();
 if(act){g.strokeStyle='#ffc13b';g.globalAlpha=.5+.4*Math.sin(t/180);g.lineWidth=.04;g.beginPath();g.ellipse(x,y+.2,.24,.1,0,0,7);g.stroke();g.globalAlpha=1}
 const gr=g.createLinearGradient(x-.15,0,x+.15,0);gr.addColorStop(0,col);gr.addColorStop(.4,'#fff9');gr.addColorStop(1,col);
 g.fillStyle=col;g.strokeStyle='#0006';g.lineWidth=.02;g.beginPath();g.moveTo(x-.15,y+.2);g.quadraticCurveTo(x-.04,y,x-.06,y-.07);g.lineTo(x+.06,y-.07);g.quadraticCurveTo(x+.04,y,x+.15,y+.2);g.closePath();g.fill();g.stroke();
 g.fillStyle=gr;g.globalAlpha=.55;g.fill();g.globalAlpha=1;
 const rg=g.createRadialGradient(x-.03,y-.17,.01,x,y-.12,.11);rg.addColorStop(0,'#fff');rg.addColorStop(.35,col);rg.addColorStop(1,col);g.fillStyle=rg;g.beginPath();g.arc(x,y-.12,.1,0,7);g.fill();g.stroke()}
function frame(t){requestAnimationFrame(frame);if(!G||$('#game').hidden||!cache)return;const cv=$('#bd'),g=cv.getContext('2d'),s=cv.width/10;
 g.setTransform(1,0,0,1,0,0);g.drawImage(cache,0,0);g.setTransform(s,0,0,s,0,0);
 [...G.p].sort((a,b)=>a.y-b.y).forEach(p=>{const m=p.pos?G.p.filter(q=>q.pos==p.pos&&!q.mv):[p],o=m.length>1&&!p.mv?OFF[m.length][m.indexOf(p)]:[0,0];
  p.ox+=(o[0]-p.ox)*.25;p.oy+=(o[1]-p.oy)*.25;pawn(g,p.x+p.ox,p.y+p.oy-p.h,p.col,p==cur()&&!G.over,t)})}
async function turn(){if(G.busy||G.over)return;G.busy=1;$('#roll').disabled=true;const p=cur(),v=1+Math.floor(Math.random()*6);
 sfx.roll();await rollDie(v);p.rolls++;log(p,`rolled a <b>${v}</b>.`);
 let t=p.pos,d=1;const steps=[];if(!(G.exact&&p.pos+v>100)){for(let k=0;k<v;k++){if(t==100)d=-1;t+=d;steps.push(t)}}else log(p,'needs an exact roll to finish.');
 p.mv=1;for(const s of steps){const a=p.pos?S.cell(p.pos):{x:p.x,y:p.y},b=S.cell(s);sfx.hop(s%20);
  await anim(210,u=>{p.x=a.x+(b.x-a.x)*u;p.y=a.y+(b.y-a.y)*u;p.h=Math.sin(Math.PI*u)*.35});p.pos=s;p.h=0;renderPlayers()}
 const j=G.jump[p.pos];
 if(j){const a=S.cell(p.pos),b=S.cell(j.to),path=j.up?null:G.b.paths[j.k];await sleep(RM?50:250);
  if(j.up){p.up++;log(p,`climbed a ladder from ${p.pos} to ${j.to}.`);sfx.up();banner('Ladder! '+p.pos+' to '+j.to,'up')}else{p.dn++;log(p,`was bitten by a snake: ${p.pos} down to ${j.to}.`);sfx.down();banner('Snake! '+p.pos+' down to '+j.to,'snake')}
  await anim(j.up?1000:1300,u=>{const e=ease(u);if(path){const q=path[Math.round(e*(path.length-1))];p.x=q.x;p.y=q.y}else{p.x=a.x+(b.x-a.x)*e;p.y=a.y+(b.y-a.y)*e}p.h=j.up?Math.abs(Math.sin(u*Math.PI*6))*.08:0});
  p.pos=j.to;renderPlayers()}
 p.mv=0;
 if(p.pos==100){G.over=1;return win(p)}
 const again=G.again&&v==6;if(again)log(p,'rolled a 6 and goes again.');next(again?0:1)}
function next(adv){G.i=(G.i+adv)%G.p.length;G.busy=0;renderPlayers();const p=cur();$('#roll').disabled=p.cpu;$('#roll').textContent=p.cpu?p.name+' is rolling':'Roll dice';if(p.cpu)setTimeout(turn,RM?200:900)}
$('#roll').onclick=()=>!cur().cpu&&turn();
addEventListener('keydown',e=>{if(e.code=='Space'&&G&&!$('#game').hidden&&!/INPUT|BUTTON/.test(e.target.tagName)&&!$('#win').open){e.preventDefault();!cur().cpu&&turn()}});
/* ---- win + confetti ---- */
function confetti(){if(RM)return;const c=$('#cf'),g=c.getContext('2d');c.width=innerWidth;c.height=innerHeight;const P=Array.from({length:160},()=>({x:Math.random()*c.width,y:-20-Math.random()*c.height*.5,vx:Math.random()*4-2,vy:2+Math.random()*4,s:5+Math.random()*7,c:['#ff5d6c','#3fb8ff','#ffc13b','#a086ff','#2bb38a'][Math.random()*5|0],r:Math.random()*6}));let n=0;
 (function k(){g.clearRect(0,0,c.width,c.height);P.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.r+=.15;g.fillStyle=p.c;g.save();g.translate(p.x,p.y);g.rotate(p.r);g.fillRect(-p.s/2,-p.s/4,p.s,p.s/2);g.restore()});++n<260?requestAnimationFrame(k):g.clearRect(0,0,c.width,c.height)})()}
function win(p){sfx.win();confetti();const key='sl.best.'+G.b.id+(G.exact?'x':''),best=store.get(key,null);let extra='';
 if(G.p.length==1){const nb=!best||p.rolls<best;if(nb)store.set(key,p.rolls);extra=`<p>${p.rolls} rolls. ${nb?'New best!':'Best: '+best+' rolls.'}</p>`}
 const rank=[...G.p].sort((a,b)=>b.pos-a.pos);
 $('#win').innerHTML=`<h2>${esc(p.name)} wins!</h2>${extra}<ol>${rank.map(q=>`<li>${esc(q.name)}: square ${q.pos}, ${q.rolls} rolls</li>`).join('')}</ol><div class="row"><button class="go" id="again2">Play again</button><button class="ghost" id="menu2">Change setup</button></div>`;
 $('#win').showModal();$('#again2').onclick=()=>{$('#win').close();startGame()};$('#menu2').onclick=()=>{$('#win').close();menu()}}
function menu(){G=null;$('#game').hidden=true;$('#setup').hidden=true;$('#chess').hidden=true;$('#checkers').hidden=true;$('#flappy').hidden=true;$('#goyman').hidden=true;flappy.running=false;goyman.running=false;$('#landing').hidden=false;renderSetup()}
function openSetup(){$('#landing').hidden=true;$('#setup').hidden=false;renderSetup()}
$('#play-snakes').onclick=openSetup;
$('#back-menu').onclick=menu;
$('#quit').onclick=()=>confirm('Leave this game and go back to the menu?')&&menu();
$('#mute').onclick=e=>{cfg.mute=!cfg.mute;e.target.textContent=cfg.mute?'Sound off':'Sound on';saveCfg()};$('#mute').textContent=cfg.mute?'Sound off':'Sound on';
$('#form').onsubmit=e=>{e.preventDefault();startGame()};
renderSetup();

/* ---- Advance Chess ---- */
const chessPieces={
 r:'♜',n:'♞',b:'♝',q:'♛',k:'♚',p:'♟',
 R:'♖',N:'♘',B:'♗',Q:'♕',K:'♔',P:'♙'
};
let chessState;
function resetChess(){
 chessState={turn:'w',selected:null,moves:{w:0,b:0},captured:[]};
 chessState.board=[
  ['r','n','b','q','k','b','n','r'],
  ['p','p','p','p','p','p','p','p'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['P','P','P','P','P','P','P','P'],
  ['R','N','B','Q','K','B','N','R']
 ];
 renderChess();
}
function chessColor(piece){return piece ? (piece===piece.toUpperCase()?'w':'b') : null}
function clearValidSquares(){
 document.querySelectorAll('.chess-square.valid').forEach(s=>s.classList.remove('valid','capture'));
}
function pathClear(board,fr,to){
 const dr=Math.sign(to.r-fr.r),dc=Math.sign(to.c-fr.c);
 let r=fr.r+dr,c=fr.c+dc;
 while(r!==to.r||c!==to.c){if(board[r][c])return false;r+=dr;c+=dc}
 return true;
}
function validChessMove(board,fr,to){
 const piece=board[fr.r][fr.c],target=board[to.r][to.c];
 if(!piece||chessColor(piece)===chessColor(target))return false;
 const lower=piece.toLowerCase(),dr=to.r-fr.r,dc=to.c-fr.c,wr=chessColor(piece)==='w';
 if(lower==='p'){
  const dir=wr?-1:1,start=wr?6:1;
  if(dc===0&&!target&&dr===dir)return true;
  if(dc===0&&!target&&fr.r===start&&dr===dir*2&&board[fr.r+dir][fr.c]===null)return true;
  return Math.abs(dc)===1&&dr===dir&&target!==null;
 }
 if(lower==='n')return (Math.abs(dr)===2&&Math.abs(dc)===1)||(Math.abs(dr)===1&&Math.abs(dc)===2);
 if(lower==='b')return Math.abs(dr)===Math.abs(dc)&&pathClear(board,fr,to);
 if(lower==='r')return (dr===0||dc===0)&&pathClear(board,fr,to);
 if(lower==='q')return (dr===0||dc===0||Math.abs(dr)===Math.abs(dc))&&pathClear(board,fr,to);
 if(lower==='k')return Math.max(Math.abs(dr),Math.abs(dc))===1;
 return false;
}
function showChessMoves(r,c){
 clearValidSquares();
 chessState.selected={r,c};
 const board=chessState.board;
 for(let tr=0;tr<8;tr++)for(let tc=0;tc<8;tc++){
  if(validChessMove(board,{r,c},{r:tr,c:tc})){
   const square=document.querySelector(`.chess-square[data-r="${tr}"][data-c="${tc}"]`);
   square.classList.add('valid');
   if(board[tr][tc])square.classList.add('capture');
  }
 }
}
function renderChess(){
 const board=$('#chess-board');board.innerHTML='';
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const piece=chessState.board[r][c],sq=document.createElement('button');
  sq.type='button';sq.className=`chess-square ${(r+c)%2?'dark':'light'}`;
  sq.dataset.r=r;sq.dataset.c=c;
  if(chessState.selected&&chessState.selected.r===r&&chessState.selected.c===c)sq.classList.add('selected');
  if(piece){const team=chessColor(piece);sq.innerHTML=`<span class="chess-piece ${team==='w'?'white':'black'}">${chessPieces[piece]}</span>`}
  sq.setAttribute('aria-label',`Square ${String.fromCharCode(65+c)}${8-r}`);
  sq.onclick=()=>clickChessSquare(r,c);board.append(sq);
 }
 $('#chess-status').textContent=chessState.turn==='w'?`White's turn`:`Black's turn`;
 $('#white-moves').textContent=`${chessState.moves.w} moves`;
 $('#black-moves').textContent=`${chessState.moves.b} moves`;
 $('#captured-pieces').textContent=chessState.captured.length?chessState.captured.map(p=>chessPieces[p]).join(' '):'None';
}
function clickChessSquare(r,c){
 const board=chessState.board,piece=board[r][c],selected=chessState.selected;
 if(selected){
  if(validChessMove(board,selected,{r,c})&&chessColor(board[selected.r][selected.c])===chessState.turn){
   const moving=board[selected.r][selected.c],captured=board[r][c];
   if(captured)chessState.captured.push(captured);
   board[r][c]=moving;board[selected.r][selected.c]=null;
   if(moving==='P'&&r===0)board[r][c]='Q';
   if(moving==='p'&&r===7)board[r][c]='q';
   chessState.moves[chessState.turn]++;
   chessState.selected=null;chessState.turn=chessState.turn==='w'?'b':'w';
   renderChess();return;
  }
  if(chessColor(piece)===chessState.turn){showChessMoves(r,c);renderChess();showChessMoves(r,c);return}
  chessState.selected=null;renderChess();return;
 }
 if(chessColor(piece)===chessState.turn){showChessMoves(r,c);renderChess();showChessMoves(r,c)}
}
function openChess(){$('#landing').hidden=true;$('#chess').hidden=false;resetChess()}
$('#play-chess').onclick=openChess;
$('#back-from-chess').onclick=menu;
$('#reset-chess').onclick=resetChess;

/* ---- Checkers ---- */
let checkersState;
function resetCheckers(){
 checkersState={turn:'w',selected:null,captured:[],lastCapture:null};
 checkersState.board=Array.from({length:8},()=>Array(8).fill(null));
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  if((r+c)%2===1){
   if(r<3)checkersState.board[r][c]='b';
   if(r>4)checkersState.board[r][c]='w';
  }
 }
 renderCheckers();
}
function checkersColor(piece){return piece?piece.toLowerCase():null}
function isKing(piece){return piece&&piece===piece.toUpperCase()}
function checkersDirections(piece){
 if(isKing(piece))return [[-1,-1],[-1,1],[1,-1],[1,1]];
 return checkersColor(piece)==='w'?[[-1,-1],[-1,1]]:[[1,-1],[1,1]];
}
function checkersCaptures(r,c,board){
 const piece=board[r][c],moves=[];
 if(!piece)return moves;
 for(const [dr,dc] of checkersDirections(piece)){
  let distance=1,enemy=null;
  while(true){
   const tr=r+dr*distance,tc=c+dc*distance;
   if(tr<0||tr>=8||tc<0||tc>=8)break;
   const target=board[tr][tc];
   if(!enemy){
    if(!target){distance++;continue}
    if(checkersColor(target)===checkersColor(piece))break;
    enemy=[tr,tc];distance++;continue;
   }
   if(target)break;
   moves.push({r:tr,c:tc,capture:enemy});
   distance++;
  }
 }
 return moves;
}
function allCheckersCaptures(turn,board){
 const moves=[];
 for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(checkersColor(board[r][c])===turn)moves.push(...checkersCaptures(r,c,board).map(m=>({...m,from:[r,c]})));
 return moves;
}
function checkersMoves(r,c,board){
 const captures=allCheckersCaptures(checkersState.turn,board);
 if(captures.length)return captures.filter(m=>m.from[0]===r&&m.from[1]===c);
 const piece=board[r][c],moves=[];
 if(!piece)return moves;
 for(const [dr,dc] of checkersDirections(piece)){
  for(let distance=1;distance<8;distance++){
   const tr=r+dr*distance,tc=c+dc*distance;
   if(tr<0||tr>=8||tc<0||tc>=8||board[tr][tc]!==null)break;
   moves.push({r:tr,c:tc});
  }
 }
 return moves;
}
function renderCheckers(){
 const boardEl=$('#checkers-board');boardEl.innerHTML='';
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  const piece=checkersState.board[r][c],sq=document.createElement('button');
  sq.type='button';sq.className=`chess-square ${(r+c)%2?'dark':'light'}`;
  sq.dataset.r=r;sq.dataset.c=c;
  if(checkersState.selected&&checkersState.selected.r===r&&checkersState.selected.c===c)sq.classList.add('selected');
  if(piece){
   const team=checkersColor(piece),king=isKing(piece)?' king':'';
   sq.innerHTML=`<span class="checkers-piece ${team==='w'?'white':'black'}${king}"></span>`;
  }
  sq.setAttribute('aria-label',`Checkers square ${String.fromCharCode(65+c)}${8-r}`);
  sq.onclick=()=>clickCheckersSquare(r,c);boardEl.append(sq);
 }
 let white=0,black=0;
 checkersState.board.flat().forEach(p=>{if(checkersColor(p)==='w')white++;if(checkersColor(p)==='b')black++});
 $('#white-pieces').textContent=`${white} pieces`;
 $('#black-pieces').textContent=`${black} pieces`;
 $('#checkers-captured').textContent=checkersState.captured.length?`${checkersState.captured.length} pieces`: 'None';
 $('#checkers-status').textContent=checkersState.lastCapture?`Continue ${checkersState.turn==='w'?'White':'Black'} capture`:(checkersState.turn==='w'?`White's turn`:`Black's turn`);
 if(!white||!black)$('#checkers-status').textContent=`${white?'White':'Black'} wins!`;
 else if(!allCheckersCaptures(checkersState.turn,checkersState.board).length){
  let hasMove=false;
  for(let r=0;r<8&&!hasMove;r++)for(let c=0;c<8&&!hasMove;c++)if(checkersColor(checkersState.board[r][c])===checkersState.turn&&checkersMoves(r,c,checkersState.board).length)hasMove=true;
  if(!hasMove)$('#checkers-status').textContent=`${checkersState.turn==='w'?'Black':'White'} wins!`;
 }
}
function showCheckersMoves(r,c){
 document.querySelectorAll('.chess-square.valid').forEach(s=>s.classList.remove('valid','capture'));
 checkersState.selected={r,c};
 for(const move of checkersMoves(r,c,checkersState.board)){
  const sq=document.querySelector(`#checkers-board .chess-square[data-r="${move.r}"][data-c="${move.c}"]`);
  if(sq){sq.classList.add('valid');if(move.capture)sq.classList.add('capture')}
 }
}
function clickCheckersSquare(r,c){
 const board=checkersState.board,piece=board[r][c],selected=checkersState.selected;
 if(selected){
  const move=checkersMoves(selected.r,selected.c,board).find(m=>m.r===r&&m.c===c);
  if(move){
   const moving=board[selected.r][selected.c];board[selected.r][selected.c]=null;
   if(move.capture){const[mr,mc]=move.capture;checkersState.captured.push(board[mr][mc]);board[mr][mc]=null}
   board[r][c]=moving;
   if(moving==='w'&&r===0)board[r][c]='W';
   if(moving==='b'&&r===7)board[r][c]='B';
   if(move.capture&&checkersCaptures(r,c,board).length){checkersState.lastCapture={r,c};checkersState.selected={r,c};renderCheckers();showCheckersMoves(r,c);return}
   checkersState.lastCapture=null;checkersState.selected=null;checkersState.turn=checkersState.turn==='w'?'b':'w';renderCheckers();return;
  }
  if(checkersState.lastCapture)return;
 }
 if(checkersColor(piece)===checkersState.turn){
  showCheckersMoves(r,c);renderCheckers();showCheckersMoves(r,c);
 }else if(!selected){checkersState.selected=null;renderCheckers()}
}
function openCheckers(){$('#landing').hidden=true;$('#checkers').hidden=false;resetCheckers()}
$('#play-checkers').onclick=openCheckers;
$('#back-from-checkers').onclick=menu;
$('#reset-checkers').onclick=resetCheckers;

/* ---- Flappy Goy ---- */
const flappy={
 running:false,paused:false,started:false,raf:0,last:0,
 score:0,best:+(localStorage.getItem('flappyGoyBest')||0),
 slow:5,dash:5,destroy:5,gun:3,
 slowTimer:0,dashTimer:0,invincible:0,
 clouds:[],walls:[],pickups:[],bullets:[],particles:[]
};
function flappyReset(){
 flappy.running=false;flappy.paused=false;flappy.started=false;flappy.score=0;
 flappy.slow=5;flappy.dash=5;flappy.destroy=5;flappy.gun=3;
 flappy.slowTimer=0;flappy.dashTimer=0;flappy.invincible=0;
 flappy.bird={x:220,y:250,v:0,r:22,wing:0};
 flappy.walls=[];flappy.pickups=[];flappy.bullets=[];flappy.particles=[];
 flappy.clouds=Array.from({length:8},(_,i)=>({x:i*150-Math.random()*80,y:55+Math.random()*150,s:.7+Math.random()*.7}));
 $('#flappy-score').textContent='0';$('#flappy-best').textContent='Best '+flappy.best;
 $('#flappy-overlay').classList.remove('off');
 $('#flappy-overlay').innerHTML='<div class="flappy-logo">Flappy <span>Goy</span></div><p>Fly through the walls. Use powers wisely.</p><button id="flappy-start" class="go" type="button">Start flight</button>';
 $('#flappy-start').onclick=startFlappy;
 $('#flappy-pause').textContent='Pause';
 updateFlappyPowerUI();
 drawFlappy(performance.now());
}
function updateFlappyPowerUI(){
 $('#destroy-count').textContent=flappy.destroy;
 $('#gun-count').textContent=flappy.gun;
}
function spawnWall(){
 const w=92,gap=190,min=80,max=445;
 const gapY=min+Math.random()*Math.max(1,max-min);
 const wall={x:1020,w,gapY,gap,ap:''};
 flappy.walls.push(wall);
 if(Math.random()<.32){
  const types=['slow','dash','destroy','gun'];
  wall.pickup={x:1020+w/2,y:gapY,type:types[Math.floor(Math.random()*types.length)],taken:false};
  flappy.pickups.push(wall.pickup);
 }
}
function startFlappy(){
 flappyReset();flappy.started=true;flappy.running=true;flappy.paused=false;
 $('#flappy-overlay').classList.add('off');
 spawnWall();flappy.last=performance.now();
 updateFlappyPowerUI();
 cancelAnimationFrame(flappy.raf);flappyLoop(flappy.last);
}
function flap(){
 if(!flappy.started||flappy.paused)return;
 flappy.bird.v=-6.2;flappy.bird.wing=1;
 burst(flappy.bird.x-18,flappy.bird.y, '#fff7a8',5);
}
function burst(x,y,color,n){
 for(let i=0;i<n;i++)flappy.particles.push({x,y,vx:-1-Math.random()*3,vy:-2+Math.random()*4,life:30+Math.random()*20,color,size:3+Math.random()*5});
}
function collectFlappyPickup(pickup){
 if(pickup.taken)return;
 pickup.taken=true;
 const labels={slow:['#9c86ff','Time Slow activated'],dash:['#62d8ee','Dash activated'],destroy:['#ff8065','Next wall destroyed'],gun:['#ffd166','Gun shot fired']};
 const [color,message]=labels[pickup.type];
 burst(pickup.x,pickup.y,color,18);
 if(pickup.type==='slow')flappy.slowTimer=300;
 if(pickup.type==='dash'){flappy.dashTimer=55;flappy.invincible=70;flappy.bird.v=-2}
 if(pickup.type==='destroy'&&flappy.destroy>0){
  const wall=flappy.walls.filter(w=>!w.destroyed&&w.x+w.w>flappy.bird.x).sort((a,b)=>a.x-b.x)[0];
  if(wall){flappy.destroy--;wall.destroyed=true;burst(wall.x+wall.w/2,wall.gapY,'#ff8065',30)}
 }
 if(pickup.type==='gun'&&flappy.gun>0){
  flappy.gun--;flappy.bullets.push({x:flappy.bird.x+28,y:flappy.bird.y,vx:18});
 }
 updateFlappyPowerUI();
}
function toggleFlappyPause(){
 if(!flappy.started)return;
 flappy.paused=!flappy.paused;
 $('#flappy-pause').textContent=flappy.paused?'Resume':'Pause';
 if(!flappy.paused){flappy.last=performance.now();flappyLoop(flappy.last)}
}
function endFlappy(){
 flappy.running=false;flappy.started=false;
 if(flappy.score>flappy.best){flappy.best=flappy.score;localStorage.setItem('flappyGoyBest',flappy.best)}
 burst(flappy.bird.x,flappy.bird.y,'#ff6f61',25);
 $('#flappy-overlay').innerHTML=`<div class="flappy-logo">Game <span>Over</span></div><p>Score ${flappy.score} · Best ${flappy.best}</p><button id="flappy-start" class="go" type="button">Fly again</button>`;
 $('#flappy-overlay').classList.remove('off');$('#flappy-start').onclick=startFlappy;
 updateFlappyPowerUI();
}
function drawFlappy(now){
 const c=$('#flappy-canvas'),g=c.getContext('2d'),w=c.width,h=c.height;
 const sky=g.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#55bfe9');sky.addColorStop(.72,'#9fe4f4');sky.addColorStop(1,'#eaf9d2');g.fillStyle=sky;g.fillRect(0,0,w,h);
 g.fillStyle='#ffffff55';
 flappy.clouds.forEach(cloud=>{g.beginPath();g.arc(cloud.x,cloud.y,34*cloud.s,0,7);g.arc(cloud.x+38*cloud.s,cloud.y-8*cloud.s,42*cloud.s,0,7);g.arc(cloud.x+82*cloud.s,cloud.y,31*cloud.s,0,7);g.fill()});
 g.fillStyle='#6bcf84';g.beginPath();g.moveTo(0,430);for(let x=0;x<=w;x+=60)g.quadraticCurveTo(x+30,380+(x%120?18:-18),x+60,430);g.lineTo(w,h);g.lineTo(0,h);g.fill();
 g.fillStyle='#78aa52';g.fillRect(0,478,w,62);g.fillStyle='#91c75d';for(let x=0;x<w;x+=42){g.beginPath();g.moveTo(x,478);g.lineTo(x+21,462);g.lineTo(x+42,478);g.fill()}
 flappy.walls.forEach(wall=>{
  if(wall.destroyed)return;
  const x=wall.x,gap=wall.gapY,gw=wall.w;
  const grad=g.createLinearGradient(x,0,x+gw,0);grad.addColorStop(0,'#159a69');grad.addColorStop(.5,'#59df9a');grad.addColorStop(1,'#147553');
  g.fillStyle=grad;g.strokeStyle='#0d6049';g.lineWidth=5;
  g.fillRect(x,0,gw,gap-95);g.strokeRect(x,-5,gw,gap-90);
  g.fillRect(x,gap+95,gw,h-gap-95);g.strokeRect(x,gap+95,gw,h-gap-95);
  g.fillStyle='#91f3bd55';g.fillRect(x+12,0,14,gap-95);g.fillRect(x+12,gap+95,14,h-gap-95);
 });
 flappy.pickups.forEach(pickup=>{
  if(pickup.taken)return;
  const colors={slow:'#9c86ff',dash:'#62d8ee',destroy:'#ff8065',gun:'#ffd166'};
  const symbols={slow:'◷',dash:'➤',destroy:'✦',gun:'⌖'};
  g.save();g.translate(pickup.x,pickup.y);g.rotate(now/300);
  g.shadowColor=colors[pickup.type];g.shadowBlur=18;
  g.fillStyle=colors[pickup.type];g.beginPath();g.arc(0,0,23,0,7);g.fill();
  g.fillStyle='#fff';g.font='800 26px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(symbols[pickup.type],0,1);
  g.restore();
 });
 flappy.bullets.forEach(b=>{g.fillStyle='#ffd166';g.beginPath();g.arc(b.x,b.y,7,0,7);g.fill();g.fillStyle='#fff';g.fillRect(b.x-22,b.y-3,20,6)});
 flappy.particles.forEach(p=>{g.globalAlpha=Math.max(0,p.life/50);g.fillStyle=p.color;g.beginPath();g.arc(p.x,p.y,p.size,0,7);g.fill();g.globalAlpha=1});
 const b=flappy.bird;
 g.save();g.translate(b.x,b.y);
 if(flappy.dashTimer>0||flappy.invincible>0){g.shadowColor='#67dcff';g.shadowBlur=24}
 g.rotate(Math.max(-.5,Math.min(.8,b.v*.06)));
 g.fillStyle='#ffcf57';g.beginPath();g.ellipse(0,0,27,21,0,0,7);g.fill();g.strokeStyle='#b86d2f';g.lineWidth=4;g.stroke();
 g.fillStyle='#fff';g.beginPath();g.arc(12,-7,8,0,7);g.fill();g.fillStyle='#26335c';g.beginPath();g.arc(15,-7,3,0,7);g.fill();
 g.fillStyle='#ff884d';g.beginPath();g.moveTo(24,-3);g.lineTo(42,5);g.lineTo(24,10);g.closePath();g.fill();
 g.fillStyle='#f1a93b';g.beginPath();g.ellipse(-12,7,17,9+b.wing*5,-.5,0,7);g.fill();g.restore();
 g.fillStyle='#26335c';g.font='800 44px "Baloo 2",sans-serif';g.textAlign='right';g.fillText(flappy.score,w-30,58);g.textAlign='left';
}
function flappyLoop(now){
 if(!flappy.running||flappy.paused)return;
 const dt=Math.min(2,(now-flappy.last)/16.67);flappy.last=now;
 const speed=(flappy.slowTimer>0?3.1:5.2)+Math.min(flappy.score*.04,.9)+(flappy.dashTimer>0?7:0);
 const b=flappy.bird;
 b.v+=.34*dt;b.y+=b.v*dt;b.wing*=.85;
 if(b.y-24<0){b.y=24;b.v=Math.max(0,b.v)}
 if(flappy.slowTimer>0)flappy.slowTimer-=dt;if(flappy.dashTimer>0)flappy.dashTimer-=dt;if(flappy.invincible>0)flappy.invincible-=dt;
 flappy.clouds.forEach(cloud=>{cloud.x-=.15*dt;if(cloud.x<-120)cloud.x=1020+Math.random()*100});
 flappy.walls.forEach(wall=>wall.x-=speed*dt);
 flappy.pickups.forEach(pickup=>pickup.x-=speed*dt);
 flappy.pickups.forEach(pickup=>{
  if(pickup.taken)return;
  const dx=b.x-pickup.x,dy=b.y-pickup.y;
  if(Math.hypot(dx,dy)<42)collectFlappyPickup(pickup);
 });
 flappy.pickups=flappy.pickups.filter(pickup=>pickup.x>-40&&!pickup.taken);
 if(!flappy.walls.length||flappy.walls[flappy.walls.length-1].x<650)spawnWall();
 flappy.walls.forEach(wall=>{if(!wall.passed&&wall.x+wall.w<b.x){wall.passed=true;flappy.score++;$('#flappy-score').textContent=flappy.score}});
 flappy.walls=flappy.walls.filter(wall=>wall.x+wall.w>-30&&!wall.destroyed);
 flappy.bullets.forEach(bullet=>bullet.x+=bullet.vx*dt);
 flappy.bullets.forEach(bullet=>{
  const hit=flappy.walls.find(w=>!w.destroyed&&bullet.x>w.x&&bullet.x<w.x+w.w&&(bullet.y<w.gapY-95||bullet.y>w.gapY+95));
  if(hit){hit.destroyed=true;burst(hit.x+hit.w/2,hit.gapY,'#ffd166',25);bullet.hit=true}
 });
 flappy.bullets=flappy.bullets.filter(bullet=>bullet.x<1010&&!bullet.hit);
 flappy.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.08*dt;p.life-=dt});flappy.particles=flappy.particles.filter(p=>p.life>0);
 let hitGround=b.y+24>478;
 if(flappy.invincible<=0){
  for(const wall of flappy.walls){
   if(wall.destroyed)continue;
   if(b.x+22>wall.x&&b.x-22<wall.x+wall.w&&(b.y-20<wall.gapY-95||b.y+20>wall.gapY+95)){hitGround=true;break}
  }
 }
 if(hitGround){endFlappy();drawFlappy(now);return}
 drawFlappy(now);flappy.raf=requestAnimationFrame(flappyLoop);
}
function openFlappy(){$('#landing').hidden=true;$('#flappy').hidden=false;flappyReset()}
$('#play-flappy').onclick=openFlappy;
$('#back-from-flappy').onclick=menu;
$('#flappy-pause').onclick=toggleFlappyPause;
$('#flappy-canvas').onpointerdown=e=>{e.preventDefault();flap()};
addEventListener('keydown',e=>{
 if($('#flappy')?.hidden)return;
 if(e.code==='Space'){e.preventDefault();flappy.started?flap():startFlappy()}
 if(e.key.toLowerCase()==='p')toggleFlappyPause();
});

/* ---- Goyman ---- */
const GOY_ROWS=[
'#####################',
'#.........#.........#',
'#.###.###.#.###.###.#',
'#o###.###.#.###.###o#',
'#...................#',
'#.###.#.#####.#.###.#',
'#.....#...#...#.....#',
'#####.###.#.###.#####',
'    #.#.......#.#    ',
'#####.#.###.#.##### ',
'     .#.   .#.      ',
'######.#   #.###### ',
'     .#     #.      ',
'#####.#.###.#.##### ',
'#.........#.........#',
'#.###.###.#.###.###.#',
'#o..#..... .....#..o#',
'###.#.#.###.#.#.###.#',
'#.....#...#...#.....#',
'#.#######.#.#######.#',
'#...................#',
'#####################'
];
let goyman={
 running:false,paused:false,score:0,high:+(localStorage.getItem('goymanHigh')||0),
 lives:3,frightened:0,raf:0,last:0,player:null,ghosts:[],pellets:new Set()
};
function resetGoyman(){
 goyman.running=false;goyman.paused=false;goyman.score=0;goyman.lives=3;goyman.frightened=0;
 goyman.pellets=new Set();
 GOY_ROWS.forEach((row,r)=>[...row].forEach((ch,c)=>{
  if(ch==='.'||ch==='o')goyman.pellets.add(r+','+c);
 }));
 goyman.player={x:10.5,y:20.5,dir:{r:0,c:0},next:{r:0,c:0},mouth:0};
 goyman.ghosts=[
  {x:9.5,y:14.5,color:'#ff5d6c',dir:{r:-1,c:0},start:{r:14,c:9},turnCooldown:0},
  {x:10.5,y:14.5,color:'#55d6ff',dir:{r:0,c:-1},start:{r:14,c:10},turnCooldown:0},
  {x:11.5,y:14.5,color:'#ff9f43',dir:{r:0,c:1},start:{r:14,c:11},turnCooldown:0}
 ];
 updateGoymanUI();
 drawGoyman(performance.now());
}
function updateGoymanUI(){
 $('#goyman-score').textContent=goyman.score;
 $('#goyman-high').textContent='High '+goyman.high;
 $('#goyman-lives').textContent=Array.from({length:goyman.lives},()=> '●').join(' ')||'None';
 $('#goyman-pause').textContent=goyman.paused?'Resume':'Pause';
}
function goymanCanMove(x,y,dx,dy){
 const cx=Math.round(x-.5)+.5;
 const cy=Math.round(y-.5)+.5;
 const r=Math.floor(cy+dy),c=Math.floor(cx+dx);
 if(r<0||r>=GOY_ROWS.length||c<0||c>=GOY_ROWS[r].length)return false;
 const tile=GOY_ROWS[r][c];
 return tile!==undefined&&tile!=='#';
}
function startGoyman(){
 resetGoyman();goyman.running=true;
 $('#goyman-overlay').classList.add('off');
 $('#goyman-status').textContent='Use arrows or swipe';
 goyman.last=performance.now();cancelAnimationFrame(goyman.raf);goymanLoop(goyman.last);
}
function setGoymanDir(r,c){goyman.player.next={r,c}}
function goymanDistance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function moveGoymanActor(actor,dir,speed,dt){
 if(goymanCanMove(actor.x,actor.y,dir.c,dir.r)){
  actor.x+=dir.c*speed*dt;actor.y+=dir.r*speed*dt;
  if(actor.x<.2)actor.x=GOY_ROWS[0].length-.8;
  if(actor.x>GOY_ROWS[0].length-.8)actor.x=.2;
 }
}
function chooseGhostDir(ghost){
 const cx=Math.round(ghost.x-.5)+.5;
 const cy=Math.round(ghost.y-.5)+.5;
 ghost.x=cx;ghost.y=cy;
 const options=[{r:-1,c:0},{r:1,c:0},{r:0,c:-1},{r:0,c:1}].filter(d=>goymanCanMove(cx,cy,d.c,d.r));
 if(!options.length)return ghost.dir;
 const reverse={r:-ghost.dir.r,c:-ghost.dir.c};
 const forward=options.filter(d=>d.r!==reverse.r||d.c!==reverse.c);
 if(forward.length) options.splice(0,options.length,...forward);
 if(goyman.frightened>0)return options[Math.floor(Math.random()*options.length)];
 options.sort((a,b)=>{
  const px=ghost.x+a.c*2,py=ghost.y+a.r*2;
  const pa=Math.hypot(px-goyman.player.x,py-goyman.player.y);
  const bx=ghost.x+b.c*2,by=ghost.y+b.r*2;
  return pa-Math.hypot(bx-goyman.player.x,by-goyman.player.y);
 });
 return options[0];
}
function drawGoyman(now){
 const c=$('#goyman-canvas'),g=c.getContext('2d'),cell=c.width/GOY_ROWS[0].length;
 g.fillStyle='#05071d';g.fillRect(0,0,c.width,c.height);
 GOY_ROWS.forEach((row,r)=>{
  [...row].forEach((ch,cx)=>{
   if(ch==='#'){
    g.fillStyle='#172b9c';g.fillRect(cx*cell,r*cell,cell,cell);
    g.fillStyle='#263ede';g.fillRect(cx*cell+3,r*cell+3,cell-6,cell-6);
    g.fillStyle='#172b9c';g.fillRect(cx*cell+7,r*cell+7,cell-14,cell-14);
   }
  });
 });
 goyman.pellets.forEach(key=>{
  const [r,cx]=key.split(',').map(Number),x=cx*cell+cell/2,y=r*cell+cell/2;
  const power=GOY_ROWS[r][cx]==='o';
  g.fillStyle=power?'#ffd7a0':'#fff1c7';
  g.beginPath();g.arc(x,y,power?7+(Math.sin(now/120)+1)*2:2.5,0,7);g.fill();
 });
 const p=goyman.player;
 if(p){
  g.save();g.translate(p.x*cell,p.y*cell);g.rotate(p.dir.c===-1?Math.PI:p.dir.r===-1?-Math.PI/2:p.dir.r===1?Math.PI/2:0);
  p.mouth+=.18;const mouth=.18+(Math.sin(p.mouth)+1)*.12;
  g.fillStyle='#ffcf57';g.beginPath();g.moveTo(0,0);g.arc(0,0,cell*.46,mouth*Math.PI,(2-mouth)*Math.PI);g.closePath();g.fill();g.restore();
 }
 goyman.ghosts.forEach((ghost,i)=>{
  g.save();g.translate(ghost.x*cell,ghost.y*cell);
  if(goyman.frightened>0&&goyman.frightened<180)g.fillStyle=(Math.floor(now/150)%2)?'#fff':'#334bb8';
  else g.fillStyle=goyman.frightened>0?'#334bb8':ghost.color;
  g.beginPath();g.moveTo(-cell*.42,cell*.38);g.lineTo(-cell*.42,-cell*.05);g.arc(0,-cell*.05,cell*.42,Math.PI,0);g.lineTo(cell*.42,cell*.38);g.lineTo(cell*.24,cell*.22);g.lineTo(cell*.08,cell*.38);g.lineTo(-cell*.08,cell*.22);g.lineTo(-cell*.24,cell*.38);g.closePath();g.fill();
  g.fillStyle='#fff';g.beginPath();g.arc(-cell*.16,-cell*.08,cell*.12,0,7);g.arc(cell*.16,-cell*.08,cell*.12,0,7);g.fill();
  g.fillStyle='#17244f';g.beginPath();g.arc(-cell*.12,-cell*.08,cell*.055,0,7);g.arc(cell*.2,-cell*.08,cell*.055,0,7);g.fill();g.restore();
 });
}
function endGoyman(win){
 goyman.running=false;if(goyman.score>goyman.high){goyman.high=goyman.score;localStorage.setItem('goymanHigh',goyman.high)}
 $('#goyman-message').textContent=win?'Maze cleared!':'The ghosts got you.';
 $('#goyman-overlay').innerHTML='<div class="goyman-logo">'+(win?'YOU WIN':'GAME OVER')+'</div><p>Score '+goyman.score+' · High '+goyman.high+'</p><button id="goyman-start" class="go" type="button">Play again</button>';
 $('#goyman-overlay').classList.remove('off');$('#goyman-start').onclick=startGoyman;updateGoymanUI();
}
function loseGoymanLife(){
 goyman.lives--;
 updateGoymanUI();
 if(goyman.lives<=0){endGoyman(false);return}
 goyman.player={x:10.5,y:20.5,dir:{r:0,c:0},next:{r:0,c:0},mouth:0};
 goyman.ghosts.forEach(g=>{g.x=g.start.c+.5;g.y=g.start.r+.5;g.dir={r:-1,c:0};g.turnCooldown=0});
 goyman.paused=true;$('#goyman-overlay').classList.remove('off');
 $('#goyman-overlay').innerHTML='<div class="goyman-logo">READY!</div><p>'+goyman.lives+' lives left</p><button id="goyman-start" class="go" type="button">Continue</button>';
 $('#goyman-start').onclick=()=>{goyman.paused=false;$('#goyman-overlay').classList.add('off');goyman.last=performance.now();goymanLoop(goyman.last)};
}
function toggleGoymanPause(){
 if(!goyman.running)return;
 goyman.paused=!goyman.paused;
 updateGoymanUI();
 if(!goyman.paused){goyman.last=performance.now();goymanLoop(goyman.last)}
}
function goymanLoop(now){
 if(!goyman.running||goyman.paused)return;
 const dt=Math.min(2,(now-goyman.last)/16.67);goyman.last=now;
 const p=goyman.player;
 if(goymanCanMove(p.x,p.y,p.next.c,p.next.r)){p.dir=p.next}
 if(goymanCanMove(p.x,p.y,p.dir.c,p.dir.r))moveGoymanActor(p,p.dir,.095,dt);
 const pr=Math.floor(p.y),pc=Math.floor(p.x),key=pr+','+pc;
 if(goyman.pellets.has(key)){
  goyman.pellets.delete(key);
  const power=GOY_ROWS[pr]?.[pc]==='o';
  goyman.score+=power?50:10;
  if(power)goyman.frightened=420;
  if(goyman.score>goyman.high)$('#goyman-high').textContent='High '+goyman.score;
  $('#goyman-score').textContent=goyman.score;
  if(!goyman.pellets.size)endGoyman(true);
 }
 if(goyman.frightened>0)goyman.frightened-=dt;
 goyman.ghosts.forEach((ghost,index)=>{
  const centerX=Math.round(ghost.x-.5)+.5;
  const centerY=Math.round(ghost.y-.5)+.5;
  const cx=Math.abs(ghost.x-centerX)<.16;
  const cy=Math.abs(ghost.y-centerY)<.16;
  if(cx&&cy&&ghost.turnCooldown<=0){
   ghost.x=centerX;
   ghost.y=centerY;
   const next=chooseGhostDir(ghost);
   if(next)ghost.dir=next;
   ghost.turnCooldown=10;
  }
  ghost.turnCooldown=Math.max(0,ghost.turnCooldown-dt);
  moveGoymanActor(ghost,ghost.dir,goyman.frightened>0?.065:.075,dt);
  if(goymanDistance(p,ghost)<.65){
   if(goyman.frightened>0){ghost.x=ghost.start.c+.5;ghost.y=ghost.start.r+.5;goyman.score+=200;$('#goyman-score').textContent=goyman.score}
   else loseGoymanLife();
  }
 });
 drawGoyman(now);goyman.raf=requestAnimationFrame(goymanLoop);
}
function openGoyman(){$('#landing').hidden=true;$('#goyman').hidden=false;resetGoyman();$('#goyman-overlay').innerHTML='<div class="goyman-logo">GOYMAN</div><p id="goyman-message">Eat every dot. Avoid the ghosts.</p><button id="goyman-start" class="go" type="button">Start game</button>';$('#goyman-start').onclick=startGoyman}
$('#play-goyman').onclick=openGoyman;
$('#back-from-goyman').onclick=menu;
$('#goyman-pause').onclick=toggleGoymanPause;
$('#goyman-canvas').onpointerdown=e=>{
 goyman.touchStart={x:e.clientX,y:e.clientY};
};
$('#goyman-canvas').onpointerup=e=>{
 if(!goyman.touchStart)return;
 const dx=e.clientX-goyman.touchStart.x,dy=e.clientY-goyman.touchStart.y;
 if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;
 if(Math.abs(dx)>Math.abs(dy))setGoymanDir(0,dx>0?1:-1);else setGoymanDir(dy>0?1:-1,0);
};
addEventListener('keydown',e=>{
 if($('#goyman')?.hidden)return;
 const key=e.key.toLowerCase();
 if(key==='arrowup'||key==='w'){e.preventDefault();setGoymanDir(-1,0)}
 if(key==='arrowdown'||key==='s'){e.preventDefault();setGoymanDir(1,0)}
 if(key==='arrowleft'||key==='a'){e.preventDefault();setGoymanDir(0,-1)}
 if(key==='arrowright'||key==='d'){e.preventDefault();setGoymanDir(0,1)}
 if(key==='p')toggleGoymanPause();
});
})();
