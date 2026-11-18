/* Board geometry + drawing. Units are "cells" (board = 10 x 10, start tray below). */
(function(){const S=window.SL=window.SL||{};
S.cell=n=>{const i=n-1,r=i/10|0,c=r%2?9-i%10:i%10;return{x:c+.5,y:9-r+.5}};
S.tray=i=>({x:1+i*1.1,y:10.45});
S.snakePath=(a,b,k)=>{const A=S.cell(a),B=S.cell(b),dx=B.x-A.x,dy=B.y-A.y,L=Math.hypot(dx,dy),nx=-dy/L,ny=dx/L,N=Math.ceil(L/.05),w=2+k%3,amp=.3+(k%2)*.12,o=[];
 for(let i=0;i<=N;i++){const t=i/N,off=Math.sin(t*Math.PI*w+k)*amp*Math.sqrt(Math.sin(Math.PI*t));o.push({x:A.x+dx*t+nx*off,y:A.y+dy*t+ny*off})}return o};
const COL=[['#2fbf71','#b6f5cf'],['#ff7a45','#ffd2b8'],['#8b6cff','#dcd2ff'],['#ff4f8b','#ffc6dc'],['#1fa3d8','#b4eaff']];
const rr=(g,x,y,w,h,r)=>{g.beginPath();g.roundRect?g.roundRect(x,y,w,h,r):g.rect(x,y,w,h)};
const txt=(g,s,x,y,px,c)=>{g.save();g.translate(x,y);g.scale(.01,.01);g.font='800 '+px+'px "Baloo 2",system-ui,sans-serif';g.fillStyle=c;g.fillText(s,0,0);g.restore()};
S.drawBoard=(g,b)=>{const H={},B={};b.snakes.forEach(s=>H[s[0]]=1);b.ladders.forEach(l=>B[l[0]]=1);
 for(let n=1;n<=100;n++){const c=S.cell(n),x=c.x-.5,y=c.y-.5;
  g.fillStyle=n==100?'#ffd35a':b.tiles[(x+y)%2];rr(g,x+.03,y+.03,.94,.94,.1);g.fill();
  if(H[n]||B[n]){g.fillStyle=H[n]?'rgba(255,93,108,.28)':'rgba(255,193,59,.4)';g.fill()}
  txt(g,n==100?'★ 100':n,x+.09,y+.27,22,'rgba(18,22,58,.72)')}
 g.fillStyle='#1c2152';rr(g,.03,10.03,9.94,.84,.14);g.fill();txt(g,'Start',8.7,10.55,30,'#a9b0e0');
 g.lineCap='round';
 b.ladders.forEach(([a,t])=>{const A=S.cell(a),T=S.cell(t),L=Math.hypot(T.x-A.x,T.y-A.y),ux=(T.x-A.x)/L,uy=(T.y-A.y)/L,nx=-uy*.15,ny=ux*.15;
  [[.06,.08,'rgba(0,0,0,.22)',.1],[0,0,'#6b3f17',.105],[0,0,'#e0a468',.07]].forEach(([ox,oy,c,w])=>{g.strokeStyle=c;g.lineWidth=w;g.beginPath();
   for(const s of[-1,1]){g.moveTo(A.x+nx*s+ox,A.y+ny*s+oy);g.lineTo(T.x+nx*s+ox,T.y+ny*s+oy)}
   for(let d=.3;d<L-.15;d+=.34){const px=A.x+ux*d,py=A.y+uy*d;g.moveTo(px-nx+ox,py-ny+oy);g.lineTo(px+nx+ox,py+ny+oy)}g.stroke()})});
 b.paths.forEach((p,k)=>{const [base,lite]=COL[k%5],N=p.length-1,r=i=>.05+.16*Math.pow(1-i/N,.6);
  [['rgba(0,0,0,.2)',.06,.08,.0],['#10204a',0,0,.03],[null,0,0,0],[lite+'88',-.04,-.05,-.07]].forEach(([c,ox,oy,dr],pass)=>{
   for(let i=N;i>=0;i--){const q=p[i];g.fillStyle=pass==2?(((i/9)|0)%2?base:lite):c;g.beginPath();g.arc(q.x+ox,q.y+oy,Math.max(.02,r(i)*(pass==3?.45:1)+dr*(pass==3?0:1)),0,7);g.fill()}});
  const h=p[0],n=p[4];g.save();g.translate(h.x,h.y);g.rotate(Math.atan2(h.y-n.y,h.x-n.x));
  g.fillStyle=base;g.strokeStyle='#10204a';g.lineWidth=.03;g.beginPath();g.ellipse(.07,0,.3,.23,0,0,7);g.fill();g.stroke();
  g.strokeStyle='#ff2d55';g.lineWidth=.03;g.beginPath();g.moveTo(.34,0);g.lineTo(.5,0);g.moveTo(.5,0);g.lineTo(.58,-.06);g.moveTo(.5,0);g.lineTo(.58,.06);g.stroke();
  for(const s of[-1,1]){g.fillStyle='#fff';g.beginPath();g.arc(.14,.1*s,.065,0,7);g.fill();g.fillStyle='#111';g.beginPath();g.arc(.16,.1*s,.03,0,7);g.fill()}g.restore()})};
S.paint=(cv,b,w)=>{const d=window.devicePixelRatio||1;cv.width=Math.round(w*d);cv.height=Math.round(w*1.09*d);const g=cv.getContext('2d');g.scale(cv.width/10,cv.width/10);S.drawBoard(g,b)};
})();
