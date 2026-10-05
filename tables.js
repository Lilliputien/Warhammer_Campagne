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
function wtext(ctx,lx,ly,text,sizeIn,s,color,align,bold){const m=ctx.getTransform();const p=m.transformPoint(new DOMPoint(lx,ly));ctx.save();ctx.setTransform(1,0,0,1,0,0);noShadow(ctx);ctx.font=`${Math.max(9,sizeIn*s)}px Marcellus, Georgia, serif`;ctx.textAlign=align||'center';ctx.textBaseline='middle';ctx.lineWidth=Math.max(2,sizeIn*s*.22);ctx.strokeStyle='rgba(8,10,10,.82)';ctx.lineJoin='round';ctx.strokeText(text,p.x,p.y);ctx.fillStyle=color||'#E8DEC8';ctx.fillText(text,p.x,p.y);ctx.restore()}
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
  gate:{g:'Tombe nécron',n:'Portail de tombe',w:4,h:1,los:'block',layer:2,
    draw(ctx,it,rnd,s){const{w,h}=it;const p=Math.min(.8,w*.2);gaussLine(ctx,-w/2+p,0,w/2-p,0,.12,.75);ctx.save();ctx.globalCompositeOperation='lighter';ctx.fillStyle=rgba(GAUSS,.14);ctx.fillRect(-w/2+p,-h*.3,w-2*p,h*.6);ctx.restore();
      for(const sx of[-1,1]){shadow(ctx,s,3.6);ctx.fillStyle='#232c27';ctx.fillRect(sx>0?w/2-p:-w/2,-h/2,p,h);noShadow(ctx);ctx.fillStyle='#3a4741';ctx.fillRect((sx>0?w/2-p:-w/2)+.1,-h/2+.1,p-.2,h-.2);glow(ctx,sx*(w/2-p/2),0,.5,.5)}}},
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
const FB_H={ruin_l:6,ruin_box:5,wall:3,muraille:6,container:3,rubble:1,crater:0,trench:0,sandbags:1,barricade:1.5,wire:1,tomb_wall:4.1,pillar:5,pylon:8,sarco:1.5,niche:4,gate:4};
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
function setCatalog(decor,areas){KAT.decor={};(decor&&decor.length?decor:FALLBACK_DECOR).forEach(d=>KAT.decor[d.id]=d);KAT.areas={};(areas&&areas.length?areas:FALLBACK_AREAS).forEach(a=>KAT.areas[a.id]=a)}
setCatalog();
let CAT_P=null;
function loadCatalog(sb,admin){if(CAT_P)return CAT_P;CAT_P=(async()=>{if(!sb)return;try{
  const[d,a,s,si]=await Promise.all([sb.from('decor_types').select('*'),sb.from('area_types').select('*'),sb.from('decor_sets').select('*'),sb.from('decor_set_items').select('*')]);
  setCatalog(d.data,a.data);KAT.sets=s.data||[];KAT.setItems=si.data||[];
  if(admin){const st=await sb.from('stl_sources').select('type_id,title,author,status,quantity');KAT.stl=st.data||[]}}catch(e){}})();return CAT_P}

/* ---------- géométrie et dessin ---------- */
function areaPath(c,it){const{w,h}=it;c.beginPath();const sh=(KAT.areas[it.type]||{}).shape;if(sh==='triangle'){c.moveTo(-w/2,-h/2);c.lineTo(-w/2,h/2);c.lineTo(w/2,h/2);c.closePath()}else c.rect(-w/2,-h/2,w,h)}
function drawArea(c,it,s){noShadow(c);
  if(TACT){areaPath(c,it);c.fillStyle=it.obscuring?'#38434A':'rgba(56,67,74,.35)';c.fill();c.lineWidth=.08;c.strokeStyle='#C2D7E3';if(!it.obscuring)c.setLineDash([.4,.25]);c.stroke();c.setLineDash([])}
  else{areaPath(c,it);c.fillStyle='rgba(10,10,8,.22)';c.fill();c.lineWidth=.07;c.strokeStyle='rgba(232,222,200,.28)';c.stroke()}
  if(it.objective){c.save();areaPath(c,it);c.clip();areaPath(c,it);c.lineWidth=.32;c.strokeStyle=TACT?'#DDB64F':'rgba(232,222,200,.55)';c.stroke();c.restore();
    const yl=-it.h/2+.75;c.save();c.translate(0,yl);c.rotate(-it.rot*PI/180);wtext(c,0,0,'◆ '+(it.label||'Objectif'),.62,s,TACT?'#F2D788':'#E8DEC8');c.restore()}
  else if(it.label){c.save();c.rotate(-it.rot*PI/180);wtext(c,0,0,it.label,.55,s,'rgba(232,222,200,.8)');c.restore()}}
function drawFeature(c,it,s){const d=KAT.decor[it.type]||{};const key=d.render_key||it.type;
  if(TACT){noShadow(c);const hgt=+d.height_in||0;c.beginPath();if(CAT[key]&&CAT[key].round)c.ellipse(0,0,it.w/2,it.h/2,0,0,TAU);else c.rect(-it.w/2,-it.h/2,it.w,it.h);
    c.fillStyle='rgba(232,222,200,.10)';c.fill();c.lineWidth=.05;c.strokeStyle=hgt>=3?'#E8DEC8':'rgba(232,222,200,.45)';c.stroke();
    if(hgt>=3){c.save();c.rotate(-it.rot*PI/180);wtext(c,0,0,(String(hgt).replace('.',','))+'″',.5,s,'#E8DEC8');c.restore()}return}
  if(CAT[key]&&!CAT[key].marker)CAT[key].draw(c,it,mulberry32(hashStr(it.id)),s,false);
  else{shadow(c,s,+d.height_in||1);c.fillStyle='#5a5650';c.fillRect(-it.w/2,-it.h/2,it.w,it.h);noShadow(c);c.save();c.rotate(-it.rot*PI/180);wtext(c,0,0,d.name||it.type,.5,s);c.restore()}}
function drawMarker(c,it,s,pass){const M=MARKERS[it.type];if(!M)return;const d=CAT[M.draw];
  if(it.type==='deploy'){if(pass==='label')d.draw(c,it,null,s,'label');else d.draw(c,it,null,s,true)}
  else if(pass!=='label')d.draw(c,it,null,s,false)}
function rank(it){if(it.k==='a')return 1;if(it.k==='m')return it.type==='deploy'?0:5;const d=KAT.decor[it.type];return(d&&+d.layer===1)?2:3}
function sorted(items){return items.map((it,i)=>({it,i})).sort((a,b)=>(rank(a.it)-rank(b.it))||(a.i-b.i)).map(o=>o.it)}
function drawOne(c,it,s,ox,oy){c.save();c.setTransform(s,0,0,s,ox,oy);c.translate(it.x,it.y);c.rotate(it.rot*PI/180);
  if(it.k==='a')drawArea(c,it,s);else if(it.k==='f')drawFeature(c,it,s);else drawMarker(c,it,s);c.restore();noShadow(c)}
function renderMap(c,map,s,ox,oy,o){const W=map.w,H=map.h;CURH=H;o=o||{};const dpr=o.dpr||1;
  c.save();c.setTransform(1,0,0,1,0,0);c.shadowColor='rgba(0,0,0,.7)';c.shadowBlur=24*dpr;c.fillStyle='#000';c.fillRect(ox,oy,W*s,H*s);noShadow(c);
  if(TACT){c.fillStyle='#1b2024';c.fillRect(ox,oy,W*s,H*s)}else c.drawImage(ground(map.biome,W,H),ox,oy,W*s,H*s);
  c.beginPath();c.rect(ox,oy,W*s,H*s);c.clip();
  if(o.grid){c.lineWidth=1;for(let x=0;x<=W;x++){c.strokeStyle=x%6?'rgba(232,222,200,.07)':'rgba(232,222,200,.17)';c.beginPath();c.moveTo(Math.round(ox+x*s)+.5,oy);c.lineTo(Math.round(ox+x*s)+.5,oy+H*s);c.stroke()}for(let y=0;y<=H;y++){c.strokeStyle=y%6?'rgba(232,222,200,.07)':'rgba(232,222,200,.17)';c.beginPath();c.moveTo(ox,Math.round(oy+y*s)+.5);c.lineTo(ox+W*s,Math.round(oy+y*s)+.5);c.stroke()}}
  const L=sorted(map.items);for(const it of L)drawOne(c,it,s,ox,oy);
  for(const it of L)if(it.k==='m'&&it.type==='deploy'){c.save();c.setTransform(s,0,0,s,ox,oy);c.translate(it.x,it.y);c.rotate(it.rot*PI/180);drawMarker(c,it,s,'label');c.restore()}
  c.restore();
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
    if(i.k==='a')areas.push(Object.assign(b,{obscuring:!!i.obscuring,objective:!!i.objective},i.label?{label:i.label}:{}));
    else if(i.k==='f'){const host=A.find(a=>inside(a,[i.x,i.y]));features.push(Object.assign(b,host?{area:host.id}:{}))}
    else{const m={id:i.id,kind:i.type,x:b.x,y:b.y,w:b.w,h:b.h,rot:b.rot};if(i.faction)m.faction=i.faction;if(i.label)m.label=i.label;markers.push(m)}});
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
      <button type="button" class="at-btn" id="at-grid" aria-pressed="true">Grille</button>
      <button type="button" class="at-btn" id="at-tact" aria-pressed="false">Vue tactique</button>
      <button type="button" class="at-btn" id="at-undo" title="Ctrl+Z">Annuler</button>
      <button type="button" class="at-btn" id="at-png">PNG</button>
      <button type="button" class="at-btn" id="at-json">JSON</button>
      <button type="button" class="at-btn" id="at-imp">Importer</button><input type="file" id="at-file" accept=".json,application/json" hidden>
    </div>
  </div>
  <div class="at-grid">
    <aside class="at-left" id="at-pal"></aside>
    <div class="at-stage" id="at-stage"><canvas id="at-cv" aria-label="Table de bataille"></canvas><div class="at-hint" id="at-hint"></div></div>
    <aside class="at-right">
      <div id="at-insp"></div>
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
      <label class="at-chk"><input type="checkbox" id="at-pub"> Publiée (visible des joueurs)</label>
      <div class="at-row2"><button type="button" class="at-btn at-main" id="at-save">Enregistrer</button><button type="button" class="at-btn" id="at-del">Supprimer</button></div>
      <p class="at-status" id="at-status" role="status"></p>
      <h3>Liste d'impression</h3><div id="at-print"></div>
    </aside>
  </div></div>`;
  const $=id=>host.querySelector('#'+id);
  const cv=$('at-cv'),ctx=cv.getContext('2d'),stage=$('at-stage');
  let M=prologueV11(),sel=null,mode='sel',grid=true,undoS=[],view={s:10,ox:0,oy:0},DPR=1,measure=null,drag=null,dirty=false;
  const status=t=>{$('at-status').textContent=t||''};
  const visible=()=>host.offsetParent!==null;
  function fit(){const r=stage.getBoundingClientRect();if(r.width<10||r.height<10)return;DPR=window.devicePixelRatio||1;cv.width=Math.round(r.width*DPR);cv.height=Math.round(r.height*DPR);const pad=34*DPR,s=Math.max(1,Math.min((cv.width-2*pad)/M.w,(cv.height-2*pad)/M.h));view={s,ox:(cv.width-M.w*s)/2,oy:(cv.height-M.h*s)/2};draw()}
  function req(){if(!dirty){dirty=true;requestAnimationFrame(()=>{dirty=false;draw()})}}
  function corners(it){const a=it.rot*PI/180,co=Math.cos(a),si=Math.sin(a);const tf=(lx,ly)=>[it.x+lx*co-ly*si,it.y+lx*si+ly*co];return{res:tf(it.w/2,it.h/2),rot:tf(0,-it.h/2-1.4),top:tf(0,-it.h/2)}}
  function draw(){const{s,ox,oy}=view;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
    renderMap(ctx,M,s,ox,oy,{grid,dpr:DPR,rulerColor:getComputedStyle(host).getPropertyValue('--bone-dim').trim()||'#A99C82'});
    const it=M.items.find(i=>i.id===sel);
    if(it){const k=corners(it);ctx.save();ctx.setTransform(s,0,0,s,ox,oy);ctx.translate(it.x,it.y);ctx.rotate(it.rot*PI/180);ctx.setLineDash([6/s,4/s]);ctx.strokeStyle='#C2D7E3';ctx.lineWidth=1.5*DPR/s;ctx.strokeRect(-it.w/2-.15,-it.h/2-.15,it.w+.3,it.h+.3);ctx.restore();
      ctx.save();ctx.setTransform(1,0,0,1,0,0);const P=p=>[ox+p[0]*s,oy+p[1]*s];const t=P(k.top),r=P(k.rot),q=P(k.res);ctx.strokeStyle='#C2D7E3';ctx.lineWidth=1.5*DPR;ctx.beginPath();ctx.moveTo(t[0],t[1]);ctx.lineTo(r[0],r[1]);ctx.stroke();ctx.fillStyle='#151A1F';ctx.beginPath();ctx.arc(r[0],r[1],6*DPR,0,TAU);ctx.fill();ctx.stroke();ctx.fillStyle='#C2D7E3';ctx.fillRect(q[0]-5*DPR,q[1]-5*DPR,10*DPR,10*DPR);ctx.restore()}
    if(measure){const a=[ox+measure.a[0]*s,oy+measure.a[1]*s],b=[ox+measure.b[0]*s,oy+measure.b[1]*s],d=Math.hypot(measure.b[0]-measure.a[0],measure.b[1]-measure.a[1]);ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.strokeStyle='rgba(8,10,10,.8)';ctx.lineWidth=5*DPR;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.strokeStyle='#E8DEC8';ctx.lineWidth=2*DPR;ctx.stroke();ctx.font=`${14*DPR}px Marcellus, Georgia, serif`;ctx.textAlign='center';ctx.textBaseline='bottom';const tx=(a[0]+b[0])/2,ty=(a[1]+b[1])/2-8*DPR,txt=d.toFixed(1).replace('.',',')+'″';ctx.lineWidth=4*DPR;ctx.strokeStyle='rgba(8,10,10,.85)';ctx.strokeText(txt,tx,ty);ctx.fillStyle='#E8DEC8';ctx.fillText(txt,tx,ty);ctx.restore()}}
  new ResizeObserver(fit).observe(stage);
  function hint(){$('at-hint').textContent=mode==='mes'?'Glisse sur la table pour mesurer.':sel?'Rond : pivoter. Carré : redimensionner. Suppr : retirer.':TACT?'Vue tactique : zone pleine = Obscurcissante, pointillée = sans blocage, liseré doré = objectif ; hauteur affichée sur les décors de 3″ et plus (Tir plongeant).':'Pose d\u2019abord les zones de terrain, puis les décors dessus.'}
  /* palette */
  function previewCanvas(drawFn,w,h,bg){const pc=document.createElement('canvas');pc.width=176;pc.height=112;const c=pc.getContext('2d');c.fillStyle=bg;c.fillRect(0,0,176,112);const sc=Math.min(150/w,88/h,40);drawFn(c,sc);return pc}
  function buildPalette(){const host2=$('at-pal');host2.innerHTML='';
    const group=(title,entries)=>{if(!entries.length)return;const h=document.createElement('h3');h.textContent=title;host2.appendChild(h);const box=document.createElement('div');box.className='at-pal';host2.appendChild(box);entries.forEach(e=>{const b=document.createElement('button');b.type='button';b.title=e.title||e.n;b.appendChild(e.pc);const sp=document.createElement('span');sp.textContent=e.n;b.appendChild(sp);b.addEventListener('click',e.add);box.appendChild(b)})};
    const areaE=Object.values(KAT.areas).map(a=>{const w=a.width_in||8,h=a.depth_in||6;const it={id:'pv-'+a.id,k:'a',type:a.id,x:0,y:0,w,h,rot:0,obscuring:true};return{n:a.name+(a.width_in?` ${String(a.width_in).replace('.',',')}×${String(a.depth_in).replace('.',',')}`:''),title:a.official?'Empreinte standard GW (V11)':'Zone sur mesure',pc:previewCanvas((c,sc)=>drawOne(c,it,sc,88,56),w,h,'#1b2024'),add:()=>addItem({k:'a',type:a.id,w,h,obscuring:a.obscuring_default!==false,objective:false})}});
    group('Zones de terrain',areaE);
    const setIds=M.set_id?KAT.setItems.filter(r=>r.set_id===M.set_id).map(r=>r.type_id):[];
    const featE=d=>{const it={id:'pv-'+d.id,k:'f',type:d.id,x:0,y:0,w:+d.width_in,h:+d.depth_in,rot:0};const bg={tombe:'#26302b',ruines:'#45423c',no_mans_land:'#4a3f2d'}[d.family]||'#333';return{n:d.name,title:`${d.name} — ${String(d.width_in).replace('.',',')}×${String(d.depth_in).replace('.',',')}″, hauteur ${String(d.height_in||0).replace('.',',')}″`,pc:previewCanvas((c,sc)=>{const T=TACT;TACT=false;drawOne(c,it,sc,88,56);TACT=T},it.w,it.h,bg),add:()=>addItem({k:'f',type:d.id,w:+d.width_in,h:+d.depth_in})}};
    if(setIds.length){const st=KAT.sets.find(x=>x.id===M.set_id);group('Set · '+(st?st.name:M.set_id),setIds.map(id=>KAT.decor[id]).filter(Boolean).map(featE))}
    const fams={};Object.values(KAT.decor).forEach(d=>{(fams[d.family]=fams[d.family]||[]).push(d)});
    Object.keys(fams).forEach(f=>group(FAMILY_LABEL[f]||f,fams[f].map(featE)));
    group('Repères',Object.entries(MARKERS).map(([k,m])=>{const it={id:'pv-'+k,k:'m',type:k,x:0,y:0,w:m.w,h:m.h,rot:0,faction:m.fac};return{n:m.n,pc:previewCanvas((c,sc)=>{c.setTransform(sc,0,0,sc,88,56);CAT[m.draw].draw(c,it,null,sc,true);c.setTransform(1,0,0,1,0,0)},m.w,m.h,'#1b2024'),add:()=>addItem({k:'m',type:k,w:m.w,h:m.h,faction:m.fac,label:k==='label'?'Texte':''})}}))}
  /* état */
  function pushUndo(){undoS.push(JSON.stringify(M));if(undoS.length>80)undoS.shift()}
  function undo(){const p=undoS.pop();if(!p){status('Rien à annuler.');return}M=JSON.parse(p);if(!M.items.find(i=>i.id===sel))sel=null;syncForm();fit();buildInsp();printList()}
  function addItem(o,x,y){pushUndo();const it=Object.assign({id:uid(),x:x??M.w/2,y:y??M.h/2,rot:0},o);M.items.push(it);sel=it.id;buildInsp();req();printList()}
  function delSel(){if(!sel)return;pushUndo();M.items=M.items.filter(i=>i.id!==sel);sel=null;buildInsp();req();printList()}
  function dupSel(){const it=M.items.find(i=>i.id===sel);if(!it)return;pushUndo();const c=Object.assign({},it,{id:uid(),x:clamp(it.x+1,0,M.w),y:clamp(it.y+1,0,M.h)});M.items.push(c);sel=c.id;buildInsp();req();printList()}
  const snap=(v,alt)=>(grid&&!alt)?Math.round(v*2)/2:Math.round(v*100)/100;
  function toWorld(e){const r=cv.getBoundingClientRect();return[((e.clientX-r.left)*DPR-view.ox)/view.s,((e.clientY-r.top)*DPR-view.oy)/view.s]}
  function hit(p){const L=sorted(M.items).reverse();for(const it of L){const a=-it.rot*PI/180,dx=p[0]-it.x,dy=p[1]-it.y;const lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a);if(Math.abs(lx)<=it.w/2+.1&&Math.abs(ly)<=it.h/2+.1)return it}return null}
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);const p=toWorld(e);
    if(mode==='mes'){measure={a:[snap(p[0],e.altKey),snap(p[1],e.altKey)],b:p};req();return}
    const it=M.items.find(i=>i.id===sel);
    if(it){const k=corners(it),d=q=>Math.hypot(q[0]-p[0],q[1]-p[1])*view.s/DPR;if(d(k.rot)<12){pushUndo();drag={kind:'rot',it};return}if(d(k.res)<12){pushUndo();drag={kind:'res',it};return}}
    const h=hit(p);if(h){sel=h.id;pushUndo();drag={kind:'move',it:h,dx:p[0]-h.x,dy:p[1]-h.y,moved:false}}else sel=null;buildInsp();req()});
  cv.addEventListener('pointermove',e=>{const p=toWorld(e);
    if(mode==='mes'&&measure&&e.buttons){measure.b=[snap(p[0],e.altKey),snap(p[1],e.altKey)];req();return}
    if(!drag)return;const it=drag.it;
    if(drag.kind==='move'){it.x=clamp(snap(p[0]-drag.dx,e.altKey),0,M.w);it.y=clamp(snap(p[1]-drag.dy,e.altKey),0,M.h);drag.moved=true}
    else if(drag.kind==='rot'){let a=Math.atan2(p[1]-it.y,p[0]-it.x)*180/PI+90;a=e.shiftKey?Math.round(a):Math.round(a/15)*15;it.rot=((a%360)+360)%360}
    else{const a=-it.rot*PI/180,dx=p[0]-it.x,dy=p[1]-it.y;const lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a);it.w=Math.max(.5,snap(Math.abs(lx)*2,e.altKey));it.h=Math.max(.5,snap(Math.abs(ly)*2,e.altKey))}
    syncInsp();req()});
  cv.addEventListener('pointerup',()=>{if(drag){if(drag.kind==='move'&&!drag.moved)undoS.pop();drag=null}});
  document.addEventListener('keydown',e=>{if(!visible())return;const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='textarea'||tag==='select')return;
    const it=M.items.find(i=>i.id===sel),k=e.key;
    if((e.ctrlKey||e.metaKey)&&k.toLowerCase()==='z'){e.preventDefault();undo();return}
    if((e.ctrlKey||e.metaKey)&&k.toLowerCase()==='d'){e.preventDefault();dupSel();return}
    if(k==='v'||k==='V'){setMode('sel');return}if(k==='m'||k==='M'){setMode('mes');return}
    if(k==='Escape'){sel=null;measure=null;buildInsp();req();return}
    if(!it)return;
    if(k==='Delete'||k==='Backspace'){e.preventDefault();delSel();return}
    const rotBy=d=>{pushUndo();it.rot=((it.rot+d)%360+360)%360;syncInsp();req()};
    if(k==='r')rotBy(90);else if(k==='R')rotBy(-90);else if(k==='q'||k==='Q')rotBy(-15);else if(k==='e'||k==='E')rotBy(15);
    else if(k.indexOf('Arrow')===0){e.preventDefault();pushUndo();const st=e.shiftKey?2:.5;if(k==='ArrowLeft')it.x-=st;if(k==='ArrowRight')it.x+=st;if(k==='ArrowUp')it.y-=st;if(k==='ArrowDown')it.y+=st;it.x=clamp(it.x,0,M.w);it.y=clamp(it.y,0,M.h);syncInsp();req()}});
  function setMode(m){mode=m;host.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===m));stage.classList.toggle('is-measure',m==='mes');if(m!=='mes')measure=null;hint();req()}
  host.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  $('at-grid').onclick=()=>{grid=!grid;$('at-grid').setAttribute('aria-pressed',grid);req()};
  $('at-tact').onclick=()=>{TACT=!TACT;$('at-tact').setAttribute('aria-pressed',TACT);hint();req()};
  $('at-undo').onclick=undo;
  /* inspecteur */
  function el(tag,attrs,kids){const n=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(k==='text')n.textContent=v;else n.setAttribute(k,v)}(kids||[]).forEach(k=>n.appendChild(k));return n}
  function buildInsp(){const h=$('at-insp');h.innerHTML='';hint();const it=M.items.find(i=>i.id===sel);
    if(!it){h.appendChild(el('h3',{text:'Sélection'}));h.appendChild(el('p',{class:'at-muted',text:'Clique sur un élément de la table pour le régler.'}));return}
    const name=it.k==='a'?(KAT.areas[it.type]||{}).name||'Zone':it.k==='f'?(KAT.decor[it.type]||{}).name||it.type:MARKERS[it.type].n;
    h.appendChild(el('h3',{text:name}));
    if(it.k==='f'){const d=KAT.decor[it.type]||{};h.appendChild(el('p',{class:'at-muted',text:`Hauteur ${String(d.height_in||0).replace('.',',')}″${+d.height_in>=3?' : Tir plongeant possible depuis ce décor.':''}`}))}
    const num=(lab,key,step,min)=>{const i=el('input',{type:'number',step:String(step),min:String(min??0),'data-k':key});i.value=Math.round(it[key]*100)/100;i.addEventListener('focus',pushUndo);i.addEventListener('input',()=>{const v=parseFloat(i.value);if(!isNaN(v)){it[key]=key==='rot'?((v%360)+360)%360:Math.max(min??0,v);req()}});return el('label',{class:'at-f'},[document.createTextNode(lab),i])};
    h.appendChild(el('div',{class:'at-row3'},[num('X','x',.5),num('Y','y',.5),num('Angle','rot',15)]));
    h.appendChild(el('div',{class:'at-row2'},[num('Longueur','w',.5,.5),num('Largeur','h',.5,.5)]));
    if(it.k==='a'){const chk=(lab,key)=>{const i=el('input',{type:'checkbox'});i.checked=!!it[key];i.addEventListener('change',()=>{pushUndo();it[key]=i.checked;req()});return el('label',{class:'at-chk'},[i,document.createTextNode(' '+lab)])};h.appendChild(chk('Obscurcissante','obscuring'));h.appendChild(chk('Objectif (zone à contrôler)','objective'))}
    if(it.k==='a'||it.k==='m'){const i=el('input',{});i.value=it.label||'';i.addEventListener('focus',pushUndo);i.addEventListener('input',()=>{it.label=i.value;req()});h.appendChild(el('label',{class:'at-f'},[document.createTextNode('Libellé'),i]))}
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
  function loadInto(m){M=m;sel=null;measure=null;undoS=[];syncForm();buildPalette();buildInsp();fit();printList()}
  $('at-new').onclick=()=>loadInto(blankMap());$('at-proto').onclick=()=>loadInto(prologueV11());
  /* Supabase : liste, ouverture, enregistrement */
  async function refreshList(selId){const s=$('at-list');s.innerHTML='<option value="">Choisir une carte…</option>';if(!sb)return;
    const{data,error}=await sb.from('battle_maps').select('id,name,acte,partie,published').order('updated_at',{ascending:false});
    if(error){status('Lecture des cartes impossible : '+error.message);return}
    (data||[]).forEach(m=>{const o=el('option',{value:m.id,text:`${m.published?'● ':'○ '}${m.name} — ${ACTE_TXT[m.acte]||m.acte}${m.partie?' · '+m.partie:''}`});s.appendChild(o)});if(selId)s.value=selId}
  $('at-list').onchange=async e=>{const id=e.target.value;if(!id||!sb)return;status('Ouverture…');
    const{data,error}=await sb.from('battle_maps').select('*').eq('id',id).single();if(error){status('Ouverture impossible : '+error.message);return}
    const n=await sb.from('battle_map_notes').select('notes').eq('map_id',id).maybeSingle();
    loadInto({id:data.id,name:data.name,edition:data.edition,acte:data.acte,partie:data.partie,location_ref:data.location_ref||'',set_id:data.set_id||'',w:+data.width_in,h:+data.depth_in,biome:data.biome,published:data.published,notes:(n.data&&n.data.notes)||'',items:toItems(data.layout)});status('Carte ouverte.')};
  $('at-save').onclick=async()=>{if(!sb){status('Supabase indisponible : exporte en JSON.');return}status('Enregistrement…');
    const row={name:M.name||'Sans titre',edition:'V11',acte:M.acte,partie:M.partie||null,location_ref:M.location_ref||null,set_id:M.set_id||null,width_in:M.w,depth_in:M.h,biome:M.biome,layout:toLayout(M.items),published:!!M.published,updated_at:new Date().toISOString()};
    const q=M.id?sb.from('battle_maps').update(row).eq('id',M.id).select('id').single():sb.from('battle_maps').insert(row).select('id').single();
    const{data,error}=await q;if(error){status('Enregistrement refusé : '+error.message);return}M.id=data.id;
    const n=await sb.from('battle_map_notes').upsert({map_id:M.id,notes:M.notes||''});
    await refreshList(M.id);syncForm();status(n.error?'Carte enregistrée, mais pas les notes : '+n.error.message:(M.published?'Carte enregistrée et publiée.':'Carte enregistrée (non publiée).'))};
  $('at-del').onclick=async()=>{if(!M.id||!sb)return;if(!confirm('Supprimer définitivement la carte « '+M.name+' » ?'))return;const{error}=await sb.from('battle_maps').delete().eq('id',M.id);if(error){status('Suppression impossible : '+error.message);return}loadInto(blankMap());refreshList();status('Carte supprimée.')};
  /* liste d'impression */
  const STAT={a_evaluer:'à évaluer',retenu:'retenu',a_imprimer:'à imprimer',imprime:'imprimé',peint:'peint',ecarte:'écarté'};
  function printList(){const h=$('at-print');const cnt={};M.items.filter(i=>i.k==='f').forEach(i=>cnt[i.type]=(cnt[i.type]||0)+1);const keys=Object.keys(cnt);
    if(!keys.length){h.innerHTML='<p class="at-muted">Aucun décor posé.</p>';return}
    h.innerHTML='<ul class="at-print">'+keys.sort().map(k=>{const d=KAT.decor[k]||{};const src=KAT.stl.filter(s=>s.type_id===k&&s.status!=='ecarte');const best=src.find(s=>['peint','imprime','a_imprimer','retenu'].includes(s.status))||src[0];
      return`<li><b>${cnt[k]} × ${esc(d.name||k)}</b><span>${best?esc((best.author?best.author+' — ':'')+best.title)+' · '+STAT[best.status]:'aucune source'}</span></li>`}).join('')+'</ul>'}
  /* export / import */
  function download(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
  $('at-json').onclick=()=>{const out={name:M.name,edition:'V11',acte:M.acte,partie:M.partie,location_ref:M.location_ref,set_id:M.set_id,width_in:M.w,depth_in:M.h,biome:M.biome,layout:toLayout(M.items)};download(slug(M.name)+'.json',new Blob([JSON.stringify(out,null,2)],{type:'application/json'}))};
  $('at-imp').onclick=()=>$('at-file').click();
  $('at-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const t=JSON.parse(await f.text());
      const items=toItems(t.layout||t.items||t);if(!items.length)throw 0;
      loadInto({id:null,name:t.name||'Table importée',edition:'V11',acte:t.acte||'1',partie:t.partie||1,location_ref:t.location_ref||'',set_id:t.set_id||'',w:+(t.width_in||t.w||44),h:+(t.depth_in||t.h||30),biome:t.biome||'ruine',published:false,notes:t.notes||'',items});status('Table importée : enregistre-la pour la garder.')}catch(err){status('Ce fichier n\u2019est pas une table valide.')}e.target.value=''};
  $('at-png').onclick=async()=>{if(document.fonts)await document.fonts.ready;const s=24,Mg=1.8*s,F=3*s;const c=document.createElement('canvas');c.width=Math.round(M.w*s+2*Mg);c.height=Math.round(M.h*s+Mg*1.5+F);const g=c.getContext('2d');g.fillStyle='#0A0C0E';g.fillRect(0,0,c.width,c.height);
    renderMap(g,M,s,Mg,Mg,{dpr:2,rulerColor:'#A99C82'});const y0=Mg+M.h*s+Mg*.9;g.fillStyle='#E8DEC8';g.font=`${s}px Marcellus, Georgia, serif`;g.fillText(M.name,Mg,y0+s*.4);
    g.font=`italic ${s*.6}px "Libre Caslon Text", Georgia, serif`;g.fillStyle='#A99C82';g.fillText(`${ACTE_TXT[M.acte]||''}${M.partie&&M.acte!=='prologue'?', partie '+M.partie:''} — table de ${M.w}″ × ${M.h}″ — règles V11`,Mg,y0+s*1.35);
    c.toBlob(b=>download(slug(M.name)+'.png',b),'image/png')};
  /* démarrage */
  await loadCatalog(sb,true);
  if(sb&&!KAT.stl.length){try{const st=await sb.from('stl_sources').select('type_id,title,author,status,quantity');KAT.stl=st.data||[]}catch(e){}}
  const ss=$('at-set');KAT.sets.forEach(x=>ss.appendChild(el('option',{value:x.id,text:x.name})));
  ED={host,fit};loadInto(prologueV11());refreshList();
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
