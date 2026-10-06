/* ============================================================
   CYTHEREA — ATELIER DES CARTES DE BATAILLE (règles V11)
   - mountAtelier(host, {sb, systeme}) : éditeur réservé à l'admin
     (route /atelier). Lit le catalogue decor_types / area_types /
     decor_sets dans Supabase, enregistre dans battle_maps et
     battle_map_notes. La RLS fait la vraie protection.
   - renderPublished(host, {sb}) : cartes publiées en lecture seule
     (page Batailles), visibles de tous les joueurs connectés.
   Chargé à la demande par script.js (loadTables) avec tables.css.
   Format de layout : { areas:[], features:[], markers:[] }
   (voir le skill cytherea-battlemaps).
   Le canevas d'une carte peut contenir lumière et ombres
   (exception validée) ; l'interface autour reste sobre.
   ============================================================ */
(function(){
"use strict";
/* ---------- utilitaires ---------- */
const PI=Math.PI,TAU=PI*2;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function makeNoise(seed){const r=mulberry32(seed),P=new Uint16Array(512),p=[];for(let i=0;i<256;i++)p[i]=i;for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));const t=p[i];p[i]=p[j];p[j]=t}for(let i=0;i<512;i++)P[i]=p[i&255];const V=new Float32Array(256);for(let i=0;i<256;i++)V[i]=r();
  return (x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,X=xi&255,Y=yi&255;const a=V[P[X+P[Y]]],b=V[P[X+1+P[Y]]],c=V[P[X+P[Y+1]]],d=V[P[X+1+P[Y+1]]];const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}}
function fbm(n,x,y,o){let s=0,a=.5,f=1,t=0;for(let i=0;i<o;i++){s+=a*n(x*f,y*f);t+=a;a*=.5;f*=2.03}return s/t}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
function hex(c){c=c.replace('#','');return[parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)]}
function mix(c1,c2,t){const a=hex(c1),b=hex(c2);return`rgb(${Math.round(lerp(a[0],b[0],t))},${Math.round(lerp(a[1],b[1],t))},${Math.round(lerp(a[2],b[2],t))})`}
function rgba(c,a){const h=hex(c);return`rgba(${h[0]},${h[1]},${h[2]},${a})`}
function uid(){return Math.random().toString(36).slice(2,9)}
function slug(s){return(s||'table').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'table'}
function cssVar(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()}

/* ---------- factions ---------- */
const FACTIONS={
  loyalistes:{n:'Loyalistes (Krieg + Custodes)',c:'#CBB86A'},
  krieg:{n:'88e de Krieg',c:'#A9AE72'},
  custodes:{n:'Garde Cytheréenne',c:'#DDB64F'},
  necrons:{n:'Les Éveillés',c:'#4FCF8A'},
  'red-choir':{n:'Le Chœur Rouge',c:'#E2423E'},
  'treizieme-cantique':{n:'Le Treizième Cantique',c:'#B97FDD'},
  neutre:{n:'Neutre',c:'#CFC3A8'}
};

/* ---------- ombres & texte ---------- */
let TACT=false;
function shadow(ctx,s,e){if(TACT||e<=0){noShadow(ctx);return}ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=e*s*.16;ctx.shadowOffsetX=e*s*.11;ctx.shadowOffsetY=e*s*.13}
function noShadow(ctx){ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0}
/* Étiquettes : pendant renderMap, wtext ne dessine pas tout de suite, il met le texte en file (LQ).
   flushLabels les dessine en dernier, au-dessus des décors, en décalant celles qui se chevauchent.
   TS = facteur de taille de l'élément en cours (champ ts, 1 par défaut). */
let LQ=null,TS=1,LDPR=1;
function wtext(ctx,lx,ly,text,sizeIn,s,color,align){const m=ctx.getTransform();const p=m.transformPoint(new DOMPoint(lx,ly));
  const L={x:p.x,y:p.y,text:String(text),px:Math.max(9,Math.min(10*LDPR,.7*s),sizeIn*TS*s),color:color||'#E8DEC8',align:align||'center'};
  if(LQ)LQ.push(L);else drawLabel(ctx,L)}
function drawLabel(ctx,L){ctx.save();ctx.setTransform(1,0,0,1,0,0);noShadow(ctx);ctx.font=`${L.px}px Marcellus, Georgia, serif`;ctx.textAlign=L.align;ctx.textBaseline='middle';ctx.lineWidth=Math.max(2.5,L.px*.26);ctx.strokeStyle='rgba(8,10,10,.88)';ctx.lineJoin='round';ctx.strokeText(L.text,L.x,L.y);ctx.fillStyle=L.color;ctx.fillText(L.text,L.x,L.y);ctx.restore()}
function flushLabels(c,b){const Q=LQ;LQ=null;if(!Q||!Q.length)return;const placed=[];c.save();c.setTransform(1,0,0,1,0,0);
  for(const L of Q){c.font=`${L.px}px Marcellus, Georgia, serif`;const w=c.measureText(L.text).width+L.px*.4,h=L.px*1.3;
    let x0=L.align==='left'?L.x:L.align==='right'?L.x-w:L.x-w/2;
    if(b){const d=Math.max(b.x0-x0,0)-Math.max(x0+w-b.x1,0);x0+=d;L.x+=d}
    let best=null;for(const k of[0,-1,1,-2,2,-3,3]){const y0=L.y+k*h-h/2;if(b&&(y0<b.y0||y0+h>b.y1))continue;if(!placed.some(q=>x0<q.x+q.w&&x0+w>q.x&&y0<q.y+q.h&&y0+h>q.y)){best=k;break}}
    L.y+=(best||0)*h;placed.push({x:x0,y:L.y-h/2,w,h});drawLabel(c,L)}
  c.restore()}
function rrect(ctx,x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h)}
function blob(ctx,cx,cy,rx,ry,rnd,jit,n){ctx.beginPath();n=n||22;const ph=rnd()*TAU;for(let i=0;i<=n;i++){const a=i/n*TAU;const k=1+jit*(Math.sin(a*3+ph)*.5+Math.sin(a*7+ph*2)*.3+(rnd()-.5)*.4);const x=cx+Math.cos(a)*rx*k,y=cy+Math.sin(a)*ry*k;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath()}

/* ---------- pièces de construction ---------- */
const CONCRETE={lo:'#5e5950',hi:'#9a9383',edge:'rgba(255,246,226,.20)',rub:'#6f695e',floor:'#4a4740',e:2.4};
function wallRun(ctx,L,t,rnd,pal,s,gaps){let x=0;while(x<L-.05){const len=Math.min(L-x,.8+rnd()*1.4);const gap=rnd()<gaps&&x>.8&&L-x>1.4;
    if(gap){noShadow(ctx);for(let i=0;i<6;i++){ctx.fillStyle=mix(pal.lo,pal.hi,rnd()*.6);const rx=x+rnd()*len,ry=(rnd()-.5)*t*2.6,rs=.1+rnd()*.22;ctx.beginPath();ctx.ellipse(rx,ry,rs,rs*.7,rnd()*3,0,TAU);ctx.fill()}x+=len;continue}
    const hg=.35+rnd()*.65;shadow(ctx,s,pal.e*hg);ctx.fillStyle=mix(pal.lo,pal.hi,hg);
    const j1=(rnd()-.5)*.12,j2=(rnd()-.5)*.12;ctx.beginPath();ctx.moveTo(x,-t/2+j1);ctx.lineTo(x+len,-t/2+j2);ctx.lineTo(x+len,t/2);ctx.lineTo(x,t/2);ctx.closePath();ctx.fill();
    noShadow(ctx);ctx.fillStyle=pal.edge;ctx.fillRect(x,-t/2+Math.max(j1,j2),len,t*.22);
    ctx.strokeStyle='rgba(0,0,0,.28)';ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(x+.02,-t/2);ctx.lineTo(x+.02,t/2);ctx.stroke();
    if(rnd()<.35){ctx.beginPath();ctx.moveTo(x+len*rnd(),-t/2);ctx.lineTo(x+len*rnd(),t/2);ctx.stroke()}
    x+=len}}
function floorSlab(ctx,w,h,rnd,s,pal){shadow(ctx,s,.35);ctx.fillStyle=pal.floor;ctx.fillRect(-w/2,-h/2,w,h);noShadow(ctx);
  ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=.03;for(let x=-w/2+1.5;x<w/2;x+=1.5){ctx.beginPath();ctx.moveTo(x,-h/2);ctx.lineTo(x,h/2);ctx.stroke()}for(let y=-h/2+1.5;y<h/2;y+=1.5){ctx.beginPath();ctx.moveTo(-w/2,y);ctx.lineTo(w/2,y);ctx.stroke()}
  for(let i=0;i<w*h*.5;i++){ctx.fillStyle=rnd()<.5?'rgba(0,0,0,.22)':'rgba(255,240,215,.08)';const r=.05+rnd()*.14;ctx.beginPath();ctx.ellipse(-w/2+rnd()*w,-h/2+rnd()*h,r,r*.7,0,0,TAU);ctx.fill()}
  // tache de brûlure
  const g=ctx.createRadialGradient(-w/2+rnd()*w,-h/2+rnd()*h,0,0,0,Math.max(w,h)*.7);g.addColorStop(0,'rgba(0,0,0,.28)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(-w/2,-h/2,w,h);
  ctx.strokeStyle='rgba(255,240,215,.10)';ctx.lineWidth=.05;ctx.strokeRect(-w/2,-h/2,w,h)}

const GAUSS='#4FCF8A',GAUSS_B='#93EBB8';
function tombBlock(ctx,w,h,s,e,rnd){shadow(ctx,s,e);ctx.fillStyle='#232c27';rrect(ctx,-w/2,-h/2,w,h,.12);ctx.fill();noShadow(ctx);
  ctx.fillStyle='#34413a';rrect(ctx,-w/2+.14,-h/2+.12,w-.28,h-.3,.08);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.4)';ctx.lineWidth=.035;for(let x=-w/2+2;x<w/2-.2;x+=2){ctx.beginPath();ctx.moveTo(x,-h/2+.12);ctx.lineTo(x,h/2-.18);ctx.stroke()}}
function gaussLine(ctx,x0,y0,x1,y1,wid,a){ctx.save();ctx.globalCompositeOperation='lighter';ctx.strokeStyle=rgba(GAUSS,a*.35);ctx.lineWidth=wid*4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1,y1);ctx.stroke();ctx.strokeStyle=rgba(GAUSS_B,a);ctx.lineWidth=wid;ctx.stroke();ctx.restore()}
function glow(ctx,x,y,r,a){ctx.save();ctx.globalCompositeOperation='lighter';const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(GAUSS,a));g.addColorStop(.4,rgba(GAUSS,a*.35));g.addColorStop(1,rgba(GAUSS,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();ctx.restore()}

/* ---------- catalogue ---------- */
/* ---------- portes : chaque modèle a un état ouvert / fermé (champ open de l'élément) ---------- */
function hazard(ctx,x,y,w,h){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle='#1d1b17';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#C9A13A';ctx.lineWidth=.09;for(let k=-h-1;k<w+h+1;k+=.26){ctx.beginPath();ctx.moveTo(x+k,y+h);ctx.lineTo(x+k+h,y);ctx.stroke()}ctx.restore()}
function hiveDoor(ctx,w,h,open,s){const p=Math.min(.35,w*.14),g=w-2*p;
  ctx.fillStyle='#34322d';ctx.fillRect(-g/2,-h*.28,g,h*.56);ctx.strokeStyle='rgba(255,246,226,.18)';ctx.lineWidth=.04;ctx.beginPath();ctx.moveTo(-g/2,0);ctx.lineTo(g/2,0);ctx.stroke();
  if(!open){for(const sx of[-1,1]){const x0=sx<0?-g/2:0;shadow(ctx,s,2.2);ctx.fillStyle='#6d6b63';ctx.fillRect(x0,-h*.42,g/2,h*.84);noShadow(ctx);ctx.fillStyle='rgba(255,246,226,.14)';ctx.fillRect(x0+.06,-h*.42,g/2-.12,h*.12);hazard(ctx,sx<0?-.22:0,-h*.42,.22,h*.84)}}
  else for(const sx of[-1,1]){ctx.fillStyle='#6d6b63';ctx.fillRect(sx<0?-g/2:g/2-.14,-h*.42,.14,h*.84)}
  for(const sx of[-1,1]){shadow(ctx,s,3);ctx.fillStyle=CONCRETE.lo;ctx.fillRect(sx<0?-w/2:w/2-p,-h/2,p,h);noShadow(ctx);ctx.fillStyle=CONCRETE.hi;ctx.fillRect((sx<0?-w/2:w/2-p)+.05,-h/2+.05,p-.1,h*.3)}}
function tombDoor(ctx,w,h,open,s,rnd){const p=Math.min(.6,w*.18),g=w-2*p;
  if(!open){shadow(ctx,s,3);ctx.fillStyle='#2a342f';ctx.fillRect(-g/2,-h*.38,g,h*.76);noShadow(ctx);gaussLine(ctx,-g/2+.15,0,g/2-.15,0,.05,.6);
    ctx.save();ctx.strokeStyle=rgba(GAUSS_B,.75);ctx.lineWidth=.05;ctx.beginPath();ctx.moveTo(0,-h*.3);ctx.lineTo(h*.3,0);ctx.lineTo(0,h*.3);ctx.lineTo(-h*.3,0);ctx.closePath();ctx.stroke();ctx.restore();glow(ctx,0,0,h*.55,.55)}
  else{ctx.save();ctx.setLineDash([.18,.14]);ctx.strokeStyle=rgba(GAUSS,.55);ctx.lineWidth=.05;ctx.beginPath();ctx.moveTo(-g/2,0);ctx.lineTo(g/2,0);ctx.stroke();ctx.restore();glow(ctx,0,0,h*.4,.18)}
  for(const sx of[-1,1]){ctx.save();ctx.translate(sx*(w/2-p/2),0);tombBlock(ctx,p,h,s,3.4,rnd);ctx.restore();glow(ctx,sx*(w/2-p/2),0,.4,.45)}}
function bunkerDoor(ctx,w,h,open,s){const p=Math.min(.3,w*.12),g=w-2*p;
  ctx.fillStyle='#2f2a22';ctx.fillRect(-g/2,-h*.3,g,h*.6);
  const leaf=()=>{ctx.fillStyle='#5f5a50';ctx.fillRect(0,-.14,g,.28);ctx.fillStyle='rgba(20,18,14,.75)';for(let x=.2;x<g;x+=.45)ctx.fillRect(x-.04,-.04,.08,.08);ctx.strokeStyle='rgba(255,246,226,.2)';ctx.lineWidth=.03;ctx.strokeRect(0,-.14,g,.28)};
  shadow(ctx,s,1.6);ctx.save();ctx.translate(-g/2,0);if(open)ctx.rotate(-PI/2);leaf();ctx.restore();noShadow(ctx);
  for(const sx of[-1,1]){shadow(ctx,s,2);ctx.fillStyle='#4a453b';ctx.fillRect(sx<0?-w/2:w/2-p,-h/2,p,h);noShadow(ctx)}}
function withDoor(ctx,it,rnd,s,dw,side,door){const w=it.w,d=Math.min(dw,w*.6),L=(w-d)/2;side(-w/2,L);side(d/2,L);ctx.save();door(d);ctx.restore()}
const CAT={
  ruin_l:{g:'Ruines urbaines',n:'Ruine en L',w:12,h:8,los:'block',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it,t=.55;floorSlab(ctx,w,h,rnd,s,CONCRETE);
      ctx.save();ctx.translate(-w/2,-h/2+t/2);wallRun(ctx,w,t,rnd,CONCRETE,s,.14);ctx.restore();
      ctx.save();ctx.translate(-w/2+t/2,-h/2);ctx.rotate(PI/2);wallRun(ctx,h,t,rnd,CONCRETE,s,.14);ctx.restore()}},
  ruin_box:{g:'Ruines urbaines',n:'Ruine fermée',w:10,h:6,los:'block',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it,t=.5;floorSlab(ctx,w,h,rnd,s,CONCRETE);
      const run=(x,y,a,L)=>{ctx.save();ctx.translate(x,y);ctx.rotate(a);wallRun(ctx,L,t,rnd,CONCRETE,s,.28);ctx.restore()};
      run(-w/2,-h/2+t/2,0,w);run(-w/2,h/2-t/2,0,w);run(-w/2+t/2,-h/2,PI/2,h);run(w/2-t/2,-h/2,PI/2,h)}},
  wall:{g:'Ruines urbaines',n:'Pan de mur',w:6,h:.6,los:'block',layer:2,
    draw(ctx,it,rnd,s){ctx.save();ctx.translate(-it.w/2,0);wallRun(ctx,it.w,it.h,rnd,CONCRETE,s,.1);ctx.restore()}},
  muraille:{g:'Ruines urbaines',n:'Muraille',w:12,h:2,los:'block',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it;shadow(ctx,s,4.5);ctx.fillStyle='#57524a';ctx.fillRect(-w/2,-h/2,w,h);noShadow(ctx);
      ctx.fillStyle='#6d675c';ctx.fillRect(-w/2,-h/2+h*.28,w,h*.44);
      for(let x=-w/2;x<w/2-.1;x+=1.2){ctx.fillStyle=mix('#7c7569','#a59d8c',rnd());ctx.fillRect(x+.05,-h/2,.7,h*.26);ctx.fillRect(x+.05,h/2-h*.26,.7,h*.26)}
      ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=.04;for(let x=-w/2+3;x<w/2;x+=3){ctx.beginPath();ctx.moveTo(x,-h/2);ctx.lineTo(x,h/2);ctx.stroke()}
      for(let i=0;i<w*.6;i++){ctx.fillStyle='rgba(0,0,0,.25)';ctx.beginPath();ctx.arc(-w/2+rnd()*w,-h/2+h*.3+rnd()*h*.4,.06+rnd()*.12,0,TAU);ctx.fill()}}},
  container:{g:'Ruines urbaines',n:'Conteneur',w:6,h:2.6,los:'block',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it;const c=['#5c5b3b','#6b3e2c','#3d4a4d','#5a4a2e'][Math.floor(rnd()*4)];shadow(ctx,s,2.6);ctx.fillStyle=c;ctx.fillRect(-w/2,-h/2,w,h);noShadow(ctx);
      ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=.05;for(let x=-w/2+.3;x<w/2;x+=.3){ctx.beginPath();ctx.moveTo(x,-h/2+.12);ctx.lineTo(x,h/2-.12);ctx.stroke()}
      ctx.strokeStyle='rgba(255,240,215,.18)';ctx.lineWidth=.08;ctx.strokeRect(-w/2+.06,-h/2+.06,w-.12,h-.12);
      for(let i=0;i<8;i++){ctx.fillStyle='rgba(120,60,25,.35)';ctx.beginPath();ctx.ellipse(-w/2+rnd()*w,-h/2+rnd()*h,.2+rnd()*.4,.1+rnd()*.2,rnd()*3,0,TAU);ctx.fill()}}},
  rubble:{g:'Ruines urbaines',n:'Gravats',w:5,h:4,los:'obscure',layer:1,
    draw(ctx,it,rnd,s){const{w,h}=it;noShadow(ctx);ctx.fillStyle='rgba(30,28,24,.45)';blob(ctx,0,0,w/2,h/2,rnd,.18);ctx.fill();
      const n=Math.round(w*h*1.6);for(let i=0;i<n;i++){const a=rnd()*TAU,r=Math.sqrt(rnd())*.9;const x=Math.cos(a)*r*w/2,y=Math.sin(a)*r*h/2;const sz=.15+rnd()*.5*(1-r*.6);shadow(ctx,s,.5+sz);ctx.fillStyle=mix('#4f4a42','#a1998a',rnd());ctx.beginPath();const k=5+Math.floor(rnd()*3),ph=rnd()*TAU;for(let j=0;j<k;j++){const aa=ph+j/k*TAU,rr=sz*(.6+rnd()*.5);j?ctx.lineTo(x+Math.cos(aa)*rr,y+Math.sin(aa)*rr):ctx.moveTo(x+Math.cos(aa)*rr,y+Math.sin(aa)*rr)}ctx.closePath();ctx.fill()}noShadow(ctx)}},
  crater:{g:'No man\u2019s land',n:'Cratère',w:6,h:6,los:'cover',layer:1,round:true,
    draw(ctx,it,rnd,s){const{w,h}=it;noShadow(ctx);
      ctx.fillStyle='rgba(120,108,85,.55)';blob(ctx,0,0,w/2*1.04,h/2*1.04,rnd,.12);ctx.fill();
      const g=ctx.createRadialGradient(-w*.06,-h*.06,0,0,0,Math.max(w,h)/2);g.addColorStop(0,'#14110c');g.addColorStop(.55,'#2a251c');g.addColorStop(.86,'#5c5341');g.addColorStop(1,'#7d7259');ctx.fillStyle=g;blob(ctx,0,0,w/2*.9,h/2*.9,rnd,.1);ctx.fill();
      ctx.strokeStyle='rgba(255,238,205,.16)';ctx.lineWidth=.12;ctx.beginPath();ctx.ellipse(0,0,w/2*.88,h/2*.88,0,PI*.95,PI*1.75);ctx.stroke();
      ctx.fillStyle='rgba(30,40,38,.55)';blob(ctx,w*.05,h*.05,w*.14,h*.1,rnd,.3);ctx.fill();
      for(let i=0;i<14;i++){const a=rnd()*TAU;ctx.fillStyle=mix('#5d5444','#9a8e74',rnd());ctx.beginPath();ctx.arc(Math.cos(a)*w/2*(.9+rnd()*.2),Math.sin(a)*h/2*(.9+rnd()*.2),.08+rnd()*.15,0,TAU);ctx.fill()}}},
  trench:{g:'No man\u2019s land',n:'Tranchée',w:12,h:2.4,los:'cover',layer:1,
    draw(ctx,it,rnd,s){const{w,h}=it;noShadow(ctx);ctx.fillStyle='#17130d';ctx.fillRect(-w/2,-h/2,w,h);
      const g=ctx.createLinearGradient(0,-h/2,0,h/2);g.addColorStop(0,'rgba(0,0,0,.6)');g.addColorStop(.3,'rgba(0,0,0,0)');g.addColorStop(.7,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.4)');
      ctx.fillStyle='#3e3222';ctx.fillRect(-w/2,-h*.14,w,h*.28);ctx.strokeStyle='rgba(0,0,0,.5)';ctx.lineWidth=.04;for(let x=-w/2+.35;x<w/2;x+=.35){ctx.beginPath();ctx.moveTo(x,-h*.14);ctx.lineTo(x,h*.14);ctx.stroke()}
      ctx.fillStyle=g;ctx.fillRect(-w/2,-h/2,w,h);
      for(const side of[-1,1]){for(let x=-w/2+.3;x<w/2;x+=.62){shadow(ctx,s,.6);ctx.fillStyle=mix('#6e6447','#8f835f',rnd());ctx.beginPath();ctx.ellipse(x,side*(h/2-.12),.33,.2,0,0,TAU);ctx.fill()}}noShadow(ctx)}},
  sandbags:{g:'No man\u2019s land',n:'Sacs de sable',w:5,h:1.2,los:'cover',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it;for(let r=0;r<2;r++){const y=r?h*.2:-h*.2,off=r?.32:0;for(let x=-w/2+.32+off;x<w/2-.2;x+=.64){shadow(ctx,s,.9);ctx.fillStyle=mix('#6d6346','#9b8f69',rnd());ctx.beginPath();ctx.ellipse(x,y,.34,h*.27,0,0,TAU);ctx.fill();noShadow(ctx);ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=.03;ctx.beginPath();ctx.moveTo(x-.2,y);ctx.lineTo(x+.2,y);ctx.stroke()}}}},
  barricade:{g:'No man\u2019s land',n:'Barricade',w:6,h:1,los:'cover',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it;for(let x=-w/2;x<w/2-.3;x+=2){const L=Math.min(1.85,w/2-x);shadow(ctx,s,1.1);ctx.fillStyle=mix('#77716a','#a29b8f',rnd()*.6+.2);rrect(ctx,x+.07,-h/2,L-.07,h,.15);ctx.fill();noShadow(ctx);ctx.fillStyle='rgba(255,246,226,.16)';ctx.fillRect(x+.15,-h*.12,L-.25,h*.24);ctx.fillStyle='rgba(160,140,40,.55)';for(let k=0;k<3;k++)ctx.fillRect(x+.3+k*.55,-h/2+.06,.2,.12)}}},
  wire:{g:'No man\u2019s land',n:'Barbelés',w:6,h:1.4,los:'none',layer:1,
    draw(ctx,it,rnd,s){const{w,h}=it;noShadow(ctx);ctx.strokeStyle='rgba(150,150,140,.85)';ctx.lineWidth=.035;
      for(let k=0;k<3;k++){ctx.beginPath();for(let x=-w/2;x<=w/2;x+=.25){const y=Math.sin(x*4.2+k*2)*h*.35+(rnd()-.5)*.1;x===-w/2?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke()}
      for(let x=-w/2+.2;x<w/2;x+=1.5){shadow(ctx,s,1.2);ctx.fillStyle='#3a332a';ctx.fillRect(x-.08,-.08,.16,.16);noShadow(ctx)}}},
  tomb_wall:{g:'Tombe nécron',n:'Mur de tombe',w:8,h:1.2,los:'block',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it;tombBlock(ctx,w,h,s,3.2,rnd);gaussLine(ctx,-w/2+.35,0,w/2-.35,0,.06,.55);for(let x=-w/2+1;x<w/2;x+=2)glow(ctx,x,0,.45,.5)}},
  pillar:{g:'Tombe nécron',n:'Pilier',w:2.4,h:2.4,los:'block',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it;tombBlock(ctx,w,h,s,3.6,rnd);ctx.fillStyle='#43524a';rrect(ctx,-w*.3,-h*.3,w*.6,h*.6,.08);ctx.fill();ctx.save();ctx.rotate(PI/4);ctx.fillStyle=rgba(GAUSS_B,.85);ctx.fillRect(-.16,-.16,.32,.32);ctx.restore();glow(ctx,0,0,w*.55,.45)}},
  pylon:{g:'Tombe nécron',n:'Pylône',w:3,h:3,los:'obscure',layer:2,round:true,
    draw(ctx,it,rnd,s){const r=Math.min(it.w,it.h)/2;glow(ctx,0,0,r*2.6,.38);shadow(ctx,s,4);ctx.fillStyle='#1e2622';ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();noShadow(ctx);
      ctx.strokeStyle='#3f4d45';ctx.lineWidth=.16;ctx.beginPath();ctx.arc(0,0,r*.78,0,TAU);ctx.stroke();
      for(let i=0;i<3;i++){const a=i/3*TAU-PI/2;gaussLine(ctx,Math.cos(a)*r*.35,Math.sin(a)*r*.35,Math.cos(a)*r*.85,Math.sin(a)*r*.85,.07,.8)}
      ctx.fillStyle=GAUSS_B;ctx.beginPath();for(let i=0;i<3;i++){const a=i/3*TAU-PI/2;i?ctx.lineTo(Math.cos(a)*r*.32,Math.sin(a)*r*.32):ctx.moveTo(Math.cos(a)*r*.32,Math.sin(a)*r*.32)}ctx.closePath();ctx.fill();glow(ctx,0,0,r*.8,.7)}},
  sarco:{g:'Tombe nécron',n:'Sarcophage',w:3,h:1.4,los:'cover',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it;shadow(ctx,s,1.4);ctx.fillStyle='#29332e';rrect(ctx,-w/2,-h/2,w,h,h*.4);ctx.fill();noShadow(ctx);ctx.fillStyle='#3b4842';rrect(ctx,-w/2+.18,-h/2+.16,w-.36,h-.32,h*.3);ctx.fill();gaussLine(ctx,-w/2+.5,0,w/2-.5,0,.05,.6);ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=.03;for(let x=-w/2+.6;x<w/2-.4;x+=.5){ctx.beginPath();ctx.moveTo(x,-h*.28);ctx.lineTo(x,-h*.12);ctx.stroke()}}},
  niche:{g:'Tombe nécron',n:'Niche de stase',w:3,h:1.6,los:'block',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it,t=.32;noShadow(ctx);ctx.fillStyle='#0d1210';ctx.fillRect(-w/2,-h/2,w,h);const g=ctx.createLinearGradient(0,-h/2,0,h/2);g.addColorStop(0,rgba(GAUSS,.35));g.addColorStop(1,rgba(GAUSS,0));ctx.fillStyle=g;ctx.fillRect(-w/2+t,-h/2+t,w-2*t,h-t);
      shadow(ctx,s,3);ctx.fillStyle='#26302b';ctx.fillRect(-w/2,-h/2,w,t);ctx.fillRect(-w/2,-h/2,t,h);ctx.fillRect(w/2-t,-h/2,t,h);noShadow(ctx);ctx.fillStyle='#36443c';ctx.fillRect(-w/2+.05,-h/2+.05,w-.1,t*.4);gaussLine(ctx,-w/2+t+.2,-h/2+t+.12,w/2-t-.2,-h/2+t+.12,.04,.6)}},
  gate:{g:'Tombe nécron',n:'Portail de tombe',w:4,h:1,los:'block',layer:2,door:true,
    draw(ctx,it,rnd,s){const{w,h}=it;const p=Math.min(.8,w*.2);if(!it.open){gaussLine(ctx,-w/2+p,0,w/2-p,0,.12,.75);ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=rgba(GAUSS,.14);ctx.fillRect(-w/2+p,-h*.3,w-2*p,h*.6);ctx.restore()}else{ctx.save();ctx.setLineDash([.2,.15]);ctx.strokeStyle=rgba(GAUSS,.5);ctx.lineWidth=.05;ctx.beginPath();ctx.moveTo(-w/2+p,0);ctx.lineTo(w/2-p,0);ctx.stroke();ctx.restore()}
      for(const sx of[-1,1]){shadow(ctx,s,3.6);ctx.fillStyle='#232c27';ctx.fillRect(sx>0?w/2-p:-w/2,-h/2,p,h);noShadow(ctx);ctx.fillStyle='#3a4741';ctx.fillRect((sx>0?w/2-p:-w/2)+.1,-h/2+.1,p-.2,h-.2);glow(ctx,sx*(w/2-p/2),0,.5,.5)}}},
  door_hive:{g:'Ruines urbaines',n:'Porte blindée',w:3,h:.6,los:'block',layer:2,door:true,
    draw(ctx,it,rnd,s){hiveDoor(ctx,it.w,it.h,it.open,s)}},
  wall_door:{g:'Ruines urbaines',n:'Mur avec porte',w:9,h:.6,los:'block',layer:2,door:true,doorW:3,
    draw(ctx,it,rnd,s){withDoor(ctx,it,rnd,s,3,(x,L)=>{ctx.save();ctx.translate(x,0);wallRun(ctx,L,it.h,rnd,CONCRETE,s,0);ctx.restore()},d=>hiveDoor(ctx,d,it.h,it.open,s))}},
  door_tomb:{g:'Tombe nécron',n:'Seuil scellé',w:3,h:1,los:'block',layer:2,door:true,
    draw(ctx,it,rnd,s){tombDoor(ctx,it.w,it.h,it.open,s,rnd)}},
  tomb_wall_door:{g:'Tombe nécron',n:'Mur de tombe avec seuil',w:8,h:1.2,los:'block',layer:2,door:true,doorW:3,
    draw(ctx,it,rnd,s){withDoor(ctx,it,rnd,s,3,(x,L)=>{ctx.save();ctx.translate(x+L/2,0);tombBlock(ctx,L,it.h,s,3.2,rnd);gaussLine(ctx,-L/2+.3,0,L/2-.3,0,.06,.55);ctx.restore()},d=>tombDoor(ctx,d,it.h,it.open,s,rnd))}},
  door_bunker:{g:'No man\u2019s land',n:'Porte de bunker',w:2.5,h:.8,los:'block',layer:2,door:true,
    draw(ctx,it,rnd,s){bunkerDoor(ctx,it.w,it.h,it.open,s)}},
  objective:{g:'Repères',n:'Objectif',w:1.6,h:1.6,los:'none',layer:3,marker:true,round:true,fixed:true,
    draw(ctx,it,rnd,s,pv){const r=.79;if(!pv){ctx.setLineDash([.35,.25]);ctx.strokeStyle='rgba(232,222,200,.6)';ctx.lineWidth=.06;ctx.beginPath();ctx.arc(0,0,r+3,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(232,222,200,.05)';ctx.fill()}
      shadow(ctx,s,.5);ctx.fillStyle='#151A1F';ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fill();noShadow(ctx);ctx.strokeStyle='#C2D7E3';ctx.lineWidth=.1;ctx.stroke();ctx.beginPath();ctx.arc(0,0,r*.55,0,TAU);ctx.strokeStyle='rgba(194,215,227,.5)';ctx.lineWidth=.05;ctx.stroke();
      if(!pv&&it.label)wtext(ctx,0,r+.75,it.label,.62,s,'#E8DEC8')}},
  arrival:{g:'Repères',n:'Arrivée de renforts',w:2.4,h:2,los:'none',layer:3,marker:true,fac:'necrons',
    draw(ctx,it,rnd,s,pv){const{w,h}=it;const c=(FACTIONS[it.faction]||FACTIONS.neutre).c;noShadow(ctx);
      for(let k=0;k<2;k++){const x=-w/2+k*w*.42;ctx.fillStyle=rgba(c,k?.95:.5);ctx.beginPath();ctx.moveTo(x,-h/2);ctx.lineTo(x+w*.5,0);ctx.lineTo(x,h/2);ctx.lineTo(x+w*.18,0);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=.05;ctx.stroke()}
      if(!pv&&it.label){ctx.rotate(-it.rot*PI/180);let o=Math.max(w,h)/2+.55;if(it.y+o>CURH-.4)o=-o;wtext(ctx,0,o,it.label,.6,s,'#E8DEC8')}}},
  zone:{g:'Repères',n:'Zone de déploiement',w:12,h:8,los:'none',layer:0,marker:true,fac:'loyalistes',
    draw(ctx,it,rnd,s,pv){const{w,h}=it;const c=(FACTIONS[it.faction]||FACTIONS.neutre).c;noShadow(ctx);if(pv!=='label'){ctx.fillStyle=rgba(c,.13);ctx.fillRect(-w/2,-h/2,w,h);ctx.setLineDash([.6,.35]);ctx.strokeStyle=rgba(c,.9);ctx.lineWidth=.1;ctx.strokeRect(-w/2+.05,-h/2+.05,w-.1,h-.1);ctx.setLineDash([])}
      if(pv==='label'){const t=it.label||FACTIONS[it.faction]?.n||'Zone';ctx.rotate(-it.rot*PI/180);wtext(ctx,0,0,t,.75,s,c)}}},
  label:{g:'Repères',n:'Texte',w:6,h:1.2,los:'none',layer:3,marker:true,
    draw(ctx,it,rnd,s,pv){if(pv){ctx.fillStyle='#E8DEC8';ctx.fillRect(-it.w/2,-.08,it.w,.16);return}wtext(ctx,0,0,it.label||'Texte',it.h*.8,s,'#E8DEC8')}}
};
const GROUPS=['Tombe nécron','Ruines urbaines','No man\u2019s land','Repères'];
const LOS_TXT={block:'Bloque la ligne de vue',obscure:'Obscurcissant',cover:'Couvert léger',none:'Sans effet sur la ligne de vue'};

/* ---------- sol procédural ---------- */
const BIOMES={
  tombe:{px(u,v,n1,n2){const t=fbm(n1,u*.3,v*.3,5),d=fbm(n2,u*2,v*2,2);return[lerp(20,44,t)+d*8,lerp(27,52,t)+d*8,lerp(24,47,t)+d*7]},
    over(g,W,H,R,rnd){g.lineWidth=1.2;for(let y=0;y<H;y+=4)for(let x=0;x<W;x+=4){const off=(Math.floor(y/4)%2)*2;g.fillStyle=rnd()<.5?`rgba(0,0,0,${rnd()*.14})`:`rgba(210,230,215,${rnd()*.04})`;g.fillRect((x+off)*R,y*R,4*R,4*R)}
      g.strokeStyle='rgba(0,0,0,.42)';for(let y=0;y<=H;y+=4){g.beginPath();g.moveTo(0,y*R);g.lineTo(W*R,y*R);g.stroke()}for(let y=0;y<H;y+=4){const off=(Math.floor(y/4)%2)*2;for(let x=off;x<=W;x+=4){g.beginPath();g.moveTo(x*R,y*R);g.lineTo(x*R,(y+4)*R);g.stroke()}}
      g.strokeStyle='rgba(255,255,255,.04)';for(let y=0;y<=H;y+=4){g.beginPath();g.moveTo(0,y*R+1.5);g.lineTo(W*R,y*R+1.5);g.stroke()}
      g.globalCompositeOperation='lighter';for(let i=0;i<W*H/40;i++){let x=Math.round(rnd()*W/4)*4,y=Math.round(rnd()*H/4)*4;g.strokeStyle='rgba(79,207,138,.18)';g.lineWidth=1.4;g.beginPath();g.moveTo(x*R,y*R);for(let k=0;k<4;k++){if(rnd()<.5)x+=rnd()<.5?2:-2;else y+=rnd()<.5?2:-2;g.lineTo(x*R,y*R)}g.stroke();g.fillStyle='rgba(147,235,184,.25)';g.fillRect(x*R-2,y*R-2,4,4)}g.globalCompositeOperation='source-over';
      cracks(g,W,H,R,rnd,'rgba(0,0,0,.5)',W*H/90)}},
  ruine:{px(u,v,n1,n2){const t=fbm(n1,u*.3,v*.3,5),d=fbm(n2,u*2.5,v*2.5,2),ash=fbm(n2,u*.18+9,v*.18,4);let r=lerp(50,84,t)+d*10,g=lerp(48,80,t)+d*10,b=lerp(44,72,t)+d*9;const k=clamp((ash-.55)*4,0,.7);return[lerp(r,26,k),lerp(g,25,k),lerp(b,23,k)]},
    over(g,W,H,R,rnd){g.strokeStyle='rgba(0,0,0,.22)';g.lineWidth=1;for(let x=0;x<=W;x+=6){g.beginPath();g.moveTo(x*R,0);g.lineTo(x*R,H*R);g.stroke()}for(let y=0;y<=H;y+=6){g.beginPath();g.moveTo(0,y*R);g.lineTo(W*R,y*R);g.stroke()}
      for(let i=0;i<W*H/14;i++){const x=rnd()*W*R,y=rnd()*H*R;const gr=g.createRadialGradient(x,y,0,x,y,(1+rnd()*3)*R);gr.addColorStop(0,'rgba(10,9,8,.35)');gr.addColorStop(1,'rgba(10,9,8,0)');if(rnd()<.18){g.fillStyle=gr;g.fillRect(x-4*R,y-4*R,8*R,8*R)}}
      for(let i=0;i<W*H*3;i++){g.fillStyle=rnd()<.6?'rgba(0,0,0,.3)':'rgba(220,210,190,.14)';const r=rnd()*.12*R+.6;g.beginPath();g.arc(rnd()*W*R,rnd()*H*R,r,0,TAU);g.fill()}
      cracks(g,W,H,R,rnd,'rgba(0,0,0,.45)',W*H/60)}},
  boue:{px(u,v,n1,n2){const t=fbm(n1,u*.28,v*.28,5),d=fbm(n2,u*2.2,v*2.2,2),p=fbm(n2,u*.2+4,v*.2,4);let r=lerp(48,90,t)+d*10,g=lerp(42,78,t)+d*9,b=lerp(30,55,t)+d*6;const k=clamp((p-.56)*6,0,1);r=lerp(r,30,k);g=lerp(g,31,k);b=lerp(b,27,k);if(k>.6&&d>.62){r+=22;g+=24;b+=24}return[r,g,b]},
    over(g,W,H,R,rnd){g.lineWidth=2;for(let i=0;i<W/10;i++){let y=rnd()*H;g.strokeStyle='rgba(20,16,10,.28)';g.beginPath();g.moveTo(0,y*R);for(let x=0;x<=W;x+=2){y+=(rnd()-.5)*.8;g.lineTo(x*R,y*R)}g.stroke();g.beginPath();g.moveTo(0,(y+.9)*R)}
      for(let i=0;i<W*H*1.2;i++){g.fillStyle=rnd()<.5?'rgba(15,12,8,.35)':'rgba(170,155,120,.18)';const r=rnd()*.14*R+.7;g.beginPath();g.arc(rnd()*W*R,rnd()*H*R,r,0,TAU);g.fill()}}}
};
function cracks(g,W,H,R,rnd,col,n){g.strokeStyle=col;g.lineWidth=1;for(let i=0;i<n;i++){let x=rnd()*W,y=rnd()*H,a=rnd()*TAU;g.beginPath();g.moveTo(x*R,y*R);for(let k=0;k<6;k++){a+=(rnd()-.5)*1.2;x+=Math.cos(a)*.6;y+=Math.sin(a)*.6;g.lineTo(x*R,y*R)}g.stroke()}}
const groundCache=new Map();
function ground(biome,W,H){const key=biome+W+'x'+H;if(groundCache.has(key))return groundCache.get(key);
  const R=12,cw=Math.round(W*R),ch=Math.round(H*R),cv=document.createElement('canvas');cv.width=cw;cv.height=ch;const g=cv.getContext('2d');
  const img=g.createImageData(cw,ch),D=img.data,B=BIOMES[biome]||BIOMES.ruine,n1=makeNoise(7),n2=makeNoise(91);
  for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){const c=B.px(x/R,y/R,n1,n2),i=(y*cw+x)*4;D[i]=c[0];D[i+1]=c[1];D[i+2]=c[2];D[i+3]=255}
  g.putImageData(img,0,0);B.over(g,W,H,R,mulberry32(hashStr(biome+W+H)));
  const vg=g.createRadialGradient(cw/2,ch/2,Math.min(cw,ch)*.35,cw/2,ch/2,Math.max(cw,ch)*.75);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.42)');g.fillStyle=vg;g.fillRect(0,0,cw,ch);
  groundCache.set(key,cv);if(groundCache.size>6)groundCache.delete(groundCache.keys().next().value);return cv}


/* ---------- catalogue V11 ---------- */
let CURH=30;
const FAMILY_LABEL={tombe:'Tombe nécron',ruines:'Ruines urbaines',no_mans_land:'No man\u2019s land'};
// Valeurs de secours si Supabase ne répond pas (mêmes valeurs que les tables decor_types et area_types)
const FB_H={ruin_l:6,ruin_box:5,wall:3,muraille:6,container:3,rubble:1,crater:0,trench:0,sandbags:1,barricade:1.5,wire:1,tomb_wall:4.1,pillar:5,pylon:8,sarco:1.5,niche:4,gate:4,door_hive:3,wall_door:3,door_tomb:4.1,tomb_wall_door:4.1,door_bunker:2};
const FALLBACK_DECOR=Object.keys(CAT).filter(k=>!CAT[k].marker).map(k=>({id:k,name:CAT[k].n,family:CAT[k].g==='Tombe nécron'?'tombe':CAT[k].g==='Ruines urbaines'?'ruines':'no_mans_land',width_in:k==='pylon'?5:CAT[k].w,depth_in:k==='pylon'?5:CAT[k].h,height_in:FB_H[k]||0,layer:CAT[k].layer,render_key:k}));
const FALLBACK_AREAS=[
  {id:'large_rect',name:'Grand rectangle',shape:'rect',width_in:7,depth_in:11.5,obscuring_default:true,official:true},
  {id:'large_triangle',name:'Grand triangle rectangle',shape:'triangle',width_in:8,depth_in:11.5,obscuring_default:true,official:true},
  {id:'medium_rect',name:'Rectangle moyen',shape:'rect',width_in:6,depth_in:4,obscuring_default:true,official:true},
  {id:'long_line',name:'Ligne longue',shape:'line',width_in:10,depth_in:2.5,obscuring_default:true,official:true},
  {id:'short_line',name:'Ligne courte',shape:'line',width_in:6,depth_in:2,obscuring_default:true,official:true},
  {id:'custom',name:'Zone libre',shape:'custom',width_in:null,depth_in:null,obscuring_default:true,official:false}];
const MARKERS={
  deploy:{n:'Zone de déploiement',w:12,h:8,fac:'loyalistes',draw:'zone'},
  arrival:{n:'Arrivée de renforts',w:2.4,h:2,fac:'necrons',draw:'arrival'},
  label:{n:'Texte',w:6,h:1.2,draw:'label'}};
const KAT={decor:{},areas:{},sets:[],setItems:[],stl:[]};
function setCatalog(decor,areas){KAT.decor={};(decor&&decor.length?decor:FALLBACK_DECOR).forEach(d=>KAT.decor[d.id]=d);FALLBACK_DECOR.forEach(d=>{if(CAT[d.id].door&&!KAT.decor[d.id])KAT.decor[d.id]=d});KAT.areas={};(areas&&areas.length?areas:FALLBACK_AREAS).forEach(a=>KAT.areas[a.id]=a)}
setCatalog();
let CAT_P=null;
function loadCatalog(sb,admin){if(CAT_P)return CAT_P;CAT_P=(async()=>{if(!sb)return;try{
  const[d,a,s,si]=await Promise.all([sb.from('decor_types').select('*'),sb.from('area_types').select('*'),sb.from('decor_sets').select('*'),sb.from('decor_set_items').select('*')]);
  setCatalog(d.data,a.data);KAT.sets=s.data||[];KAT.setItems=si.data||[];
  if(admin){const st=await sb.from('stl_sources').select('id,type_id,title,url,author,license,scale,status,quantity,print_notes');KAT.stl=st.data||[]}}catch(e){}})();return CAT_P}

/* ---------- géométrie et dessin ---------- */
function areaPath(c,it){const{w,h}=it;c.beginPath();const sh=(KAT.areas[it.type]||{}).shape;if(sh==='triangle'){c.moveTo(-w/2,-h/2);c.lineTo(-w/2,h/2);c.lineTo(w/2,h/2);c.closePath()}else c.rect(-w/2,-h/2,w,h)}
function drawArea(c,it,s){noShadow(c);
  if(TACT){areaPath(c,it);c.fillStyle=it.obscuring?'#38434A':'rgba(56,67,74,.35)';c.fill();c.lineWidth=.08;c.strokeStyle='#C2D7E3';if(!it.obscuring)c.setLineDash([.4,.25]);c.stroke();c.setLineDash([])}
  else{areaPath(c,it);c.fillStyle='rgba(10,10,8,.22)';c.fill();c.lineWidth=.07;c.strokeStyle='rgba(232,222,200,.28)';c.stroke()}
  if(it.objective){c.save();areaPath(c,it);c.clip();areaPath(c,it);c.lineWidth=.32;c.strokeStyle=TACT?'#DDB64F':'rgba(232,222,200,.55)';c.stroke();c.restore();
    const yl=-it.h/2+.75;c.save();c.translate(0,yl);c.rotate(-it.rot*PI/180);wtext(c,0,0,'◆ '+(it.label||'Objectif'),.62,s,TACT?'#F2D788':'#E8DEC8');c.restore()}
  else if(it.label){c.save();c.rotate(-it.rot*PI/180);wtext(c,0,0,it.label,.55,s,'rgba(232,222,200,.8)');c.restore()}}
function drawFeature(c,it,s){const d=KAT.decor[it.type]||{};const key=d.render_key||it.type;
  if(TACT&&CAT[key]&&CAT[key].door){noShadow(c);const dw=CAT[key].doorW?Math.min(CAT[key].doorW,it.w*.6):it.w,Ls=(it.w-dw)/2;
    const box=(x,w,op)=>{c.beginPath();c.rect(x,-it.h/2,w,it.h);c.fillStyle=op?'rgba(232,222,200,.05)':'rgba(232,222,200,.30)';c.fill();c.lineWidth=op?.05:.09;c.strokeStyle='#E8DEC8';if(op)c.setLineDash([.3,.2]);c.stroke();c.setLineDash([])};
    if(Ls>0){box(-it.w/2,Ls,false);box(it.w/2-Ls,Ls,false)}box(-dw/2,dw,!!it.open);
    c.save();c.rotate(-it.rot*PI/180);wtext(c,0,0,it.open?'ouverte':'fermée',.45,s,'#E8DEC8');c.restore();return}
  if(TACT){noShadow(c);const hgt=+d.height_in||0;c.beginPath();if(CAT[key]&&CAT[key].round)c.ellipse(0,0,it.w/2,it.h/2,0,0,TAU);else c.rect(-it.w/2,-it.h/2,it.w,it.h);
    c.fillStyle='rgba(232,222,200,.10)';c.fill();c.lineWidth=.05;c.strokeStyle=hgt>=3?'#E8DEC8':'rgba(232,222,200,.45)';c.stroke();
    if(hgt>=3){c.save();c.rotate(-it.rot*PI/180);wtext(c,0,0,(String(hgt).replace('.',','))+'″',.5,s,'#E8DEC8');c.restore()}return}
  if(CAT[key]&&!CAT[key].marker)CAT[key].draw(c,it,mulberry32(hashStr(it.id)),s,false);
  else{shadow(c,s,+d.height_in||1);c.fillStyle='#5a5650';c.fillRect(-it.w/2,-it.h/2,it.w,it.h);noShadow(c);c.save();c.rotate(-it.rot*PI/180);wtext(c,0,0,d.name||it.type,.5,s);c.restore()}}
function drawMarker(c,it,s,pass){const M=MARKERS[it.type];if(!M)return;const d=CAT[M.draw];
  if(it.type==='deploy'){if(pass==='label')d.draw(c,it,null,s,'label');else d.draw(c,it,null,s,true)}
  else if(pass!=='label')d.draw(c,it,null,s,false)}
/* types linéaires : traçables avec l'outil Murs et découpés en modules dans la liste d'impression.
   MODULES = longueurs imprimables par défaut (pouces) ; remplacées par decor_types.defaults.modules si présent. */
const LINEAR={tomb_wall:1,wall:1,muraille:1,sandbags:1,barricade:1,wire:1,trench:1};
const MODULES={tomb_wall:[8,4,2],wall:[6,3],muraille:[12,6],sandbags:[5],barricade:[6,3],wire:[6,3],trench:[12,6]};
function modulesFor(t){const d=KAT.decor[t]||{},m=d.defaults&&d.defaults.modules;return Array.isArray(m)&&m.length?m.map(Number).filter(x=>x>0):(MODULES[d.render_key||t]||null)}
/* découpe une longueur en modules : couvre le plus possible avec le moins de pièces, le reste part en « sur mesure » */
function decompose(L,mods){const u=v=>Math.round(v*2),n=u(L),ms=[...new Set(mods.map(u).filter(x=>x>0))].sort((a,b)=>b-a);const best=new Array(n+1).fill(Infinity),pick=new Array(n+1).fill(0);best[0]=0;
  for(let i=1;i<=n;i++)for(const m of ms)if(m<=i&&best[i-m]+1<best[i]){best[i]=best[i-m]+1;pick[i]=m}
  let i=n;while(i>0&&best[i]===Infinity)i--;const cnt={};let j=i;while(j>0){const m=pick[j];cnt[m/2]=(cnt[m/2]||0)+1;j-=m}
  const rest=Math.round((L-i/2)*100)/100;return{cnt,rest:rest>.04?rest:0}}
function isDoor(it){if(it.k!=='f')return false;const d=KAT.decor[it.type]||{};const c=CAT[d.render_key||it.type];return!!(c&&c.door)}
function rank(it){if(it.k==='a')return 1;if(it.k==='m')return it.type==='deploy'?0:5;const d=KAT.decor[it.type];return(d&&+d.layer===1)?2:3}
function sorted(items){return items.map((it,i)=>({it,i})).sort((a,b)=>(rank(a.it)-rank(b.it))||(a.i-b.i)).map(o=>o.it)}
/* ---------- portes encastrées : une porte posée sur un mur prend son axe et son épaisseur, et le mur s'ouvre à sa largeur ---------- */
const HOSTWALL={tomb_wall:1,wall:1,muraille:1,sandbags:1,barricade:1};
function isHostWall(it){return it.k==='f'&&!!HOSTWALL[(KAT.decor[it.type]||{}).render_key||it.type]}
/* mur le plus proche du point p capable d'accueillir une porte ; t = position le long du mur depuis son centre */
function wallAt(items,p,rot,skip){let best=null,bd=1e9;for(const w of items){if(w===skip||!isHostWall(w))continue;
    const a=w.rot*PI/180,ux=Math.cos(a),uy=Math.sin(a),dx=p[0]-w.x,dy=p[1]-w.y,t=dx*ux+dy*uy,n=-dx*uy+dy*ux;
    if(Math.abs(t)>w.w/2+.1||Math.abs(n)>w.h/2+.6)continue;
    if(rot!=null){let da=Math.abs(((rot-w.rot)%180+180)%180);if(Math.min(da,180-da)>20)continue}
    if(Math.abs(n)<bd){bd=Math.abs(n);best={wall:w,t}}}
  return best}
/* géométrie d'une porte de largeur dw posée sur le mur w : départ calé au demi-pouce depuis le début du mur */
function doorFit(w,t,dw){const a=w.rot*PI/180,ux=Math.cos(a),uy=Math.sin(a);dw=Math.min(dw,w.w);
  const t0=clamp(Math.round((t+w.w/2-dw/2)*2)/2,0,w.w-dw),sx=w.x-ux*w.w/2,sy=w.y-uy*w.w/2,at=v=>[sx+ux*v,sy+uy*v];
  return{dw,t0,L1:t0,L2:w.w-t0-dw,at,c:at(t0+dw/2)}}
function seatDoor(items,door,hit){const w=hit.wall,f=doorFit(w,hit.t,door.w),r2=v=>Math.round(v*100)/100;
  door.w=r2(f.dw);door.h=w.h;door.rot=w.rot;door.x=r2(f.c[0]);door.y=r2(f.c[1]);
  const P=[];if(f.L1>=.25){const c=f.at(f.L1/2);P.push(Object.assign({},w,{x:r2(c[0]),y:r2(c[1]),w:r2(f.L1)}))}
  if(f.L2>=.25){const c=f.at(f.t0+f.dw+f.L2/2);P.push(Object.assign({},w,{id:P.length?uid():w.id,x:r2(c[0]),y:r2(c[1]),w:r2(f.L2)}))}
  items.splice(items.indexOf(w),1,...P);const j=items.indexOf(door);if(j>=0){items.splice(j,1);items.push(door)}return f}
/* porte retirée de son mur (déplacée ailleurs) : les deux morceaux de mur qui la touchaient se referment */
function unseatDoor(items,door,x,y){const a=door.rot*PI/180,ux=Math.cos(a),uy=Math.sin(a),e1=[x-ux*door.w/2,y-uy*door.w/2],e2=[x+ux*door.w/2,y+uy*door.w/2],r2=v=>Math.round(v*100)/100;
  const ends=w=>{const b=w.rot*PI/180,vx=Math.cos(b),vy=Math.sin(b);return[[w.x-vx*w.w/2,w.y-vy*w.w/2],[w.x+vx*w.w/2,w.y+vy*w.w/2]]};
  const near=(p,q)=>Math.hypot(p[0]-q[0],p[1]-q[1])<.08,par=w=>{const da=Math.abs(((w.rot-door.rot)%180+180)%180);return Math.min(da,180-da)<1};
  let A=null,Ae=null,B=null,Be=null;
  for(const w of items){if(w===door||!isHostWall(w)||!par(w))continue;const E=ends(w);
    if(!A&&(near(E[0],e1)||near(E[1],e1))){A=w;Ae=near(E[0],e1)?E[1]:E[0];continue}
    if(!B&&(near(E[0],e2)||near(E[1],e2))){B=w;Be=near(E[0],e2)?E[1]:E[0]}}
  if(!A&&!B)return false;
  const span=(w,p,q)=>{w.x=r2((p[0]+q[0])/2);w.y=r2((p[1]+q[1])/2);w.w=r2(Math.hypot(q[0]-p[0],q[1]-p[1]))};
  if(A&&B&&A.type===B.type&&Math.abs(A.h-B.h)<.01){span(A,Ae,Be);items.splice(items.indexOf(B),1)}
  else if(A&&B){span(A,Ae,[x,y]);span(B,[x,y],Be)}
  else if(A)span(A,Ae,e2);else span(B,e1,Be);
  return true}

/* ---------- besoins d'impression : décors posés sur les cartes, croisés avec les sources STL ---------- */
function needsOf(items){const out={};(items||[]).filter(i=>i.k==='f').forEach(i=>{const mods=modulesFor(i.type),o=out[i.type]=out[i.type]||{n:0,len:0,mods:{},rest:[]};o.n++;
    if(mods){o.len+=i.w;const r=decompose(i.w,mods);for(const[m,c]of Object.entries(r.cnt))o.mods[m]=(o.mods[m]||0)+c;if(r.rest)o.rest.push(r.rest)}});return out}
/* plusieurs cartes : les décors resservent d'une partie à l'autre, on garde donc le maximum demandé par une seule carte */
function needsMax(list){const out={};list.forEach(({name,need})=>{for(const[t,o]of Object.entries(need)){const m=out[t]=out[t]||{n:0,len:0,mods:{},rest:[],by:''};
    if(o.n>m.n){m.n=o.n;m.by=name}if(o.len>m.len){m.len=o.len;m.rest=o.rest.slice()}for(const[k,c]of Object.entries(o.mods))m.mods[k]=Math.max(m.mods[k]||0,c)}});return out}
const STAT_ORDER=['peint','imprime','a_imprimer','retenu','a_evaluer'];
function coverage(t){const L=KAT.stl.filter(x=>x.type_id===t&&x.status!=='ecarte');if(!L.length)return{key:'none',txt:'aucune source',L};
  const b=STAT_ORDER.find(st=>L.some(x=>x.status===st));return{key:b,txt:{peint:'peint',imprime:'imprimé',a_imprimer:'à imprimer',retenu:'source retenue',a_evaluer:'pistes à évaluer'}[b],L}}

/* ---------- plan de pose : chaque zone et décor numéroté, coté depuis les bords les plus proches (façon plans de terrain GW) ---------- */
const POSE_C='#F2B33D';
const fN=v=>String(Math.round(v*10)/10).replace('.',',')+'″';
function aabbW(it){const a=it.rot*PI/180,co=Math.abs(Math.cos(a)),si=Math.abs(Math.sin(a)),hw=(it.w*co+it.h*si)/2,hh=(it.w*si+it.h*co)/2;return{l:it.x-hw,r:it.x+hw,t:it.y-hh,b:it.y+hh}}
function nameOf(it){return it.k==='a'?(KAT.areas[it.type]||{}).name||'Zone':it.k==='f'?(KAT.decor[it.type]||{}).name||it.type:(MARKERS[it.type]||{}).n||it.type}
function poseEntries(map){const W=map.w,H=map.h;
  const L=map.items.filter(i=>i.k==='a'||i.k==='f').map(it=>({it,b:aabbW(it)}))
    .sort((p,q)=>(p.it.k===q.it.k?0:p.it.k==='a'?-1:1)||(Math.round(p.b.t)-Math.round(q.b.t))||(p.b.l-q.b.l));
  let na=0,nf=0;
  return L.map(({it,b})=>{const r=((it.rot%90)+90)%90,straight=r<.5||r>89.5;let px,py,hx,vy,ex,ey,dx,dy;
    if(straight){if(b.l<=W-b.r){px=b.l;ex='gauche';dx=b.l;hx=0}else{px=b.r;ex='droit';dx=W-b.r;hx=W}
      if(b.t<=H-b.b){py=b.t;ey='haut';dy=b.t;vy=0}else{py=b.b;ey='bas';dy=H-b.b;vy=H}}
    else{px=it.x;py=it.y;if(px<=W-px){ex='gauche';dx=px;hx=0}else{ex='droit';dx=W-px;hx=W}if(py<=H-py){ey='haut';dy=py;vy=0}else{ey='bas';dy=H-py;vy=H}}
    return{it,b,n:it.k==='a'?'Z'+(++na):String(++nf),px,py,hx,vy,ex,ey,dx:Math.max(0,dx),dy:Math.max(0,dy),straight}})}
function poseText(e){const it=e.it,side=v=>v==='droit'?'droite':v;
  const dims=e.straight?`${fN(e.b.r-e.b.l)} ↔ × ${fN(e.b.b-e.b.t)} ↕`:`${fN(it.w)} × ${fN(it.h)}, pivoté de ${Math.round(it.rot)}°`;
  const ref=e.straight?`Coin ${e.ey}-${side(e.ex)}`:'Centre';
  const d1=e.dx<.05?`contre le bord ${e.ex}`:`${fN(e.dx)} du bord ${e.ex}`,d2=e.dy<.05?`contre le bord ${e.ey}`:`${fN(e.dy)} du bord ${e.ey}`;
  const extra=isDoor(it)?(it.open?' · ouverte':' · fermée'):it.k==='a'?(it.objective?' · objectif':'')+(it.obscuring?' · Obscurcissante':''):'';
  return{num:e.n,name:nameOf(it)+(it.label?' « '+it.label+' »':''),dims:dims+extra,line:`${ref} à ${d1} et ${d2}`}}
function drawPose(c,map,s,ox,oy,o){const E=poseEntries(map),dpr=o.dpr||1,only=o.poseOnly&&o.poseOnly.size?o.poseOnly:null,P=(x,y)=>[ox+x*s,oy+y*s];
  const fs=Math.max(10*dpr,Math.min(13*dpr,s*.5)),placed=[],hitR=r=>placed.some(q=>r.x<q.x+q.w&&r.x+r.w>q.x&&r.y<q.y+q.h&&r.y+r.h>q.y);
  c.save();c.setTransform(1,0,0,1,0,0);noShadow(c);
  c.strokeStyle='rgba(242,179,61,.32)';c.lineWidth=dpr;c.setLineDash([6*dpr,6*dpr]);
  let a=P(map.w/2,0),b=P(map.w/2,map.h);c.beginPath();c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);a=P(0,map.h/2);b=P(map.w,map.h/2);c.moveTo(a[0],a[1]);c.lineTo(b[0],b[1]);c.stroke();c.setLineDash([]);
  const m=P(map.w/2,map.h/2);c.strokeStyle=POSE_C;c.lineWidth=1.5*dpr;c.beginPath();c.moveTo(m[0]-7*dpr,m[1]);c.lineTo(m[0]+7*dpr,m[1]);c.moveTo(m[0],m[1]-7*dpr);c.lineTo(m[0],m[1]+7*dpr);c.stroke();
  c.font=`${fs}px Marcellus, Georgia, serif`;c.textBaseline='middle';c.textAlign='center';
  const B=E.map(e=>{const tw=c.measureText(e.n).width,r=Math.max(9*dpr,tw/2+5*dpr),q=e.it.k==='a'?[Math.min(ox+e.b.l*s+r+3*dpr,ox+e.it.x*s),Math.min(oy+e.b.t*s+r+3*dpr,oy+e.it.y*s)]:P(e.it.x,e.it.y);/* badge de zone dans son coin haut-gauche, celui d'un décor en son centre */const R={x:q[0]-r,y:q[1]-r,w:2*r,h:2*r};placed.push(R);return{e,q,r}});
  const dim=(p0,p1,val,horiz)=>{const t=fN(val),tw=c.measureText(t).width+6*dpr,th=fs*1.25;let R=null,cx,cy;
      for(const f of[.5,.35,.65,.2,.8]){cx=p0[0]+(p1[0]-p0[0])*f;cy=p0[1]+(p1[1]-p0[1])*f;const q={x:cx-tw/2,y:cy-th/2,w:tw,h:th};if(!hitR(q)){R=q;break}}
      if(!R)return false;   // pas de place pour le chiffre : la cote reste dans la fiche
      c.strokeStyle=POSE_C;c.lineWidth=1.25*dpr;c.beginPath();c.moveTo(p0[0],p0[1]);c.lineTo(p1[0],p1[1]);const k=5*dpr;
      for(const q of[p0,p1]){if(horiz){c.moveTo(q[0],q[1]-k);c.lineTo(q[0],q[1]+k)}else{c.moveTo(q[0]-k,q[1]);c.lineTo(q[0]+k,q[1])}}c.stroke();
      placed.push(R);c.fillStyle='rgba(11,14,16,.88)';c.fillRect(R.x,R.y,R.w,R.h);c.fillStyle=POSE_C;c.fillText(t,cx,cy+dpr*.5);return true};
  /* par défaut (comme les plans GW) : on cote les zones de terrain et les décors posés hors zone ; une sélection affiche ses propres cotes */
  const areas=map.items.filter(i=>i.k==='a'),cote=e=>only?only.has(e.it.id):(e.it.k==='a'||!areas.some(a=>inside(a,[e.it.x,e.it.y])));
  E.filter(cote).sort((p,q)=>(p.it.k==='a'?0:1)-(q.it.k==='a'?0:1)).forEach(e=>{const pt=P(e.px,e.py);let any=false;
    const iy=e.py<.4?.6:e.py>map.h-.4?-.6:0,ix=e.px<.4?.6:e.px>map.w-.4?-.6:0;   // cote collée à un bord : décalée vers l'intérieur pour rester lisible
    if(e.dx>=.05)any=dim(P(e.hx,e.py+iy),P(e.px,e.py+iy),e.dx,true)||any;if(e.dy>=.05)any=dim(P(e.px+ix,e.vy),P(e.px+ix,e.py),e.dy,false)||any;
    if(any||e.dx<.05||e.dy<.05){c.fillStyle=POSE_C;c.beginPath();c.arc(pt[0],pt[1],3*dpr,0,TAU);c.fill()}});
  B.forEach(({e,q,r})=>{const dim2=only&&!only.has(e.it.id);c.globalAlpha=dim2?.55:1;c.fillStyle='#0B0E10';c.strokeStyle=e.it.k==='a'?'#C2D7E3':POSE_C;c.lineWidth=1.5*dpr;
    c.beginPath();if(e.it.k==='a')rrect(c,q[0]-r,q[1]-r*.8,2*r,1.6*r,3*dpr);else c.arc(q[0],q[1],r,0,TAU);c.fill();c.stroke();c.fillStyle='#F2EBDD';c.fillText(e.n,q[0],q[1]+dpr*.5);c.globalAlpha=1});
  c.restore()}
function drawOne(c,it,s,ox,oy){TS=+it.ts||1;c.save();c.setTransform(s,0,0,s,ox,oy);c.translate(it.x,it.y);c.rotate(it.rot*PI/180);
  if(it.k==='a')drawArea(c,it,s);else if(it.k==='f')drawFeature(c,it,s);else drawMarker(c,it,s);c.restore();noShadow(c);TS=1}
function renderMap(c,map,s,ox,oy,o){const W=map.w,H=map.h;CURH=H;o=o||{};const dpr=o.dpr||1;LDPR=dpr;LQ=[];const T0=TACT;if(o.pose)TACT=true;
  c.save();c.setTransform(1,0,0,1,0,0);c.shadowColor='rgba(0,0,0,.7)';c.shadowBlur=24*dpr;c.fillStyle='#000';c.fillRect(ox,oy,W*s,H*s);noShadow(c);
  if(TACT){c.fillStyle=o.pose?'#20272b':'#1b2024';c.fillRect(ox,oy,W*s,H*s)}else c.drawImage(ground(map.biome,W,H),ox,oy,W*s,H*s);
  c.beginPath();c.rect(ox,oy,W*s,H*s);c.clip();
  if(o.grid||o.pose){c.lineWidth=1;for(let x=0;x<=W;x++){c.strokeStyle=x%6?'rgba(232,222,200,.07)':'rgba(232,222,200,.17)';c.beginPath();c.moveTo(Math.round(ox+x*s)+.5,oy);c.lineTo(Math.round(ox+x*s)+.5,oy+H*s);c.stroke()}for(let y=0;y<=H;y++){c.strokeStyle=y%6?'rgba(232,222,200,.07)':'rgba(232,222,200,.17)';c.beginPath();c.moveTo(ox,Math.round(oy+y*s)+.5);c.lineTo(ox+W*s,Math.round(oy+y*s)+.5);c.stroke()}}
  const L=sorted(map.items);for(const it of L)drawOne(c,it,s,ox,oy);
  for(const it of L)if(it.k==='m'&&it.type==='deploy'){TS=+it.ts||1;c.save();c.setTransform(s,0,0,s,ox,oy);c.translate(it.x,it.y);c.rotate(it.rot*PI/180);drawMarker(c,it,s,'label');c.restore();TS=1}
  flushLabels(c,{x0:ox,y0:oy,x1:ox+W*s,y1:oy+H*s});
  if(o.pose)drawPose(c,map,s,ox,oy,o);
  c.restore();TACT=T0;
  if(o.rulers!==false){c.save();const col=o.rulerColor||'#A99C82';c.strokeStyle=col;c.fillStyle=col;c.lineWidth=1;const fs=Math.max(9,Math.min(12*dpr,s*.55));c.font=`${fs}px Marcellus, Georgia, serif`;c.textAlign='center';c.textBaseline='bottom';
    for(let x=0;x<=W;x++){const Lh=x%6?4:9,px=Math.round(ox+x*s)+.5;c.beginPath();c.moveTo(px,oy-2);c.lineTo(px,oy-2-Lh*dpr);c.stroke();if(x%6===0)c.fillText(x,px,oy-4-10*dpr)}
    c.textAlign='right';c.textBaseline='middle';for(let y=0;y<=H;y++){const Lh=y%6?4:9,py=Math.round(oy+y*s)+.5;c.beginPath();c.moveTo(ox-2,py);c.lineTo(ox-2-Lh*dpr,py);c.stroke();if(y%6===0)c.fillText(y,ox-6-10*dpr,py)}c.restore()}}

/* ---------- format : layout V11 <-> éléments ---------- */
function toItems(layout){const L=layout||{},out=[];
  if(Array.isArray(L)||Array.isArray(L.items))return fromV0(Array.isArray(L)?L:L.items);
  (L.areas||[]).forEach(a=>out.push(Object.assign({k:'a',rot:0,obscuring:true,objective:false},a)));
  (L.features||[]).forEach(f=>out.push(Object.assign({k:'f',rot:0},f)));
  (L.markers||[]).forEach(m=>out.push(Object.assign({k:'m',rot:0},m,{type:m.kind||m.type})));
  out.forEach(i=>{if(!i.id)i.id=uid()});return out}
function fromV0(items){const out=[];(items||[]).forEach(i=>{const b={id:i.id||uid(),x:i.x,y:i.y,w:i.w,h:i.h,rot:i.rot||0};
  if(i.type==='zone')out.push(Object.assign(b,{k:'m',type:'deploy',faction:i.faction,label:i.label}));
  else if(i.type==='arrival')out.push(Object.assign(b,{k:'m',type:'arrival',faction:i.faction,label:i.label}));
  else if(i.type==='label')out.push(Object.assign(b,{k:'m',type:'label',label:i.label}));
  else if(i.type==='objective')out.push(Object.assign(b,{k:'a',type:'medium_rect',w:6,h:4,obscuring:false,objective:true,label:i.label}));
  else if(CAT[i.type])out.push(Object.assign(b,{k:'f',type:i.type}))});return out}
function inside(a,p){const r=-a.rot*PI/180,dx=p[0]-a.x,dy=p[1]-a.y;const lx=dx*Math.cos(r)-dy*Math.sin(r),ly=dx*Math.sin(r)+dy*Math.cos(r);return Math.abs(lx)<=a.w/2&&Math.abs(ly)<=a.h/2}
function toLayout(items){const areas=[],features=[],markers=[];const A=items.filter(i=>i.k==='a');const r2=v=>Math.round(v*100)/100;
  items.forEach(i=>{const b={id:i.id,type:i.type,x:r2(i.x),y:r2(i.y),w:r2(i.w),h:r2(i.h),rot:r2(i.rot)};
    if(i.k==='a')areas.push(Object.assign(b,{obscuring:!!i.obscuring,objective:!!i.objective},i.label?{label:i.label}:{},i.ts&&i.ts!==1?{ts:i.ts}:{}));
    else if(i.k==='f'){const host=A.find(a=>inside(a,[i.x,i.y]));features.push(Object.assign(b,host?{area:host.id}:{},i.open?{open:true}:{}))}
    else{const m={id:i.id,kind:i.type,x:b.x,y:b.y,w:b.w,h:b.h,rot:b.rot};if(i.faction)m.faction=i.faction;if(i.label)m.label=i.label;if(i.ts&&i.ts!==1)m.ts=i.ts;markers.push(m)}});
  return{areas,features,markers}}

/* ---------- modèle de départ : prologue Éveillés en V11 ---------- */
function prologueV11(){const I=[];const tw=(x,y,w,r)=>I.push({k:'f',id:uid(),type:'tomb_wall',x,y,w,h:1.2,rot:r||0});
  const ar=(type,x,y,w,h,rot,o)=>I.push(Object.assign({k:'a',id:uid(),type,x,y,w,h,rot:rot||0,obscuring:true,objective:false},o||{}));
  I.push({k:'m',id:uid(),type:'deploy',x:3,y:15,w:6,h:10,rot:0,faction:'loyalistes',label:'Descente — 88e'});
  ar('custom',24,15,12,14,0,{objective:true,label:'Chambre du pylône',obscuring:false});
  ar('long_line',12,8,10,2.5);ar('long_line',12,22,10,2.5);ar('short_line',36,8,6,2);ar('short_line',36,22,6,2);
  ar('medium_rect',35,15,4,6,0,{objective:true,label:'Sarcophages'});ar('medium_rect',13,15,6,4,0,{objective:true,label:'Relevé'});
  tw(9,8,6);tw(37,8,12);tw(9,22,6);tw(37,22,12);tw(18,3,6,90);tw(30,3,6,90);tw(18,27,6,90);tw(30,27,6,90);
  tw(18,10.5,5,90);tw(18,19.5,5,90);tw(30,10.5,5,90);tw(30,19.5,5,90);tw(20,8,4);tw(28,8,4);tw(20,22,4);tw(28,22,4);tw(39,15,10,90);
  I.push({k:'f',id:uid(),type:'gate',x:30,y:15,w:4,h:1,rot:90});
  [[21.5,11.5],[26.5,11.5],[21.5,18.5],[26.5,18.5]].forEach(p=>I.push({k:'f',id:uid(),type:'pillar',x:p[0],y:p[1],w:2.4,h:2.4,rot:0}));
  I.push({k:'f',id:uid(),type:'pylon',x:24,y:15,w:5,h:5,rot:0},{k:'f',id:uid(),type:'sarco',x:34.5,y:13,w:3,h:1.4,rot:90},{k:'f',id:uid(),type:'sarco',x:34.5,y:17,w:3,h:1.4,rot:90});
  [['Réveil T1',42,15,180],['Réveil T2',24,1.6,90],['Réveil T2',24,28.4,-90],['Réveil T3',42,4,180],['Réveil T3',42,26,180]].forEach(a=>I.push({k:'m',id:uid(),type:'arrival',x:a[1],y:a[2],w:2.4,h:2,rot:a[3],faction:'necrons',label:a[0]}));
  return{id:null,name:'Prologue Éveillés — Sous la Ruche Sépulcre',edition:'V11',acte:'prologue',partie:1,location_ref:'strates-basses',set_id:'tombe-naogeth',w:44,h:30,biome:'tombe',published:false,notes:'',items:I}}
function blankMap(){return{id:null,name:'Nouvelle table',edition:'V11',acte:'1',partie:1,location_ref:'',set_id:'',w:44,h:30,biome:'ruine',published:false,notes:'',items:[]}}

/* ---------- utilitaires d'interface ---------- */
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function systemPlaces(sys){const out=[];(function w(l,d){(l||[]).forEach(e=>{out.push({id:e.id,n:('\u00a0\u00a0\u00a0'.repeat(d))+(e.nom||e.name||e.titre||e.id)});w(e.enfants,d+1)})})(sys&&sys.corps,0);return out}
const ACTE_TXT={prologue:'Prologue','1':'Acte I','2':'Acte II','3':'Acte III','4':'Acte IV'};

/* ============================================================
   ATELIER (admin)
   ============================================================ */
let ED=null;
async function mountAtelier(host,opt){
  if(!host)return;opt=opt||{};
  if(ED&&ED.host===host){ED.fit();return}
  const sb=opt.sb,sys=opt.systeme;
  host.classList.add('no-xref');
  host.innerHTML=`<div class="at">
  <div class="at-bar">
    <div class="at-title"><h2>Atelier des cartes</h2><span>Réservé au maître de campagne. Une carte non publiée reste invisible des joueurs.</span></div>
    <div class="at-tools">
      <button type="button" class="at-btn" data-mode="sel" aria-pressed="true" title="Déplacer (V)">Déplacer</button>
      <button type="button" class="at-btn" data-mode="mes" aria-pressed="false" title="Mesurer (M)">Mesurer</button>
      <button type="button" class="at-btn" data-mode="wall" aria-pressed="false" title="Tracer des murs (W)">Murs</button>
      <button type="button" class="at-btn" id="at-grid" aria-pressed="true">Grille</button>
      <button type="button" class="at-btn" id="at-tact" aria-pressed="false">Vue tactique</button>
      <button type="button" class="at-btn" id="at-posev" aria-pressed="false" title="Plan de pose coté, pour installer la table en vrai (P)">Plan de pose</button>
      <button type="button" class="at-btn" id="at-undo" title="Ctrl+Z">Annuler</button>
      <button type="button" class="at-btn" id="at-redo" title="Ctrl+Y ou Ctrl+Maj+Z">Rétablir</button>
      <button type="button" class="at-btn" id="at-needsb" aria-pressed="false" title="Ce qu'il faut imprimer, croisé avec les fichiers trouvés (B)">Besoins</button>
      <button type="button" class="at-btn" id="at-keys" title="Raccourcis clavier (?)" aria-expanded="false">?</button>
      <button type="button" class="at-btn" id="at-png">PNG</button>
      <button type="button" class="at-btn" id="at-json">JSON</button>
      <button type="button" class="at-btn" id="at-imp">Importer</button><input type="file" id="at-file" accept=".json,application/json" hidden>
    </div>
  </div>
  <div class="at-grid">
    <aside class="at-left" id="at-pal"></aside>
    <div class="at-stage" id="at-stage"><canvas id="at-cv" aria-label="Table de bataille"></canvas><div class="at-draft" id="at-draft" hidden></div><div class="at-hint" id="at-hint"></div><div class="at-keys" id="at-keyspanel" hidden></div><div class="at-needs" id="at-needs" hidden></div></div>
    <aside class="at-right">
      <div id="at-insp"></div>
      <div id="at-posebox" hidden><h3>Fiche de pose</h3><p class="at-muted">Mesures en pouces depuis les deux bords les plus proches. Bord haut = haut du plan. Clique une ligne pour n'afficher que ses cotes.</p><ol class="at-pose" id="at-pose"></ol></div>
      <h3>Carte</h3>
      <label class="at-f">Ouvrir<select id="at-list"></select></label>
      <div class="at-row2"><button type="button" class="at-btn" id="at-new">Nouvelle</button><button type="button" class="at-btn" id="at-proto">Modèle prologue</button></div>
      <label class="at-f">Nom<input id="at-name"></label>
      <div class="at-row2">
        <label class="at-f">Moment<select id="at-acte">${Object.entries(ACTE_TXT).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
        <label class="at-f">Partie<input type="number" id="at-partie" min="1" max="8"></label>
      </div>
      <label class="at-f">Lieu<select id="at-lieu"><option value="">Aucun</option>${systemPlaces(sys).map(p=>`<option value="${esc(p.id)}">${esc(p.n)}</option>`).join('')}</select></label>
      <label class="at-f">Set de décors<select id="at-set"><option value="">Aucun</option></select></label>
      <div class="at-row2">
        <label class="at-f">Largeur (″)<input type="number" id="at-w" min="12" max="120"></label>
        <label class="at-f">Profondeur (″)<input type="number" id="at-h" min="12" max="96"></label>
      </div>
      <label class="at-f">Sol<select id="at-biome"><option value="tombe">Tombe nécron</option><option value="ruine">Ruche en ruine</option><option value="boue">No man's land</option></select></label>
      <label class="at-f">Notes de MJ (jamais visibles des joueurs)<textarea id="at-notes"></textarea></label>
      <label class="at-chk"><input type="checkbox" id="at-pub"> Publiée (visible des joueurs) — décochée : brouillon</label>
      <div class="at-row2"><button type="button" class="at-btn at-main" id="at-save">Enregistrer</button><button type="button" class="at-btn" id="at-del">Supprimer</button></div>
      <p class="at-dirty" id="at-dirty" hidden>Modifications non enregistrées · copie de secours gardée dans ce navigateur</p>
      <p class="at-status" id="at-status" role="status"></p>
      <h3>Liste d'impression</h3><div id="at-print"></div>
    </aside>
  </div></div>`;
  const $=id=>host.querySelector('#'+id);
  const cv=$('at-cv'),ctx=cv.getContext('2d'),stage=$('at-stage');
  let pose=false,poseSig='',wallKind='wall',doorType='door_tomb',doorWv=null,traceThick={},trace=null,traceType='tomb_wall',tracePt=null,traceSnap=null,S=new Set(),guides=[],box=null,redoS=[],redoBak=null,CLIP=null,pasteN=0,mouseW=null,M=prologueV11(),sel=null,mode='sel',grid=true,undoS=[],view={s:10,ox:0,oy:0},DPR=1,measure=null,drag=null,dirty=false;
  const status=t=>{$('at-status').textContent=t||''};
  const visible=()=>host.offsetParent!==null;
  function fit(){const r=stage.getBoundingClientRect();if(r.width<10||r.height<10)return;DPR=window.devicePixelRatio||1;cv.width=Math.round(r.width*DPR);cv.height=Math.round(r.height*DPR);const pad=34*DPR,s=Math.max(1,Math.min((cv.width-2*pad)/M.w,(cv.height-2*pad)/M.h));view={s,ox:(cv.width-M.w*s)/2,oy:(cv.height-M.h*s)/2};draw()}
  function req(){if(!dirty){dirty=true;requestAnimationFrame(()=>{dirty=false;draw()})}}
  function corners(it){const a=it.rot*PI/180,co=Math.cos(a),si=Math.sin(a);const tf=(lx,ly)=>[it.x+lx*co-ly*si,it.y+lx*si+ly*co];return{res:tf(it.w/2,it.h/2),rot:tf(0,-it.h/2-1.4),top:tf(0,-it.h/2)}}
  /* poignées d'étirement : (sx,sy) = côté tiré, le côté opposé reste fixe */
  function handles(it){const a=it.rot*PI/180,co=Math.cos(a),si=Math.sin(a),pw=it.w*view.s/DPR,ph=it.h*view.s/DPR,H=[];
    for(const sx of[-1,0,1])for(const sy of[-1,0,1]){if(!sx&&!sy)continue;
      if(sx&&sy&&(pw<24||ph<24))continue;      // coins masqués si le décor est trop fin
      if(!sx&&pw<24)continue;
      const lx=sx*it.w/2,ly=sy*it.h/2;H.push({sx,sy,p:[it.x+lx*co-ly*si,it.y+lx*si+ly*co]})}
    return H}
  function resizeCursor(it,h){let ang=(Math.atan2(h.sy,h.sx)*180/PI+it.rot+360)%180;const c=['ew','nwse','ns','nesw'];return c[Math.round(ang/45)%4]+'-resize'}
  function handleAt(it,p){let best=null,bd=12;for(const h of handles(it)){const d=Math.hypot(h.p[0]-p[0],h.p[1]-p[1])*view.s/DPR;if(d<bd){bd=d;best=h}}return best}
  function draw(){const{s,ox,oy}=view;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
    renderMap(ctx,M,s,ox,oy,{grid,pose,poseOnly:pose?S:null,dpr:DPR,rulerColor:getComputedStyle(host).getPropertyValue('--bone-dim').trim()||'#A99C82'});if(pose)updatePose();
    const SI=selItems();
    for(const it of SI){ctx.save();ctx.setTransform(s,0,0,s,ox,oy);ctx.translate(it.x,it.y);ctx.rotate(it.rot*PI/180);ctx.setLineDash([6/s,4/s]);ctx.strokeStyle='#C2D7E3';ctx.lineWidth=1.5*DPR/s;ctx.strokeRect(-it.w/2-.15,-it.h/2-.15,it.w+.3,it.h+.3);ctx.restore()}
    if(SI.length===1){const k=corners(SI[0]);ctx.save();ctx.setTransform(1,0,0,1,0,0);const P=p=>[ox+p[0]*s,oy+p[1]*s];const t=P(k.top),r=P(k.rot);ctx.strokeStyle='#C2D7E3';ctx.lineWidth=1.5*DPR;ctx.beginPath();ctx.moveTo(t[0],t[1]);ctx.lineTo(r[0],r[1]);ctx.stroke();ctx.fillStyle='#151A1F';ctx.beginPath();ctx.arc(r[0],r[1],6*DPR,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#C2D7E3';ctx.strokeStyle='#151A1F';ctx.lineWidth=1.5*DPR;for(const hd of handles(SI[0])){const q=P(hd.p),z=(hd.sx&&hd.sy?5:4)*DPR;ctx.fillRect(q[0]-z,q[1]-z,2*z,2*z);ctx.strokeRect(q[0]-z,q[1]-z,2*z,2*z)}ctx.restore()}
    else if(SI.length>1){const g=groupBox(SI);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.strokeStyle='rgba(194,215,227,.6)';ctx.lineWidth=DPR;ctx.strokeRect(ox+g.l*s-5*DPR,oy+g.t*s-5*DPR,(g.r-g.l)*s+10*DPR,(g.b-g.t)*s+10*DPR);ctx.restore()}
    if(box){const r=rectOf(box);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='rgba(194,215,227,.08)';ctx.fillRect(ox+r.l*s,oy+r.t*s,(r.r-r.l)*s,(r.b-r.t)*s);ctx.setLineDash([5*DPR,4*DPR]);ctx.strokeStyle='#C2D7E3';ctx.lineWidth=DPR;ctx.strokeRect(ox+r.l*s,oy+r.t*s,(r.r-r.l)*s,(r.b-r.t)*s);ctx.restore()}
    if(guides.length&&drag)drawGuides(SI);
    if(mode==='wall')drawTrace();
    if(measure){const a=[ox+measure.a[0]*s,oy+measure.a[1]*s],b=[ox+measure.b[0]*s,oy+measure.b[1]*s],d=Math.hypot(measure.b[0]-measure.a[0],measure.b[1]-measure.a[1]);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.strokeStyle='rgba(8,10,10,.8)';ctx.lineWidth=5*DPR;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.strokeStyle='#E8DEC8';ctx.lineWidth=2*DPR;ctx.stroke();ctx.font=`${14*DPR}px Marcellus, Georgia, serif`;ctx.textAlign='center';ctx.textBaseline='bottom';const tx=(a[0]+b[0])/2,ty=(a[1]+b[1])/2-8*DPR,txt=d.toFixed(1).replace('.',',')+'″';ctx.lineWidth=4*DPR;ctx.strokeStyle='rgba(8,10,10,.85)';ctx.strokeText(txt,tx,ty);ctx.fillStyle='#E8DEC8';ctx.fillText(txt,tx,ty);ctx.restore()}}
  new ResizeObserver(fit).observe(stage);
  function hint(txt){$('at-hint').textContent=txt||(mode==='mes'?'Glisse sur la table pour mesurer.':mode==='wall'?(wallKind==='door'?'Survole un mur : la porte s\u2019aligne dessus et prend son épaisseur. Clic : la poser, le mur s\u2019ouvre à sa largeur.':trace?'Clique pour poser l\u2019angle suivant. Double-clic ou Entrée : finir. Retour arrière : effacer le dernier segment.':'Clique pour poser le début du mur. Angles calés à 45° (Maj : libre), Alt : sans grille. Un clic sur l\u2019extrémité d\u2019un mur s\u2019y raccroche.'):S.size>1?S.size+' éléments sélectionnés. Glisse l\u2019un d\u2019eux pour tout déplacer ; Maj+clic ajoute ou retire ; Suppr retire.':pose&&!S.size?'Plan de pose : tout est numéroté ; les zones et les décors hors zone sont cotés depuis les bords les plus proches. Clique un élément ou une ligne de la fiche pour voir ses cotes (Maj+clic pour en cumuler) ; PNG exporte le plan avec la fiche complète.':sel?'Rond : pivoter. Carrés : étirer, le côté opposé reste fixe (Ctrl : depuis le centre). Suppr : retirer.':TACT?'Vue tactique : zone pleine = Obscurcissante, pointillée = sans blocage, liseré doré = objectif ; hauteur affichée sur les décors de 3″ et plus (Tir plongeant).':'Glisse dans le vide pour sélectionner plusieurs éléments (Ctrl+glisser : depuis n\u2019importe où). Pose d\u2019abord les zones de terrain, puis les décors dessus.')}
  /* palette */
  function previewCanvas(drawFn,w,h,bg){const pc=document.createElement('canvas');pc.width=176;pc.height=112;const c=pc.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,176,112);const sc=Math.min(150/w,88/h,40);drawFn(c,sc);return pc}
  function buildPalette(){const host2=$('at-pal');host2.innerHTML='';
    const group=(title,entries)=>{if(!entries.length)return;const h=document.createElement('h3');h.textContent=title;host2.appendChild(h);const box=document.createElement('div');box.className='at-pal';host2.appendChild(box);entries.forEach(e=>{const b=document.createElement('button');b.type='button';b.title=e.title||e.n;b.appendChild(e.pc);const sp=document.createElement('span');sp.textContent=e.n;b.appendChild(sp);b.addEventListener('click',e.add);box.appendChild(b)})};
    const areaE=Object.values(KAT.areas).map(a=>{const w=a.width_in||8,h=a.depth_in||6;const it={id:'pv-'+a.id,k:'a',type:a.id,x:0,y:0,w,h,rot:0,obscuring:true};return{n:a.name+(a.width_in?` ${String(a.width_in).replace('.',',')}×${String(a.depth_in).replace('.',',')}`:''),title:a.official?'Empreinte standard GW (V11)':'Zone sur mesure',pc:previewCanvas((c,sc)=>drawOne(c,it,sc,88,56),w,h,'#1b2024'),add:()=>addItem({k:'a',type:a.id,w,h,obscuring:a.obscuring_default!==false,objective:false})}});
    group('Zones de terrain',areaE);
    const setIds=M.set_id?KAT.setItems.filter(r=>r.set_id===M.set_id).map(r=>r.type_id):[];
    const featE=d=>{const it={id:'pv-'+d.id,k:'f',type:d.id,x:0,y:0,w:+d.width_in,h:+d.depth_in,rot:0};const bg={tombe:'#26302b',ruines:'#45423c',no_mans_land:'#4a3f2d'}[d.family]||'#333';return{n:d.name,title:`${d.name} — ${String(d.width_in).replace('.',',')}×${String(d.depth_in).replace('.',',')}″, hauteur ${String(d.height_in||0).replace('.',',')}″`,pc:previewCanvas((c,sc)=>{const T=TACT;TACT=false;drawOne(c,it,sc,88,56);TACT=T},it.w,it.h,bg),add:()=>addItem({k:'f',type:d.id,w:+d.width_in,h:+d.depth_in})}};
    if(setIds.length){const st=KAT.sets.find(x=>x.id===M.set_id);group('Set · '+(st?st.name:M.set_id),setIds.map(id=>KAT.decor[id]).filter(Boolean).map(featE))}
    const doorD=Object.values(KAT.decor).filter(d=>{const c=CAT[d.render_key||d.id];return c&&c.door});group('Portes',doorD.map(featE));
    const fams={};Object.values(KAT.decor).forEach(d=>{const c=CAT[d.render_key||d.id];if(c&&c.door)return;(fams[d.family]=fams[d.family]||[]).push(d)});
    Object.keys(fams).forEach(f=>group(FAMILY_LABEL[f]||f,fams[f].map(featE)));
    group('Repères',Object.entries(MARKERS).map(([k,m])=>{const it={id:'pv-'+k,k:'m',type:k,x:0,y:0,w:m.w,h:m.h,rot:0,faction:m.fac};return{n:m.n,pc:previewCanvas((c,sc)=>{c.setTransform(sc,0,0,sc,88,56);CAT[m.draw].draw(c,it,null,sc,true);c.setTransform(1,0,0,1,0,0)},m.w,m.h,'#1b2024'),add:()=>addItem({k:'m',type:k,w:m.w,h:m.h,faction:m.fac,label:k==='label'?'Texte':''})}}))}
  /* état */
  const snapS=()=>JSON.stringify({m:M,s:[...S]});
  function pushUndo(){undoS.push(snapS());if(undoS.length>80)undoS.shift();redoBak=redoS;redoS=[]}
  function restore(p){const o=JSON.parse(p);M=o.m;S=new Set((o.s||[]).filter(id=>M.items.some(i=>i.id===id)));sel=S.size===1?[...S][0]:null;syncForm();fit();buildInsp();printList()}
  function redo(){const p=redoS.pop();if(!p){status('Rien à rétablir.');return}undoS.push(snapS());restore(p);status('')}
  function undo(){const p=undoS.pop();if(!p){status('Rien à annuler.');return}redoS.push(snapS());restore(p);status('')}
  function setSel(ids){S=new Set(ids);sel=S.size===1?[...S][0]:null;buildInsp();req()}
  function selItems(){return M.items.filter(i=>S.has(i.id))}
  function aabb(it){const a=it.rot*PI/180,co=Math.abs(Math.cos(a)),si=Math.abs(Math.sin(a)),hw=(it.w*co+it.h*si)/2,hh=(it.w*si+it.h*co)/2;return{l:it.x-hw,r:it.x+hw,t:it.y-hh,b:it.y+hh}}
  function groupBox(I){const g={l:1e9,r:-1e9,t:1e9,b:-1e9};I.forEach(i=>{const b=aabb(i);g.l=Math.min(g.l,b.l);g.r=Math.max(g.r,b.r);g.t=Math.min(g.t,b.t);g.b=Math.max(g.b,b.b)});return g}
  function rectOf(bx){return{l:Math.min(bx.a[0],bx.b[0]),r:Math.max(bx.a[0],bx.b[0]),t:Math.min(bx.a[1],bx.b[1]),b:Math.max(bx.a[1],bx.b[1])}}
  function moveBy(it,dx,dy){it.x=clamp(it.x+dx,0,M.w);it.y=clamp(it.y+dy,0,M.h)}
  function itemName(it){return it.k==='a'?(KAT.areas[it.type]||{}).name||'Zone':it.k==='f'?(KAT.decor[it.type]||{}).name||it.type:(MARKERS[it.type]||{}).n||it.type}
  const fIn=v=>String(Math.round(v*10)/10).replace('.',',')+'\u2033';
  /* relevé en direct : distances aux bords de la table et centrage */
  function readout(I){if(!I.length)return'';const g=groupBox(I),cx=(g.l+g.r)/2,cy=(g.t+g.b)/2,e=.01;
    const c=[];if(Math.abs(cx-M.w/2)<e)c.push('centré ↔');if(Math.abs(cy-M.h/2)<e)c.push('centré ↕');
    return`Bords : gauche ${fIn(g.l)} · droite ${fIn(M.w-g.r)} · haut ${fIn(g.t)} · bas ${fIn(M.h-g.b)}${c.length?' — '+c.join(', '):''}`}
  /* guides d'alignement : aimante le bloc déplacé sur les bords et centres de la table et des autres éléments */
  function guideSnap(I,st,dx,dy,free){guides=[];
    const ids=new Set(I.map(i=>i.id)),B0=groupBox(I.map(i=>Object.assign({},i,{x:st[i.id][0],y:st[i.id][1]}))),O=M.items.filter(i=>!ids.has(i.id)).map(aabb),th=free?0:8*DPR/view.s;
    const axis=(d,lo,hi,max,ax)=>{const T=[{v:0,t:'bord'},{v:max/2,t:'centre'},{v:max,t:'bord'}];O.forEach(o=>T.push({v:o[lo],o},{v:(o[lo]+o[hi])/2,o},{v:o[hi],o}));
      const R=()=>[B0[lo]+d,(B0[lo]+B0[hi])/2+d,B0[hi]+d];let best=null;
      if(th>0)for(const r of R())for(const t of T){const df=t.v-r,sc=Math.abs(df)-(t.t==='centre'?1e-3:0);if(Math.abs(df)<=th&&(!best||sc<best.sc))best={df,sc}}
      if(best)d+=best.df;const r=R();
      for(const t of T)for(let k=0;k<3;k++)if(Math.abs(t.v-r[k])<1e-3){let gd=guides.find(x=>x.ax===ax&&Math.abs(x.v-t.v)<1e-3);if(!gd){gd={ax,v:t.v,objs:[],t:null};guides.push(gd)}if(t.o)gd.objs.push(t.o);else gd.t=t.t}
      return d};
    dx=axis(dx,'l','r',M.w,'x');dy=axis(dy,'t','b',M.h,'y');return[dx,dy]}
  function drawGuides(SI){const{s,ox,oy}=view,g=groupBox(SI);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.lineWidth=1.5*DPR;ctx.font=`${11*DPR}px Marcellus, Georgia, serif`;ctx.textBaseline='bottom';
    for(const gd of guides){const tbl=!!gd.t;let a0,a1;
      if(tbl){a0=0;a1=gd.ax==='x'?M.h:M.w}else{a0=gd.ax==='x'?g.t:g.l;a1=gd.ax==='x'?g.b:g.r;gd.objs.forEach(o=>{a0=Math.min(a0,gd.ax==='x'?o.t:o.l);a1=Math.max(a1,gd.ax==='x'?o.b:o.r)})}
      ctx.strokeStyle=gd.t==='centre'?'#DDB64F':tbl?'rgba(221,182,79,.6)':'#E06CC4';ctx.setLineDash(tbl&&gd.t!=='centre'?[4*DPR,4*DPR]:[]);ctx.beginPath();
      if(gd.ax==='x'){const X=ox+gd.v*s;ctx.moveTo(X,oy+a0*s);ctx.lineTo(X,oy+a1*s)}else{const Y=oy+gd.v*s;ctx.moveTo(ox+a0*s,Y);ctx.lineTo(ox+a1*s,Y)}ctx.stroke();
      if(gd.t==='centre'){ctx.setLineDash([]);ctx.fillStyle='#DDB64F';const tx=gd.ax==='x'?'centre ↔':'centre ↕';const T=(t,x,y)=>{ctx.lineWidth=3*DPR;ctx.strokeStyle='rgba(8,10,10,.85)';ctx.strokeText(t,x,y);ctx.fillText(t,x,y)};if(gd.ax==='x'){ctx.textAlign='center';T(tx,ox+gd.v*s,oy+g.t*s-8*DPR)}else{ctx.textAlign='left';T(tx,ox+g.r*s+8*DPR,oy+gd.v*s-3*DPR)}}}
    ctx.restore()}
  function addItem(o,x,y){pushUndo();const it=Object.assign({id:uid(),x:x??M.w/2,y:y??M.h/2,rot:0},o);M.items.push(it);setSel([it.id]);printList()}
  function delSel(){if(!S.size)return;pushUndo();M.items=M.items.filter(i=>!S.has(i.id));setSel([]);printList()}
  function dupSel(){const I=selItems();if(!I.length)return;pushUndo();const C=I.map(it=>Object.assign({},it,{id:uid(),x:clamp(it.x+1,0,M.w),y:clamp(it.y+1,0,M.h)}));M.items.push(...C);setSel(C.map(c=>c.id));printList()}
  function copySel(cut){const I=selItems();if(!I.length)return;CLIP=JSON.stringify(I);pasteN=0;if(cut){delSel();status(I.length+(I.length>1?' éléments coupés.':' élément coupé.'))}else status(I.length+(I.length>1?' éléments copiés.':' élément copié.'))}
  function paste(){if(!CLIP){status('Presse-papiers vide.');return}const C=JSON.parse(CLIP);pushUndo();const g=groupBox(C);let dx,dy;
    if(mouseW){dx=mouseW[0]-(g.l+g.r)/2;dy=mouseW[1]-(g.t+g.b)/2}else{pasteN++;dx=dy=pasteN}
    const sn=v=>grid?Math.round(v*2)/2:v;dx=sn(dx);dy=sn(dy);
    C.forEach(it=>{it.id=uid();it.x=clamp(it.x+dx,0,M.w);it.y=clamp(it.y+dy,0,M.h)});M.items.push(...C);setSel(C.map(c=>c.id));printList();status(C.length+(C.length>1?' éléments collés.':' élément collé.'))}
  function rotSel(d){const I=selItems();if(!I.length)return;pushUndo();
    if(I.length===1){const it=I[0];it.rot=((it.rot+d)%360+360)%360}
    else{const g=groupBox(I),cx=(g.l+g.r)/2,cy=(g.t+g.b)/2,a=d*PI/180,co=Math.cos(a),si=Math.sin(a);I.forEach(it=>{const rx=it.x-cx,ry=it.y-cy;it.x=clamp(cx+rx*co-ry*si,0,M.w);it.y=clamp(cy+rx*si+ry*co,0,M.h);it.rot=((it.rot+d)%360+360)%360})}
    syncInsp();req()}
  /* aligner : à plusieurs, entre eux ; seul, sur la table */
  function alignSel(how){const I=selItems();if(!I.length)return;pushUndo();const g=I.length>1?groupBox(I):{l:0,r:M.w,t:0,b:M.h};
    I.forEach(it=>{const b=aabb(it);if(how==='l')moveBy(it,g.l-b.l,0);else if(how==='r')moveBy(it,g.r-b.r,0);else if(how==='cx')moveBy(it,(g.l+g.r)/2-it.x,0);else if(how==='t')moveBy(it,0,g.t-b.t);else if(how==='b')moveBy(it,0,g.b-b.b);else if(how==='cy')moveBy(it,0,(g.t+g.b)/2-it.y)});syncInsp();req()}
  function centerGroup(ax){const I=selItems();if(!I.length)return;pushUndo();const g=groupBox(I);const d=ax==='x'?M.w/2-(g.l+g.r)/2:M.h/2-(g.t+g.b)/2;I.forEach(it=>ax==='x'?moveBy(it,d,0):moveBy(it,0,d));syncInsp();req()}
  function distrib(ax){const I=selItems();if(I.length<3)return;pushUndo();const lo=ax==='x'?'l':'t',hi=ax==='x'?'r':'b';const L=I.map(it=>({it,b:aabb(it)})).sort((p,q)=>p.b[lo]-q.b[lo]);
    const span=L[L.length-1].b[hi]-L[0].b[lo],sum=L.reduce((t,p)=>t+p.b[hi]-p.b[lo],0),gap=(span-sum)/(L.length-1);let cur=L[0].b[lo];
    L.forEach(p=>{const d=cur-p.b[lo];ax==='x'?moveBy(p.it,d,0):moveBy(p.it,0,d);cur+=p.b[hi]-p.b[lo]+gap});syncInsp();req()}
  function setDoors(D,v){if(!D.length)return;pushUndo();D.forEach(d=>d.open=v);buildInsp();req();status(D.length+(D.length>1?(v?' portes ouvertes.':' portes fermées.'):(v?' porte ouverte.':' porte fermée.')))}
  function toggleDoors(){const D=selItems().filter(isDoor);if(!D.length){status('Aucune porte sélectionnée.');return}setDoors(D,!D.every(d=>d.open))}
  function reorder(front){const I=selItems();if(!I.length)return;pushUndo();const rest=M.items.filter(i=>!S.has(i.id));M.items=front?rest.concat(I):I.concat(rest);req()}
  const snap=(v,alt)=>(grid&&!alt)?Math.round(v*2)/2:Math.round(v*100)/100;
  function toWorld(e){const r=cv.getBoundingClientRect();return[((e.clientX-r.left)*DPR-view.ox)/view.s,((e.clientY-r.top)*DPR-view.oy)/view.s]}
  function hit(p){const L=sorted(M.items).reverse();for(const it of L){const a=-it.rot*PI/180,dx=p[0]-it.x,dy=p[1]-it.y;const lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a);if(Math.abs(lx)<=it.w/2+.1&&Math.abs(ly)<=it.h/2+.1)return it}return null}
  /* ---------- outil Murs : polyligne posée clic par clic ---------- */
  function wallEnds(){const E=[];M.items.forEach(i=>{if(i.k!=='f'||!LINEAR[(KAT.decor[i.type]||{}).render_key||i.type])return;const a=i.rot*PI/180,dx=Math.cos(a)*i.w/2,dy=Math.sin(a)*i.w/2;E.push([i.x-dx,i.y-dy],[i.x+dx,i.y+dy])});return E}
  function traceSnapPt(p,e){const th=10*DPR/view.s;traceSnap=null;const from=trace&&trace.pts[trace.pts.length-1];
    if(from&&trace.pts.length>2){const f=trace.pts[0];if(Math.hypot(f[0]-p[0],f[1]-p[1])<th){traceSnap='fermer';return f.slice()}}
    for(const q of wallEnds())if(Math.hypot(q[0]-p[0],q[1]-p[1])<th){traceSnap='mur';return[Math.round(q[0]*100)/100,Math.round(q[1]*100)/100]}
    if(from&&!e.shiftKey){let a=Math.atan2(p[1]-from[1],p[0]-from[0]);a=Math.round(a/(PI/4))*(PI/4);let L=Math.hypot(p[0]-from[0],p[1]-from[1])*Math.cos(Math.atan2(p[1]-from[1],p[0]-from[0])-a);L=e.altKey?Math.round(L*100)/100:Math.round(L*2)/2;
      return[clamp(Math.round((from[0]+Math.cos(a)*L)*100)/100,0,M.w),clamp(Math.round((from[1]+Math.sin(a)*L)*100)/100,0,M.h)]}
    return[clamp(snap(p[0],e.altKey),0,M.w),clamp(snap(p[1],e.altKey),0,M.h)]}
  function thickOf(t){return traceThick[t]!=null?traceThick[t]:(+(KAT.decor[t]||{}).depth_in||1)}
  function doorTypes(){return Object.values(KAT.decor).filter(d=>{const c=CAT[d.render_key||d.id];return c&&c.door})}
  function doorWidth(){return doorWv||+(KAT.decor[doorType]||{}).width_in||3}
  function placeDoor(p){const d=KAT.decor[doorType]||{},hit=wallAt(M.items,p,null,null);
    if(!hit){status('Clique sur un mur : la porte s\u2019y encastre et le mur s\u2019ouvre à sa largeur.');return}
    pushUndo();const door={k:'f',id:uid(),type:doorType,x:p[0],y:p[1],w:doorWidth(),h:+d.depth_in||1,rot:0,open:false};M.items.push(door);const f=seatDoor(M.items,door,hit);
    printList();status(`${d.name||'Porte'} encastrée : ${fIn(door.w)} de passage, mur de ${fIn(f.L1)} et ${fIn(f.L2)} de part et d\u2019autre.`);req()}
  function addWall(a,b){const L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.25)return false;pushUndo();
    M.items.push({k:'f',id:uid(),type:traceType,x:Math.round((a[0]+b[0])/2*100)/100,y:Math.round((a[1]+b[1])/2*100)/100,w:Math.round(L*100)/100,h:thickOf(traceType),rot:((Math.round(Math.atan2(b[1]-a[1],b[0]-a[0])*180/PI*100)/100)+360)%360});printList();return true}
  function endTrace(){if(!trace)return;const n=trace.pts.length-1;trace=null;tracePt=null;req();if(n>0)status(n+(n>1?' murs tracés.':' mur tracé.'));buildInsp()}
  function traceLen(){if(!trace)return 0;let t=0;for(let i=1;i<trace.pts.length;i++)t+=Math.hypot(trace.pts[i][0]-trace.pts[i-1][0],trace.pts[i][1]-trace.pts[i-1][1]);return t}
  function drawTrace(){const{s,ox,oy}=view;ctx.save();ctx.setTransform(1,0,0,1,0,0);const P=q=>[ox+q[0]*s,oy+q[1]*s],th=Math.max(2*DPR,thickOf(traceType)*s);
    if(wallKind==='door'){if(tracePt){const hit=wallAt(M.items,tracePt,null,null),r=P(tracePt);
        if(hit){const w=hit.wall,f=doorFit(w,hit.t,doorWidth());ctx.save();ctx.setTransform(s,0,0,s,ox,oy);ctx.translate(f.c[0],f.c[1]);ctx.rotate(w.rot*PI/180);ctx.fillStyle='rgba(224,108,196,.28)';ctx.fillRect(-f.dw/2,-w.h/2-.2,f.dw,w.h+.4);ctx.lineWidth=2*DPR/s;ctx.strokeStyle='#E06CC4';ctx.strokeRect(-f.dw/2,-w.h/2-.2,f.dw,w.h+.4);ctx.restore();
          const q=P(f.c),t=`porte ${fIn(f.dw)} · mur ${fIn(f.L1)} | ${fIn(f.L2)}`;ctx.font=`${12*DPR}px Marcellus, Georgia, serif`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.lineWidth=4*DPR;ctx.strokeStyle='rgba(8,10,10,.85)';ctx.strokeText(t,q[0],q[1]-(w.h*s/2+10*DPR));ctx.fillStyle='#E06CC4';ctx.fillText(t,q[0],q[1]-(w.h*s/2+10*DPR))}
        else{ctx.strokeStyle='rgba(194,215,227,.7)';ctx.lineWidth=1.5*DPR;ctx.beginPath();ctx.arc(r[0],r[1],5*DPR,0,TAU);ctx.stroke();ctx.font=`${11*DPR}px Marcellus, Georgia, serif`;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='rgba(194,215,227,.8)';ctx.fillText('aucun mur',r[0]+9*DPR,r[1])}}
      ctx.restore();return}
    const pts=trace?trace.pts.slice():[];if(trace&&tracePt)pts.push(tracePt);
    if(pts.length>1){ctx.strokeStyle='rgba(194,215,227,.35)';ctx.lineWidth=th;ctx.lineCap='square';ctx.beginPath();pts.forEach((q,i)=>{const r=P(q);i?ctx.lineTo(r[0],r[1]):ctx.moveTo(r[0],r[1])});ctx.stroke();
      ctx.strokeStyle='#C2D7E3';ctx.lineWidth=1.5*DPR;ctx.setLineDash([6*DPR,4*DPR]);ctx.stroke();ctx.setLineDash([])}
    if(trace&&tracePt){const a=trace.pts[trace.pts.length-1],L=Math.hypot(tracePt[0]-a[0],tracePt[1]-a[1]);if(L>.05){const m=P([(a[0]+tracePt[0])/2,(a[1]+tracePt[1])/2]),nx=-(tracePt[1]-a[1])/L,ny=(tracePt[0]-a[0])/L,o=th/2+14*DPR,sg=ny>0?-1:1,tx=m[0]+nx*o*sg,ty=m[1]+ny*o*sg;ctx.font=`${13*DPR}px Marcellus, Georgia, serif`;ctx.textAlign='center';ctx.textBaseline='middle';const t=fIn(L);ctx.lineWidth=4*DPR;ctx.strokeStyle='rgba(8,10,10,.85)';ctx.strokeText(t,tx,ty);ctx.fillStyle='#E8DEC8';ctx.fillText(t,tx,ty)}}
    (trace?trace.pts:[]).forEach(q=>{const r=P(q);ctx.fillStyle='#151A1F';ctx.strokeStyle='#C2D7E3';ctx.lineWidth=1.5*DPR;ctx.beginPath();ctx.arc(r[0],r[1],4*DPR,0,TAU);ctx.fill();ctx.stroke()});
    if(tracePt){const r=P(tracePt);ctx.strokeStyle=traceSnap?'#E06CC4':'#C2D7E3';ctx.lineWidth=2*DPR;ctx.beginPath();ctx.arc(r[0],r[1],(traceSnap?8:5)*DPR,0,TAU);ctx.stroke();
      if(traceSnap){ctx.font=`${11*DPR}px Marcellus, Georgia, serif`;ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#E06CC4';ctx.fillText(traceSnap==='fermer'?'fermer':'raccord',r[0]+11*DPR,r[1])}}
    ctx.restore()}
  cv.addEventListener('pointerdown',e=>{if(mode!=='wall')return;e.stopImmediatePropagation();if(wallKind==='door'){placeDoor(toWorld(e));return}const p=traceSnapPt(toWorld(e),e);
    if(!trace){trace={pts:[p]};tracePt=p;buildInsp();req();return}
    const last=trace.pts[trace.pts.length-1];if(!addWall(last,p))return;
    if(traceSnap==='fermer'){trace.pts.push(p);endTrace();return}
    trace.pts.push(p);buildInsp();hint(`Total tracé : ${fIn(traceLen())}. Double-clic ou Entrée pour finir, Retour arrière pour effacer le dernier segment.`);req()});
  cv.addEventListener('dblclick',e=>{if(mode==='wall'){e.stopImmediatePropagation();endTrace()}});
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);const p=toWorld(e);
    if(mode==='mes'){measure={a:[snap(p[0],e.altKey),snap(p[1],e.altKey)],b:p};req();return}
    const one=S.size===1?M.items.find(i=>i.id===sel):null;
    if(one){const k=corners(one),d=q=>Math.hypot(q[0]-p[0],q[1]-p[1])*view.s/DPR;if(d(k.rot)<12){pushUndo();drag={kind:'rot',it:one};return}const hd=handleAt(one,p);if(hd){pushUndo();drag={kind:'res',it:one,sx:hd.sx,sy:hd.sy,w0:one.w,h0:one.h,x0:one.x,y0:one.y};return}}
    const h=(e.ctrlKey||e.metaKey)?null:hit(p);
    if(h&&e.shiftKey){const n=new Set(S);n.has(h.id)?n.delete(h.id):n.add(h.id);setSel(n);return}
    if(h){const was=S.has(h.id)&&S.size>1;if(!S.has(h.id))setSel([h.id]);pushUndo();const st={};selItems().forEach(i=>st[i.id]=[i.x,i.y]);drag={kind:'move',it:h,p0:p,st,moved:false,was};return}
    box={a:p,b:p,base:e.shiftKey?new Set(S):new Set()};S=new Set(box.base);sel=null;req()});
  cv.addEventListener('pointerleave',()=>{mouseW=null;if(mode==='wall'&&(!trace||wallKind==='door')){tracePt=null;req()}});
  cv.addEventListener('dblclick',e=>{if(mode!=='sel')return;const h=hit(toWorld(e));if(h&&isDoor(h)){setSel([h.id]);setDoors([h],!h.open)}});
  cv.addEventListener('pointermove',e=>{if(mode==='wall'){tracePt=wallKind==='door'?toWorld(e):traceSnapPt(toWorld(e),e);req()}});
  cv.addEventListener('pointermove',e=>{if(mode==='wall')return;const p=toWorld(e);mouseW=(p[0]>=0&&p[0]<=M.w&&p[1]>=0&&p[1]<=M.h)?p:null;
    if(mode==='mes'&&measure&&e.buttons){measure.b=[snap(p[0],e.altKey),snap(p[1],e.altKey)];req();return}
    if(box){box.b=p;const r=rectOf(box);S=new Set(box.base);M.items.forEach(i=>{const b=aabb(i);if(b.l>=r.l-.01&&b.r<=r.r+.01&&b.t>=r.t-.01&&b.b<=r.b+.01)S.add(i.id)});
      hint(S.size?S.size+(S.size>1?' éléments':' élément')+' dans le cadre.':'Englobe entièrement les éléments à sélectionner.');req();return}
    if(!drag){if(!box&&mode==='sel'){const one=S.size===1?M.items.find(i=>i.id===sel):null,hd=one&&handleAt(one,p);cv.style.cursor=hd?resizeCursor(one,hd):''}return}const it=drag.it;
    if(drag.kind==='move'){const s0=drag.st[it.id];let dx=snap(s0[0]+p[0]-drag.p0[0],e.altKey)-s0[0],dy=snap(s0[1]+p[1]-drag.p0[1],e.altKey)-s0[1];
      if(!drag.moved&&Math.hypot(p[0]-drag.p0[0],p[1]-drag.p0[1])*view.s/DPR<3)return;
      const I=selItems();[dx,dy]=guideSnap(I,drag.st,dx,dy,e.altKey);
      I.forEach(i=>{i.x=clamp(drag.st[i.id][0]+dx,0,M.w);i.y=clamp(drag.st[i.id][1]+dy,0,M.h)});drag.moved=true;hint(readout(I))}
    else if(drag.kind==='rot'){let a=Math.atan2(p[1]-it.y,p[0]-it.x)*180/PI+90;a=e.shiftKey?Math.round(a):Math.round(a/15)*15;it.rot=((a%360)+360)%360}
    else{const D=drag,a=it.rot*PI/180,co=Math.cos(a),si=Math.sin(a),dx=p[0]-D.x0,dy=p[1]-D.y0,lx=dx*co+dy*si,ly=-dx*si+dy*co,mid=e.ctrlKey||e.metaKey;
      let w=D.w0,h=D.h0;
      if(D.sx)w=mid?Math.abs(lx)*2:D.sx*lx+D.w0/2;
      if(D.sy)h=mid?Math.abs(ly)*2:D.sy*ly+D.h0/2;
      if(D.sx)w=Math.max(.5,snap(w,e.altKey));if(D.sy)h=Math.max(.5,snap(h,e.altKey));
      if(e.shiftKey&&D.sx&&D.sy){const k=Math.max(.5/Math.min(D.w0,D.h0),Math.max(w/D.w0,h/D.h0));w=Math.round(D.w0*k*100)/100;h=Math.round(D.h0*k*100)/100}
      const cx=mid||!D.sx?0:D.sx*(w-D.w0)/2,cy=mid||!D.sy?0:D.sy*(h-D.h0)/2;
      it.w=w;it.h=h;it.x=D.x0+cx*co-cy*si;it.y=D.y0+cx*si+cy*co;
      hint(`Longueur ${fIn(w)} · Largeur ${fIn(h)} — Ctrl : depuis le centre · Maj : proportions · Alt : sans grille`)}
    syncInsp();req()});
  const endDrag=()=>{if(box){box=null;setSel(S);return}if(drag){const d=drag;drag=null;guides=[];if(d.kind==='move'&&!d.moved){undoS.pop();if(redoBak)redoS=redoBak;if(d.was)setSel([d.it.id])}
      else if(d.kind==='move'){const I=selItems();if(I.length===1&&isDoor(I[0])){const it=I[0],st=d.st[it.id],healed=unseatDoor(M.items,it,st[0],st[1]),hit=wallAt(M.items,[it.x,it.y],null,it);
        if(hit){seatDoor(M.items,it,hit);status('Porte encastrée dans le mur.')}else if(healed)status('Porte sortie du mur : le mur s\u2019est refermé.');printList();syncInsp()}}
      hint();req()}};
  cv.addEventListener('pointerup',endDrag);cv.addEventListener('pointercancel',endDrag);
  /* raccourcis : e.key suit la lettre imprimée, donc AZERTY et QWERTY se comportent pareil */
  const KEYS=[['Sélection',[['Clic','Sélectionner un élément'],['Glisser dans le vide','Encadrer plusieurs éléments'],['Ctrl + glisser','Encadrer depuis n\u2019importe où'],['Maj + clic','Ajouter ou retirer de la sélection'],['Ctrl + A','Tout sélectionner'],['Échap','Désélectionner, fermer cette aide']]],
    ['Édition',[['Ctrl + Z','Annuler'],['Ctrl + Y, Ctrl + Maj + Z','Rétablir'],['Ctrl + C','Copier'],['Ctrl + X','Couper'],['Ctrl + V','Coller (sous la souris si elle est sur la table)'],['Ctrl + D','Dupliquer'],['Suppr, Retour arrière','Retirer'],['Ctrl + S','Enregistrer la carte']]],
    ['Déplacer et tourner',[['Flèches','Déplacer de 0,5″'],['Maj + flèches','Déplacer de 2″'],['Alt + flèches','Déplacer de 0,1″'],['Alt pendant un glisser','Sans aimant (grille et guides)'],['Carrés de la sélection','Étirer, le côté opposé reste fixe'],['Ctrl en étirant','Étirer depuis le centre (les deux côtés)'],['Maj en étirant un coin','Garder les proportions'],['R / Maj + R','Pivoter de 90° / −90°'],['Q / E','Pivoter de −15° / 15°'],['Page préc. / Page suiv.','Mettre devant / derrière'],['O ou double-clic','Ouvrir / fermer les portes sélectionnées'],['Glisser une porte sur un mur','L\u2019y encastrer (le mur s\u2019ouvre) ; l\u2019en sortir referme le mur']]],
    ['Affichage',[['V','Outil Déplacer'],['M','Outil Mesurer'],['W','Outil Murs : clic par angle, double-clic ou Entrée pour finir, Retour arrière pour défaire'],['G','Grille'],['T','Vue tactique'],['P','Plan de pose coté (installer la table en vrai)'],['B','Besoins d\u2019impression (décors × fichiers STL)'],['?','Afficher ou masquer cette aide']]]];
  const kp=$('at-keyspanel');kp.innerHTML='<h3>Raccourcis clavier</h3>'+KEYS.map(([t,L])=>`<h4>${t}</h4><dl>${L.map(([k,d])=>`<div><dt>${k.split(', ').map(x=>x.split(' + ').map(y=>`<kbd>${y}</kbd>`).join('+')).join(' ou ')}</dt><dd>${d}</dd></div>`).join('')}</dl>`).join('');
  function keysPanel(show){show=show==null?kp.hidden:show;kp.hidden=!show;$('at-keys').setAttribute('aria-expanded',show);$('at-keys').setAttribute('aria-pressed',show)}
  document.addEventListener('keydown',e=>{if(!visible())return;const k=e.key,lk=(k||'').toLowerCase(),mod=e.ctrlKey||e.metaKey;
    if(mod&&lk==='s'){e.preventDefault();$('at-save').click();return}   // aussi depuis un champ du formulaire
    const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='textarea'||tag==='select')return;
    const I=selItems();
    if(mode==='wall'&&!mod){if(k==='Enter'||k==='Escape'){e.preventDefault();if(trace)endTrace();else if(k==='Escape')setMode('sel');return}
      if(k==='Backspace'||k==='Delete'){e.preventDefault();if(trace){if(trace.pts.length>1){undo();trace.pts.pop();buildInsp();req()}else endTrace()}return}}
    if(mod&&!e.altKey){
      if(lk==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
      if(lk==='y'){e.preventDefault();redo();return}
      if(lk==='c'){if(I.length){e.preventDefault();copySel(false)}return}
      if(lk==='x'){if(I.length){e.preventDefault();copySel(true)}return}
      if(lk==='v'){e.preventDefault();paste();return}
      if(lk==='d'){e.preventDefault();dupSel();return}
      if(lk==='a'){e.preventDefault();setSel(M.items.map(i=>i.id));return}
      return}
    if(k==='?'){e.preventDefault();keysPanel();return}
    if(k==='Escape'){if(!$('at-needs').hidden){needsPanel(false);return}if(!kp.hidden){keysPanel(false);return}measure=null;setSel([]);return}
    if(lk==='v'){setMode('sel');return}if(lk==='m'){setMode('mes');return}if(lk==='w'){setMode('wall');return}
    if(lk==='g'){$('at-grid').click();return}if(lk==='p'){$('at-posev').click();return}if(lk==='b'){$('at-needsb').click();return}if(lk==='t'){$('at-tact').click();return}
    if(!I.length)return;
    if(k==='Delete'||k==='Backspace'){e.preventDefault();delSel();return}
    if(lk==='o'){toggleDoors();return}
    if(k==='PageUp'){e.preventDefault();reorder(true);return}if(k==='PageDown'){e.preventDefault();reorder(false);return}
    if(k==='r')rotSel(90);else if(k==='R')rotSel(-90);else if(lk==='q')rotSel(-15);else if(lk==='e')rotSel(15);
    else if(k.indexOf('Arrow')===0){e.preventDefault();pushUndo();const st=e.altKey?.1:e.shiftKey?2:.5;I.forEach(i=>moveBy(i,k==='ArrowLeft'?-st:k==='ArrowRight'?st:0,k==='ArrowUp'?-st:k==='ArrowDown'?st:0));syncInsp();hint(readout(I));req()}});
  function setMode(m){if(mode==='wall'&&m!=='wall')endTrace();mode=m;stage.classList.toggle('is-wall',m==='wall');if(m==='wall'){setSel([])}else buildInsp();host.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===m));stage.classList.toggle('is-measure',m==='mes');if(m!=='mes')measure=null;hint();req()}
  host.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $('at-grid').onclick=()=>{grid=!grid;$('at-grid').setAttribute('aria-pressed',grid);req()};
  $('at-tact').onclick=()=>{TACT=!TACT;$('at-tact').setAttribute('aria-pressed',TACT);hint();req()};
  $('at-posev').onclick=()=>{pose=!pose;$('at-posev').setAttribute('aria-pressed',pose);$('at-posebox').hidden=!pose;poseSig='';hint();req()};
  function updatePose(){const E=poseEntries(M),rows=E.map(poseText),sig=JSON.stringify(rows)+'|'+[...S].join(',');if(sig===poseSig)return;poseSig=sig;
    $('at-pose').innerHTML=rows.length?rows.map((r,i)=>`<li data-id="${E[i].it.id}"${S.has(E[i].it.id)?' class="is-sel"':''}><b>${esc(r.num)}</b><span><strong>${esc(r.name)}</strong> · ${esc(r.dims)}<br>${esc(r.line)}</span></li>`).join(''):'<li class="at-muted">Rien à poser.</li>'}
  $('at-pose').onclick=e=>{const li=e.target.closest('li[data-id]');if(li)setSel([li.dataset.id])};
  $('at-undo').onclick=undo;$('at-redo').onclick=redo;$('at-keys').onclick=()=>keysPanel();
  /* inspecteur */
  function el(tag,attrs,kids){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='text')n.textContent=v;else n.setAttribute(k,v)}(kids||[]).forEach(k=>n.appendChild(k));return n}
  const B=(t,fn,ti)=>{const b=el('button',{type:'button',class:'at-btn',text:t});if(ti)b.title=ti;b.onclick=fn;return b};
  const cap=t=>el('p',{class:'at-cap',text:t});
  function tsCtl(items){const v=Math.round((+items[0].ts||1)*100),out=el('b',{text:v+' %'}),r=el('input',{type:'range',min:'50',max:'250',step:'10'});r.value=v;
    r.addEventListener('pointerdown',pushUndo);r.addEventListener('keydown',pushUndo);r.addEventListener('input',()=>{const f=+r.value/100;items.forEach(i=>i.ts=f);out.textContent=r.value+' %';req()});
    return el('label',{class:'at-f at-range'},[document.createTextNode('Taille du texte '),out,r])}
  function buildMulti(h){const I=selItems();h.appendChild(el('h3',{text:I.length+' éléments'}));
    const cnt={};I.forEach(i=>{const n=itemName(i);cnt[n]=(cnt[n]||0)+1});h.appendChild(el('p',{class:'at-muted',text:Object.entries(cnt).map(([n,c])=>c+' × '+n).join(', ')}));
    h.appendChild(cap('Aligner entre eux'));
    h.appendChild(el('div',{class:'at-row3'},[B('Gauche',()=>alignSel('l')),B('Centre ↔',()=>alignSel('cx')),B('Droite',()=>alignSel('r'))]));
    h.appendChild(el('div',{class:'at-row3'},[B('Haut',()=>alignSel('t')),B('Milieu ↕',()=>alignSel('cy')),B('Bas',()=>alignSel('b'))]));
    if(I.length>=3)h.appendChild(el('div',{class:'at-row2'},[B('Espacer ↔',()=>distrib('x'),'Écarts égaux à l\u2019horizontale'),B('Espacer ↕',()=>distrib('y'),'Écarts égaux à la verticale')]));
    h.appendChild(cap('Le groupe sur la table'));
    h.appendChild(el('div',{class:'at-row2'},[B('Centrer ↔',()=>centerGroup('x')),B('Centrer ↕',()=>centerGroup('y'))]));
    h.appendChild(el('div',{class:'at-row2'},[B('↺ 90°',()=>rotSel(-90)),B('↻ 90°',()=>rotSel(90))]));
    if(I.every(i=>i.k==='a')){const chk=(lab,key)=>{const i=el('input',{type:'checkbox'});i.checked=I.every(a=>a[key]);i.indeterminate=!i.checked&&I.some(a=>a[key]);i.addEventListener('change',()=>{pushUndo();I.forEach(a=>a[key]=i.checked);req()});return el('label',{class:'at-chk'},[i,document.createTextNode(' '+lab)])};h.appendChild(chk('Obscurcissantes','obscuring'));h.appendChild(chk('Objectifs (zones à contrôler)','objective'))}
    const D=I.filter(isDoor);if(D.length){h.appendChild(cap(D.length+(D.length>1?' portes':' porte')));h.appendChild(el('div',{class:'at-row2'},[B('Tout ouvrir',()=>setDoors(D,true)),B('Tout fermer',()=>setDoors(D,false))]))}
    const T=I.filter(i=>i.k!=='f');if(T.length)h.appendChild(tsCtl(T));
    h.appendChild(el('div',{class:'at-acts'},[B('Dupliquer',dupSel),B('Devant',()=>reorder(true)),B('Derrière',()=>reorder(false)),B('Retirer',delSel)]))}
  function buildWall(h){h.appendChild(el('h3',{text:wallKind==='door'?'Poser des portes':'Tracer des murs'}));
    const kb=(t,k)=>{const b=B(t,()=>{if(wallKind===k)return;if(trace)endTrace();wallKind=k;tracePt=null;buildInsp();req()});b.setAttribute('aria-pressed',wallKind===k);return b};
    h.appendChild(el('div',{class:'at-row2'},[kb('Murs','wall'),kb('Portes','door')]));
    if(wallKind==='door'){const D=doorTypes();if(!D.find(d=>d.id===doorType)&&D[0])doorType=D[0].id;
      const sl=el('select',{});D.forEach(d=>{const o=el('option',{value:d.id,text:`${d.name} — ${String(d.width_in).replace('.',',')}″`});if(d.id===doorType)o.selected=true;sl.appendChild(o)});
      sl.addEventListener('change',()=>{doorType=sl.value;doorWv=null;buildInsp();req()});h.appendChild(el('label',{class:'at-f'},[document.createTextNode('Type de porte'),sl]));
      const wi=el('input',{type:'number',step:'0.5',min:'0.5',max:'24'});wi.value=doorWidth();wi.addEventListener('input',()=>{const v=parseFloat(String(wi.value).replace(',','.'));if(v>0){doorWv=v;req()}});
      h.appendChild(el('label',{class:'at-f'},[document.createTextNode('Largeur de la porte (″)'),wi]));
      h.appendChild(el('p',{class:'at-muted',text:'Clique sur un mur déjà posé : la porte prend son axe et son épaisseur, et le mur est coupé à sa largeur. Tu peux aussi glisser une porte de la palette sur un mur avec l’outil Déplacer ; la ressortir du mur le referme.'}));
      h.appendChild(el('div',{class:'at-acts'},[B('Terminer',()=>setMode('sel'))]));return}
    const types=Object.values(KAT.decor).filter(d=>LINEAR[d.render_key||d.id]);if(!types.find(d=>d.id===traceType)&&types[0])traceType=types[0].id;
    const sl=el('select',{});types.forEach(d=>{const o=el('option',{value:d.id,text:d.name});if(d.id===traceType)o.selected=true;sl.appendChild(o)});
    sl.addEventListener('change',()=>{traceType=sl.value;buildInsp();req()});h.appendChild(el('label',{class:'at-f'},[document.createTextNode('Type de mur'),sl]));
    const def=+(KAT.decor[traceType]||{}).depth_in||1,th=el('input',{type:'number',step:'0.1',min:'0.2',max:'6'});th.value=thickOf(traceType);
    th.addEventListener('input',()=>{const v=parseFloat(String(th.value).replace(',','.'));if(v>=.2){traceThick[traceType]=v;req()}});
    const rb=B('Par défaut',()=>{delete traceThick[traceType];buildInsp();req()},`Épaisseur du catalogue : ${String(def).replace('.',',')}″`);
    h.appendChild(el('div',{class:'at-thick'},[el('label',{class:'at-f'},[document.createTextNode(`Épaisseur (″) — catalogue ${String(def).replace('.',',')}″`),th]),rb]));
    const mi=el('input',{});mi.value=(modulesFor(traceType)||[]).join(', ').replace(/\./g,',').replace(/, /g,' ; ');
    const bm=B('Enregistrer',async()=>{const v=mi.value.split(/[;\s]+/).map(x=>parseFloat(x.replace(',','.'))).filter(x=>x>0).sort((a,b)=>b-a);if(!v.length){status('Indique au moins une longueur.');return}
      const d=KAT.decor[traceType];d.defaults=Object.assign({},d.defaults||{},{modules:v});printList();
      if(!sb){status('Longueurs appliquées (non enregistrées : Supabase indisponible).');return}
      const{error}=await sb.from('decor_types').update({defaults:d.defaults}).eq('id',traceType);status(error?'Longueurs appliquées ici, mais pas enregistrées : '+error.message:'Longueurs imprimables enregistrées pour « '+d.name+' ».')});
    h.appendChild(el('label',{class:'at-f'},[document.createTextNode('Longueurs imprimables (″), séparées par ;'),mi]));h.appendChild(el('div',{class:'at-row2'},[bm,B('Terminer le tracé',()=>{endTrace();setMode('sel')})]));
    h.appendChild(el('p',{class:'at-muted',text:trace?`Tracé en cours : ${trace.pts.length-1} segment(s), ${fIn(traceLen())}.`:'Clique sur la table pour commencer. Chaque segment devient un décor, découpé en modules dans la liste d’impression. L’épaisseur choisie vaut pour les prochains segments ; pour un mur déjà posé, change sa Largeur.'}))}
  function buildInsp(){const h=$('at-insp');h.innerHTML='';hint();if(mode==='wall'){buildWall(h);return}if(S.size>1){buildMulti(h);return}const it=M.items.find(i=>i.id===sel);
    if(!it){h.appendChild(el('h3',{text:'Sélection'}));h.appendChild(el('p',{class:'at-muted',text:'Clique sur un élément pour le régler, ou glisse dans le vide pour en encadrer plusieurs.'}));return}
    const name=itemName(it);
    h.appendChild(el('h3',{text:name}));
    if(it.k==='f'){const d=KAT.decor[it.type]||{};h.appendChild(el('p',{class:'at-muted',text:`Hauteur ${String(d.height_in||0).replace('.',',')}″${+d.height_in>=3&&!isDoor(it)?' : Tir plongeant possible depuis ce décor.':''}`}))}
    if(isDoor(it)){const i=el('input',{type:'checkbox'});i.checked=!!it.open;const lab=el('p',{class:'at-muted',text:''});const txt=()=>{lab.textContent=it.open?'Ouverte : ne bloque pas la ligne de vue.':'Fermée : bloque la ligne de vue.'};txt();i.addEventListener('change',()=>{pushUndo();it.open=i.checked;txt();req()});h.appendChild(el('label',{class:'at-chk'},[i,document.createTextNode(' Ouverte (touche O)')]));h.appendChild(lab)}
    const num=(lab,key,step,min)=>{const i=el('input',{type:'number',step:String(step),min:String(min??0),'data-k':key});i.value=Math.round(it[key]*100)/100;i.addEventListener('focus',pushUndo);i.addEventListener('input',()=>{const v=parseFloat(i.value);if(!isNaN(v)){it[key]=key==='rot'?((v%360)+360)%360:Math.max(min??0,v);req()}});return el('label',{class:'at-f'},[document.createTextNode(lab),i])};
    h.appendChild(el('div',{class:'at-row3'},[num('X','x',.5),num('Y','y',.5),num('Angle','rot',15)]));
    h.appendChild(el('div',{class:'at-row2'},[num('Longueur','w',.5,.5),num('Largeur','h',.5,.5)]));
    h.appendChild(cap('Sur la table'));h.appendChild(el('div',{class:'at-row2'},[B('Centrer ↔',()=>alignSel('cx')),B('Centrer ↕',()=>alignSel('cy'))]));
    if(it.k==='a'){const chk=(lab,key)=>{const i=el('input',{type:'checkbox'});i.checked=!!it[key];i.addEventListener('change',()=>{pushUndo();it[key]=i.checked;req()});return el('label',{class:'at-chk'},[i,document.createTextNode(' '+lab)])};h.appendChild(chk('Obscurcissante','obscuring'));h.appendChild(chk('Objectif (zone à contrôler)','objective'))}
    if(it.k==='a'||it.k==='m'){const i=el('input',{});i.value=it.label||'';i.addEventListener('focus',pushUndo);i.addEventListener('input',()=>{it.label=i.value;req()});h.appendChild(el('label',{class:'at-f'},[document.createTextNode('Libellé'),i]));h.appendChild(tsCtl([it]))}
    if(it.k==='m'&&it.type!=='label'){const s=el('select',{});Object.entries(FACTIONS).forEach(([k,f])=>{const o=el('option',{value:k,text:f.n});if(k===it.faction)o.selected=true;s.appendChild(o)});s.addEventListener('change',()=>{pushUndo();it.faction=s.value;req()});h.appendChild(el('label',{class:'at-f'},[document.createTextNode('Faction'),s]))}
    const bD=el('button',{type:'button',class:'at-btn',text:'Dupliquer'}),bF=el('button',{type:'button',class:'at-btn',text:'Devant'}),bB=el('button',{type:'button',class:'at-btn',text:'Derrière'}),bX=el('button',{type:'button',class:'at-btn',text:'Retirer'});
    bD.onclick=dupSel;bX.onclick=delSel;bF.onclick=()=>{pushUndo();M.items=M.items.filter(i=>i!==it).concat([it]);req()};bB.onclick=()=>{pushUndo();M.items=[it].concat(M.items.filter(i=>i!==it));req()};
    h.appendChild(el('div',{class:'at-acts'},[bD,bF,bB,bX]))}
  function syncInsp(){const it=M.items.find(i=>i.id===sel);if(!it)return;host.querySelectorAll('#at-insp input[data-k]').forEach(i=>{if(document.activeElement!==i)i.value=Math.round(it[i.dataset.k]*100)/100})}
  /* formulaire de la carte */
  function syncForm(){$('at-name').value=M.name;$('at-acte').value=M.acte;$('at-partie').value=M.partie||'';$('at-lieu').value=M.location_ref||'';$('at-set').value=M.set_id||'';$('at-w').value=M.w;$('at-h').value=M.h;$('at-biome').value=M.biome;$('at-notes').value=M.notes||'';$('at-pub').checked=!!M.published;$('at-del').disabled=!M.id}
  $('at-name').oninput=e=>{M.name=e.target.value};$('at-acte').onchange=e=>{M.acte=e.target.value};$('at-partie').oninput=e=>{M.partie=parseInt(e.target.value)||null};
  $('at-lieu').onchange=e=>{M.location_ref=e.target.value};$('at-set').onchange=e=>{M.set_id=e.target.value;buildPalette()};
  $('at-biome').onchange=e=>{pushUndo();M.biome=e.target.value;req()};$('at-notes').oninput=e=>{M.notes=e.target.value};$('at-pub').onchange=e=>{M.published=e.target.checked};
  const resize=()=>{pushUndo();M.w=clamp(parseInt($('at-w').value)||44,12,120);M.h=clamp(parseInt($('at-h').value)||30,12,96);M.items.forEach(i=>{i.x=clamp(i.x,0,M.w);i.y=clamp(i.y,0,M.h)});fit()};
  $('at-w').onchange=resize;$('at-h').onchange=resize;
  function loadInto(m,o){M=m;S=new Set();sel=null;guides=[];box=null;measure=null;undoS=[];redoS=[];syncForm();buildPalette();buildInsp();fit();printList();clean=o&&o.dirty?'':ser();lastDraft='';paintDirty(!!(o&&o.dirty))}
  /* ---------- sauvegarde de secours : copie locale de la carte en cours ----------
     Toutes les 1,5 s, si la carte diffère de sa dernière version enregistrée dans Supabase,
     elle est copiée dans le localStorage de ce navigateur. Au retour dans l'Atelier,
     un bandeau propose de la reprendre. La copie est effacée après un enregistrement réussi. */
  const DKEY='cytherea-atelier-brouillon';
  let clean='',lastDraft='',dirtyShown=null;
  function ser(){return JSON.stringify(M)}
  function isDirty(){return ser()!==clean}
  function paintDirty(d){if(d===dirtyShown)return;dirtyShown=d;const b=$('at-save');b.textContent=d?'Enregistrer •':'Enregistrer';b.title=d?'Modifications non enregistrées (Ctrl+S)':'Ctrl+S';$('at-dirty').hidden=!d}
  function readDraft(){try{const t=localStorage.getItem(DKEY);return t?JSON.parse(t):null}catch(e){return null}}
  function dropDraft(){try{localStorage.removeItem(DKEY)}catch(e){}lastDraft=''}
  function autosave(){if(!M)return;const t=ser(),d=t!==clean;paintDirty(d);
    if(d&&t!==lastDraft){try{localStorage.setItem(DKEY,JSON.stringify({at:Date.now(),map:M}));lastDraft=t}catch(e){}}
    else if(!d&&lastDraft)dropDraft()}
  setInterval(autosave,1500);
  window.addEventListener('pagehide',autosave);document.addEventListener('visibilitychange',autosave);
  window.addEventListener('beforeunload',e=>{if(M&&isDirty()){autosave();e.preventDefault();e.returnValue=''}});
  function guard(){return!isDirty()||confirm('La carte « '+(M.name||'Sans titre')+' » a des modifications non enregistrées. Les abandonner ?')}
  function offerDraft(D){const bx=$('at-draft');if(!D||!D.map||!Array.isArray(D.map.items)){bx.hidden=true;return}
    const when=new Date(D.at).toLocaleString('fr-BE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(' ',' à ');
    bx.innerHTML='';bx.appendChild(el('p',{text:`Carte non enregistrée retrouvée : « ${D.map.name||'Sans titre'} », ${D.map.items.length} éléments, modifiée le ${when}.`}));
    const bR=el('button',{type:'button',class:'at-btn at-main',text:'Reprendre'}),bI=el('button',{type:'button',class:'at-btn',text:'Ignorer'});
    bR.onclick=()=>{if(!guard())return;bx.hidden=true;loadInto(D.map,{dirty:true});if(D.map.id)$('at-list').value=D.map.id;autosave();status('Brouillon repris. Enregistre-le pour le garder dans Supabase.')};
    bI.onclick=()=>{if(!confirm('Effacer définitivement cette copie de secours ?'))return;bx.hidden=true;const cur=readDraft();if(cur&&cur.at===D.at)dropDraft();status('Copie de secours effacée.')};
    bx.appendChild(el('div',{class:'at-acts'},[bR,bI]));bx.hidden=false}
  $('at-new').onclick=()=>{if(guard())loadInto(blankMap())};$('at-proto').onclick=()=>{if(guard())loadInto(prologueV11())};
  /* Supabase : liste, ouverture, enregistrement */
  async function refreshList(selId){const s=$('at-list');s.innerHTML='<option value="">Choisir une carte…</option>';if(!sb)return;
    const{data,error}=await sb.from('battle_maps').select('id,name,acte,partie,published').order('updated_at',{ascending:false});
    if(error){status('Lecture des cartes impossible : '+error.message);return}
    (data||[]).forEach(m=>{const o=el('option',{value:m.id,text:`${m.published?'● ':'○ brouillon · '}${m.name} — ${ACTE_TXT[m.acte]||m.acte}${m.partie?' · '+m.partie:''}`});s.appendChild(o)});if(selId)s.value=selId}
  $('at-list').onchange=async e=>{const id=e.target.value;if(!id||!sb)return;if(!guard()){e.target.value=M.id||'';return}status('Ouverture…');
    const{data,error}=await sb.from('battle_maps').select('*').eq('id',id).single();if(error){status('Ouverture impossible : '+error.message);return}
    const n=await sb.from('battle_map_notes').select('notes').eq('map_id',id).maybeSingle();
    loadInto({id:data.id,name:data.name,edition:data.edition,acte:data.acte,partie:data.partie,location_ref:data.location_ref||'',set_id:data.set_id||'',w:+data.width_in,h:+data.depth_in,biome:data.biome,published:data.published,notes:(n.data&&n.data.notes)||'',items:toItems(data.layout)});status('Carte ouverte.')};
  $('at-save').onclick=async()=>{if(!sb){status('Supabase indisponible : exporte en JSON.');return}status('Enregistrement…');
    const row={name:M.name||'Sans titre',edition:'V11',acte:M.acte,partie:M.partie||null,location_ref:M.location_ref||null,set_id:M.set_id||null,width_in:M.w,depth_in:M.h,biome:M.biome,layout:toLayout(M.items),published:!!M.published,updated_at:new Date().toISOString()};
    const q=M.id?sb.from('battle_maps').update(row).eq('id',M.id).select('id').single():sb.from('battle_maps').insert(row).select('id').single();
    const{data,error}=await q;if(error){status('Enregistrement refusé : '+error.message);return}M.id=data.id;
    const n=await sb.from('battle_map_notes').upsert({map_id:M.id,notes:M.notes||''});
    await refreshList(M.id);syncForm();clean=ser();dropDraft();paintDirty(false);$('at-draft').hidden=true;status(n.error?'Carte enregistrée, mais pas les notes : '+n.error.message:(M.published?'Carte enregistrée et publiée.':'Brouillon enregistré dans Supabase (invisible des joueurs).'))};
  $('at-del').onclick=async()=>{if(!M.id||!sb)return;if(!confirm('Supprimer définitivement la carte « '+M.name+' » ?'))return;const{error}=await sb.from('battle_maps').delete().eq('id',M.id);if(error){status('Suppression impossible : '+error.message);return}loadInto(blankMap());refreshList();status('Carte supprimée.')};
  /* liste d'impression */
  const STAT={a_evaluer:'à évaluer',retenu:'retenu',a_imprimer:'à imprimer',imprime:'imprimé',peint:'peint',ecarte:'écarté'};
  function printList(){const h=$('at-print');const F=M.items.filter(i=>i.k==='f');if(!F.length){h.innerHTML='<p class="at-muted">Aucun décor posé.</p>';return}
    const by={};F.forEach(i=>(by[i.type]=by[i.type]||[]).push(i));
    const src=k=>{const L=KAT.stl.filter(s=>s.type_id===k&&s.status!=='ecarte');const b=L.find(s=>['peint','imprime','a_imprimer','retenu'].includes(s.status))||L[0];return b?esc((b.author?b.author+' — ':'')+b.title)+' · '+STAT[b.status]:'aucune source'};
    const n=v=>String(Math.round(v*100)/100).replace('.',',')+'\u2033';
    h.innerHTML='<ul class="at-print">'+Object.keys(by).sort().map(k=>{const d=KAT.decor[k]||{},I=by[k],mods=modulesFor(k);
      if(!mods)return`<li><b>${I.length} × ${esc(d.name||k)}</b><span>${src(k)}</span></li>`;
      const cnt={},rest=[];let tot=0;I.forEach(i=>{tot+=i.w;const r=decompose(i.w,mods);for(const[m,c]of Object.entries(r.cnt))cnt[m]=(cnt[m]||0)+c;if(r.rest)rest.push(r.rest)});
      const parts=Object.keys(cnt).map(Number).sort((a,b)=>b-a).map(m=>`${cnt[m]} × ${n(m)}`);
      const rs=rest.length?`<em>sur mesure : ${rest.sort((a,b)=>b-a).map(n).join(', ')}</em>`:'';
      return`<li><b>${esc(d.name||k)} — ${n(tot)} au total</b><span class="at-mods">${parts.join(' · ')||'—'}${rs?'<br>'+rs:''}</span><span>${src(k)}</span></li>`}).join('')+'</ul><button type="button" class="at-btn" data-needs>Voir les besoins et les fichiers</button>';h.querySelector('[data-needs]').onclick=()=>needsPanel(true);renderNeeds()}
  /* ---------- panneau Besoins ---------- */
  let NEED={scope:'all',cat:false,maps:null};
  async function loadMaps(){if(!sb){NEED.maps=[];return}try{const{data}=await sb.from('battle_maps').select('id,name,layout');NEED.maps=(data||[]).filter(m=>m.id!==M.id).map(m=>({name:m.name,need:needsOf(toItems(m.layout))}))}catch(e){NEED.maps=[]}}
  function needsPanel(show){const P=$('at-needs');show=show==null?P.hidden:show;P.hidden=!show;$('at-needsb').setAttribute('aria-pressed',show);if(show){NEED.maps=null;renderNeeds();loadMaps().then(renderNeeds)}}
  $('at-needsb').onclick=()=>needsPanel();
  function renderNeeds(){const P=$('at-needs');if(P.hidden)return;const nm=v=>String(Math.round(v*100)/100).replace('.',',')+'″';
    const cur=needsOf(M.items),all=needsMax([{name:M.name||'carte ouverte',need:cur}].concat(NEED.maps||[])),use=NEED.scope==='all'?all:cur;
    const types=Object.keys(NEED.cat?KAT.decor:use).filter(t=>KAT.decor[t]).sort((a,b)=>{const ca=coverage(a).key==='none'?0:1,cb=coverage(b).key==='none'?0:1;return(ca-cb)||String(KAT.decor[a].name).localeCompare(KAT.decor[b].name)});
    const used=Object.keys(use),miss=used.filter(t=>coverage(t).key==='none').length,done=used.filter(t=>['imprime','peint'].includes(coverage(t).key)).length,kept=used.filter(t=>['retenu','a_imprimer'].includes(coverage(t).key)).length;
    const nMaps=(NEED.maps?NEED.maps.length:0)+1;
    const pieces=t=>{const o=use[t];if(!o)return'<span class="at-muted">pas sur la carte</span>';const mods=modulesFor(t);
      if(!mods)return`<b>${o.n}</b> ×`;const parts=Object.keys(o.mods).map(Number).sort((a,b)=>b-a).map(m=>`${o.mods[m]} × ${nm(m)}`);
      return`${parts.join(' · ')||'—'}${o.rest.length?`<br><em>sur mesure : ${o.rest.sort((a,b)=>b-a).map(nm).join(', ')}</em>`:''}<br><span class="at-muted">${nm(o.len)} au total</span>`};
    const srcs=t=>{const L=KAT.stl.filter(x=>x.type_id===t);if(!L.length)return'<span class="at-need-none">Aucun fichier trouvé : à chercher</span>';
      return L.map(x=>`<div class="at-src${x.status==='ecarte'?' is-off':''}"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>${x.author?' <span>— '+esc(x.author)+'</span>':''}
        <div class="at-src-m"><select data-sid="${esc(x.id||'')}" aria-label="Statut">${Object.entries(STAT).map(([k,v])=>`<option value="${k}"${k===x.status?' selected':''}>${v}</option>`).join('')}</select><span>${esc(x.license||'')}${x.quantity?' · prévu ×'+x.quantity:''}</span></div>
        ${x.print_notes?`<p>${esc(x.print_notes)}</p>`:''}</div>`).join('')};
    P.innerHTML=`<div class="at-needs-h"><h3>Besoins d'impression</h3><button type="button" class="at-btn" data-close>Fermer</button></div>
      <div class="at-row2 at-needs-scope"><button type="button" class="at-btn" data-scope="cur" aria-pressed="${NEED.scope==='cur'}">Cette carte</button><button type="button" class="at-btn" data-scope="all" aria-pressed="${NEED.scope==='all'}">Toutes les cartes${NEED.maps?' ('+nMaps+')':' …'}</button></div>
      <label class="at-chk"><input type="checkbox" data-cat${NEED.cat?' checked':''}> Afficher aussi les décors du catalogue non utilisés</label>
      <p class="at-muted">${NEED.scope==='all'?'Les décors resservent d’une partie à l’autre : pour chaque décor, on retient le plus grand besoin d’une seule carte (carte ouverte comprise, même non enregistrée).':'Besoins de la carte ouverte uniquement.'} Les murs sont découpés selon les longueurs imprimables réglées dans l’outil Murs.</p>
      <p class="at-needs-sum"><b>${used.length}</b> types de décor utilisés · <span class="at-need-none">${miss} sans fichier</span> · ${kept} retenus ou à imprimer · ${done} imprimés ou peints</p>
      <table class="at-needs-t"><thead><tr><th>Décor</th><th>À imprimer</th><th>Fichiers trouvés et statut</th></tr></thead><tbody>${types.map(t=>{const d=KAT.decor[t],cv=coverage(t),o=use[t];
        return`<tr><td><b>${esc(d.name)}</b><br><span class="at-cov at-cov-${cv.key}">${cv.txt}</span>${NEED.scope==='all'&&o&&o.by?`<br><span class="at-muted">max : ${esc(o.by)}</span>`:''}</td><td>${pieces(t)}</td><td>${srcs(t)}</td></tr>`}).join('')||'<tr><td colspan="3" class="at-muted">Aucun décor posé.</td></tr>'}</tbody></table>`;
    P.querySelector('[data-close]').onclick=()=>needsPanel(false);
    P.querySelectorAll('[data-scope]').forEach(b=>b.onclick=()=>{NEED.scope=b.dataset.scope;renderNeeds()});
    P.querySelector('[data-cat]').onchange=e=>{NEED.cat=e.target.checked;renderNeeds()};
    P.querySelectorAll('select[data-sid]').forEach(sl=>sl.onchange=async()=>{const x=KAT.stl.find(y=>String(y.id)===sl.dataset.sid);if(!x)return;const old=x.status;x.status=sl.value;printList();
      if(!sb||!x.id){status('Statut changé ici, mais pas enregistré (Supabase indisponible).');renderNeeds();return}
      const{error}=await sb.from('stl_sources').update({status:sl.value}).eq('id',x.id);if(error){x.status=old;status('Statut non enregistré : '+error.message)}else status('« '+x.title+' » : '+STAT[x.status]+'.');renderNeeds()})}
  /* export / import */
  function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
  $('at-json').onclick=()=>{const out={name:M.name,edition:'V11',acte:M.acte,partie:M.partie,location_ref:M.location_ref,set_id:M.set_id,width_in:M.w,depth_in:M.h,biome:M.biome,layout:toLayout(M.items)};download(slug(M.name)+'.json',new Blob([JSON.stringify(out,null,2)],{type:'application/json'}))};
  $('at-imp').onclick=()=>$('at-file').click();
  $('at-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(!guard()){e.target.value='';return}try{const t=JSON.parse(await f.text());
      const items=toItems(t.layout||t.items||t);if(!items.length)throw 0;
      loadInto({id:null,name:t.name||'Table importée',edition:'V11',acte:t.acte||'1',partie:t.partie||1,location_ref:t.location_ref||'',set_id:t.set_id||'',w:+(t.width_in||t.w||44),h:+(t.depth_in||t.h||30),biome:t.biome||'ruine',published:false,notes:t.notes||'',items});status('Table importée : enregistre-la pour la garder.')}catch(err){status('Ce fichier n\u2019est pas une table valide.')}e.target.value=''};
  function poseSheet(){const s=24,Mg=1.8*s,E=poseEntries(M),rows=E.map(poseText),fs=s*.52,lh=fs*1.4,W=Math.round(M.w*s+2*Mg),cols=W>=1400?2:1,colW=(W-2*Mg-(cols-1)*s)/cols,per=Math.ceil(rows.length/cols),eh=2*lh+fs*.5;
    const head=3.2*s,legH=s*1.4+per*eh;const c=document.createElement('canvas');c.width=W;c.height=Math.round(Mg+M.h*s+Mg*.9+head+legH+Mg*.6);const g=c.getContext('2d');g.fillStyle='#0A0C0E';g.fillRect(0,0,c.width,c.height);
    renderMap(g,M,s,Mg,Mg,{dpr:2,pose:true,rulerColor:'#A99C82'});let y=Mg+M.h*s+Mg*.9;g.textAlign='left';g.textBaseline='alphabetic';
    g.fillStyle='#E8DEC8';g.font=`${s}px Marcellus, Georgia, serif`;g.fillText('Plan de pose — '+M.name,Mg,y+s*.4);
    g.font=`italic ${s*.55}px "Libre Caslon Text", Georgia, serif`;g.fillStyle='#A99C82';g.fillText(`Table de ${M.w}″ × ${M.h}″ — règles V11. Mesures depuis les deux bords les plus proches ; le bord haut est le haut de ce plan. Croix = centre de la table.`,Mg,y+s*1.3);
    y+=head;g.fillStyle=POSE_C;g.font=`${s*.6}px Marcellus, Georgia, serif`;g.fillText('FICHE DE POSE',Mg,y);y+=s*.8;
    const clip=(t,max)=>{if(g.measureText(t).width<=max)return t;while(t.length>4&&g.measureText(t+'…').width>max)t=t.slice(0,-1);return t+'…'};
    rows.forEach((r,i)=>{const col=Math.floor(i/per),x=Mg+col*(colW+s),yy=y+(i%per)*eh+lh;g.fillStyle=POSE_C;g.font=`${fs}px Marcellus, Georgia, serif`;g.fillText(r.num,x,yy);
      g.fillStyle='#E8DEC8';g.fillText(clip(r.name+' · '+r.dims,colW-fs*2.4),x+fs*2.4,yy);g.fillStyle='#BDB29B';g.font=`italic ${fs*.95}px "Libre Caslon Text", Georgia, serif`;g.fillText(clip(r.line,colW-fs*2.4),x+fs*2.4,yy+lh)});
    c.toBlob(b=>download(slug(M.name)+'-plan-de-pose.png',b),'image/png')}
  $('at-png').onclick=async()=>{if(document.fonts)await document.fonts.ready;if(pose){poseSheet();return}const s=24,Mg=1.8*s,F=3*s;const c=document.createElement('canvas');c.width=Math.round(M.w*s+2*Mg);c.height=Math.round(M.h*s+Mg*1.5+F);const g=c.getContext('2d');g.fillStyle='#0A0C0E';g.fillRect(0,0,c.width,c.height);
    renderMap(g,M,s,Mg,Mg,{dpr:2,rulerColor:'#A99C82'});const y0=Mg+M.h*s+Mg*.9;g.fillStyle='#E8DEC8';g.font=`${s}px Marcellus, Georgia, serif`;g.fillText(M.name,Mg,y0+s*.4);
    g.font=`italic ${s*.6}px "Libre Caslon Text", Georgia, serif`;g.fillStyle='#A99C82';g.fillText(`${ACTE_TXT[M.acte]||''}${M.partie&&M.acte!=='prologue'?', partie '+M.partie:''} — table de ${M.w}″ × ${M.h}″ — règles V11`,Mg,y0+s*1.35);
    c.toBlob(b=>download(slug(M.name)+'.png',b),'image/png')};
  /* démarrage */
  await loadCatalog(sb,true);
  if(sb&&!KAT.stl.length){try{const st=await sb.from('stl_sources').select('id,type_id,title,url,author,license,scale,status,quantity,print_notes');KAT.stl=st.data||[]}catch(e){}}
  const ss=$('at-set');KAT.sets.forEach(x=>ss.appendChild(el('option',{value:x.id,text:x.name})));
  const D0=readDraft();ED={host,fit};loadInto(prologueV11());refreshList();offerDraft(D0);
  if(document.fonts)document.fonts.ready.then(()=>{buildPalette();req()});
}

/* ============================================================
   CARTES PUBLIÉES (lecture seule, page Batailles)
   ============================================================ */
async function renderPublished(host,opt){if(!host)return;opt=opt||{};const sb=opt.sb;host.classList.add('no-xref');
  if(!sb){host.innerHTML='';return}
  await loadCatalog(sb,false);
  const{data,error}=await sb.from('battle_maps').select('id,name,acte,partie,location_ref,width_in,depth_in,biome,layout').eq('published',true).order('acte').order('partie');
  if(error){host.innerHTML='<p class="at-muted">Les cartes n\u2019ont pas pu être chargées.</p>';return}
  if(!data||!data.length){host.innerHTML='<p class="at-muted">Aucune carte publiée pour l\u2019instant.</p>';return}
  host.innerHTML='';
  data.forEach(m=>{const map={w:+m.width_in,h:+m.depth_in,biome:m.biome,items:toItems(m.layout)};
    const fig=document.createElement('figure');fig.className='at-map';
    fig.innerHTML=`<figcaption><span class="at-map-t">${esc(m.name)}</span><span class="at-map-m">${esc(ACTE_TXT[m.acte]||m.acte)}${m.partie&&m.acte!=='prologue'?' · partie '+m.partie:''} · ${map.w}″ × ${map.h}″</span><button type="button" class="at-btn" aria-pressed="false">Vue tactique</button></figcaption><div class="at-map-c"><canvas></canvas></div>`;
    host.appendChild(fig);const c=fig.querySelector('canvas'),wrap=fig.querySelector('.at-map-c'),btn=fig.querySelector('button');let tact=false;
    const paint=()=>{const r=wrap.getBoundingClientRect();if(r.width<10)return;const dpr=window.devicePixelRatio||1;const pad=30*dpr;c.width=Math.round(r.width*dpr);const s=(c.width-2*pad)/map.w;c.height=Math.round(map.h*s+2*pad);c.style.height=(c.height/dpr)+'px';const g=c.getContext('2d');const T=TACT;TACT=tact;renderMap(g,map,s,pad,pad,{dpr,rulerColor:'#A99C82'});TACT=T};
    btn.onclick=()=>{tact=!tact;btn.setAttribute('aria-pressed',tact);paint()};
    new ResizeObserver(paint).observe(wrap);if(document.fonts)document.fonts.ready.then(paint)})}

window.CytTables={mountAtelier,renderPublished,toItems,toLayout};
})();
