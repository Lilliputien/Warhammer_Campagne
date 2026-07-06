/* ============================================================
   CONFIGURATION SUPABASE — À COMPLÉTER
   Remplace la valeur de SUPA_KEY ci-dessous par ta clé
   « Publishable » (elle commence par sb_publishable_...).
   L'URL de ton projet est déjà renseignée.
   ============================================================ */
const SUPA_URL = "https://jhkoamrjshnyucupnejm.supabase.co";
const SUPA_KEY = "sb_publishable_RKw8L8_BVgNp3-0D49ITEQ_5mLMZ4PZ";

let sb=null;
function gateMsg(t){const m=document.getElementById('gate-msg');if(m)m.textContent=t||'';}
function showApp(on){
  const g=document.getElementById('gate');
  if(on){ g.classList.add('hidden'); document.body.classList.remove('locked'); }
  else { g.classList.remove('hidden'); document.body.classList.add('locked'); }
}
/* garde-fou : rejette une promesse qui ne se résout pas dans le délai imparti,
   pour ne jamais rester figé sur "Connexion…" si Supabase/le réseau ne répond pas */
function withTimeout(promise, ms, label){
  return Promise.race([
    promise,
    new Promise((_,rej)=>setTimeout(()=>rej(new Error(label||'timeout')), ms))
  ]);
}
let LOGIN_BUSY=false;
async function doLogin(){
  if(!sb||LOGIN_BUSY) return;
  const email=(document.getElementById('g-email').value||'').trim();
  const pass=document.getElementById('g-pass').value||'';
  if(!email||!pass){ gateMsg("Renseigne ton e-mail et ton mot de passe."); return; }
  LOGIN_BUSY=true;
  gateMsg("Connexion…");
  try{
    const {error}=await withTimeout(sb.auth.signInWithPassword({email,password:pass}), 10000, 'login-timeout');
    gateMsg(error ? "E-mail ou mot de passe incorrect." : "");
  } catch(e){
    gateMsg("La connexion met trop de temps ou a échoué. Vérifie ta connexion et réessaie.");
  } finally {
    LOGIN_BUSY=false;
  }
}
async function doLogout(){ if(sb) await sb.auth.signOut(); }

let ME={role:null,factions:[],progress:{}}; let ALLPROG={}; let CUR='/';
async function loadMe(){
  ME={role:null,factions:[],progress:{}}; ALLPROG={};
  try{
    const {data:{user}}=await sb.auth.getUser(); if(!user) return;
    const {data:prof}=await sb.from('profiles').select('role,factions').eq('id',user.id).single();
    if(prof){ ME.role=prof.role; ME.factions=prof.factions||[]; }
    const {data:rows}=await sb.from('hero_progress').select('faction,data').eq('user_id',user.id);
    (rows||[]).forEach(function(r){ ME.progress[r.faction]=r.data||{}; });
    if(ME.role==='admin'){
      const {data:all}=await sb.from('hero_progress').select('user_id,faction,data');
      (all||[]).forEach(function(r){
        if(r.user_id===user.id) return;                     // ignorer mes propres lignes (bac à sable)
        if((ME.factions||[]).indexOf(r.faction)>=0) return; // pas mes factions
        ALLPROG[r.faction]=r.data||{};
      });
    }
  }catch(e){}
}
let ADMIN_VIEW='sandbox';   // 'sandbox' : édition test · 'supervise' : progression réelle des joueurs (lecture seule)
function heroMode(id){
  const own=(ME.factions||[]).indexOf(id)>=0;
  if(ME.role==='admin'){
    if(own) return 'edit';                            // mes propres factions : toujours éditables
    return ADMIN_VIEW==='sandbox' ? 'edit' : 'view';  // les autres : selon le toggle
  }
  if(own) return 'edit';
  return 'static';
}
function renderAdminToggle(){
  const b=document.getElementById('adminToggle'); if(!b) return;
  if(ME.role!=='admin'){ b.hidden=true; return; }
  b.hidden=false;
  const sandbox=ADMIN_VIEW==='sandbox';
  b.textContent = sandbox ? 'Bac à sable' : 'Supervision';
  b.title = sandbox
    ? 'Mode test — édite les effets sans toucher la progression réelle. Cliquer pour superviser la progression réelle des joueurs.'
    : 'Supervision — progression réelle des joueurs, en lecture seule. Cliquer pour repasser en bac à sable.';
  b.setAttribute('aria-pressed', sandbox ? 'true' : 'false');
  b.classList.toggle('is-supervise', !sandbox);
}
function toggleAdminView(){
  ADMIN_VIEW = ADMIN_VIEW==='sandbox' ? 'supervise' : 'sandbox';
  renderAdminToggle();
  if(CUR && CUR.indexOf('/factions/')===0) go(CUR);   // re-render la faction affichée
}
async function onSession(session){
  if(session){
    try{ await withTimeout(loadMe(), 12000, 'loadme-timeout'); }catch(e){}
    renderAdminToggle();
    showApp(true); go(CUR);
  }
  else { ME={role:null,factions:[],progress:{}}; renderAdminToggle(); showApp(false); }
}
function canTrack(id){ return ME.role==='admin' || (ME.factions||[]).indexOf(id)>=0; }
async function saveProgress(fac){
  if(!sb||!ME.progress[fac]) return;
  try{ const {data:{user}}=await sb.auth.getUser(); if(!user)return;
    await sb.from('hero_progress').upsert({user_id:user.id,faction:fac,data:ME.progress[fac],updated_at:new Date().toISOString()},{onConflict:'user_id,faction'});
  }catch(e){}
}
function paintEntry(row){
  const fac=row.dataset.fac,key=row.dataset.key,seuil=parseInt(row.dataset.seuil,10)||1;
  const c=(ME.progress[fac]&&ME.progress[fac][key])||0, p=Math.min(c/seuil,1);
  row.style.setProperty('--p',p); row.classList.toggle('unlocked',c>=seuil);
  const v=row.querySelector('.cval'); if(v)v.textContent=c;
}
function updateCrown(fac){
  const crown=document.querySelector('.hrow.crown[data-fac="'+fac+'"]'); if(!crown) return;
  const rows=[].slice.call(document.querySelectorAll('.hrow.track[data-kind="v"][data-fac="'+fac+'"]'));
  const n=rows.filter(function(r){return r.classList.contains('unlocked');}).length, on=n>=3;
  const was=crown.classList.contains('unlocked');
  crown.classList.toggle('unlocked',on); crown.classList.toggle('locked',!on);
  if(on && !was) igniteRow(crown);
  const st=crown.querySelector('.crownstate'); if(st)st.textContent = on?'✦ Couronnement débloqué — 3 titres obtenus':('Verrouillé — '+Math.min(n,3)+'/3 titres requis');
}
function buildRecap(fac, prog){
  const host=document.getElementById('recap-'+fac); if(!host) return;
  const h=HEROTABLE[fac]; if(!h) return; prog=prog||ME.progress[fac]||{};
  const actV=h.voie.filter(function(r,i){return (prog['v'+i]||0)>=(parseInt(r.seuil,10)||1);}).map(function(r){return r.titre;});
  const actM=h.malus.filter(function(r,i){return (prog['m'+i]||0)>=(parseInt(r.seuil,10)||1);}).map(function(r){return r.titre;});
  const crownOn=h.voie.filter(function(r,i){return (prog['v'+i]||0)>=(parseInt(r.seuil,10)||1);}).length>=3;
  let f='<div class="recap-h">État actuel</div><div class="recap-cols">';
  f+='<div class="recap-col"><span class="rc-lab">Faveurs actives</span>';
  if(actV.length||crownOn){ f+='<ul>'+actV.map(function(t){return '<li>'+t+'</li>';}).join(''); if(crownOn)f+='<li class="crownli">'+h.couronnement.titre+' — couronnement</li>'; f+='</ul>'; }
  else f+="<em>Aucune pour l'instant.</em>";
  f+='</div><div class="recap-col malus"><span class="rc-lab">Fardeaux subis</span>';
  if(actM.length) f+='<ul>'+actM.map(function(t){return '<li>'+t+'</li>';}).join('')+'</ul>';
  else f+="<em>Aucun pour l'instant.</em>";
  f+='</div></div>';
  host.innerHTML=f;
}
function igniteRow(row){
  if(!row) return;
  row.classList.remove('just-unlocked'); void row.offsetWidth; row.classList.add('just-unlocked');
  setTimeout(function(){ row.classList.remove('just-unlocked'); }, 1150);
}
function adjustEntry(row,delta){
  const fac=row.dataset.fac,key=row.dataset.key,seuil=parseInt(row.dataset.seuil,10)||1;
  ME.progress[fac]=ME.progress[fac]||{};
  const old=ME.progress[fac][key]||0;
  let c=old+delta; if(c<0)c=0;
  ME.progress[fac][key]=c;
  paintEntry(row);
  if(old<seuil && c>=seuil) igniteRow(row);
  updateCrown(fac); buildRecap(fac); saveProgress(fac);
}
function initAuth(){
  if(!window.supabase){ gateMsg("Service indisponible (connexion internet ?)."); return; }
  if(!SUPA_KEY || SUPA_KEY.indexOf('sb_')!==0){ gateMsg("Configuration à compléter dans le fichier (clé Supabase)."); return; }
  sb=window.supabase.createClient(SUPA_URL,SUPA_KEY);
  withTimeout(sb.auth.getSession(), 8000, 'session-timeout')
    .then(({data})=>onSession(data.session))
    .catch(()=>{ showApp(false); gateMsg("Impossible de vérifier la session. Recharge la page."); });
  sb.auth.onAuthStateChange((_e,s)=>onSession(s));
  const b=document.getElementById('g-login'); if(b) b.addEventListener('click',doLogin);
  const p=document.getElementById('g-pass'); if(p) p.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
  const o=document.getElementById('logoutBtn'); if(o) o.addEventListener('click',e=>{e.preventDefault();doLogout();});
  const at=document.getElementById('adminToggle'); if(at) at.addEventListener('click',e=>{e.preventDefault();toggleAdminView();});
}
/* ------------------------------------------------------------
   CORRECTIF — resynchro de session après bfcache / retour navigateur
   Quand la page est restaurée depuis le cache de navigation
   (bouton précédent, onglet resté inactif), le script ne rejoue pas
   son initialisation : on force donc une relecture de la session
   Supabase pour éviter un écran de connexion figé sur "Connexion…".
   ------------------------------------------------------------ */
function resyncSession(){
  if(!sb) return;
  withTimeout(sb.auth.getSession(), 8000, 'resync-timeout')
    .then(({data})=>onSession(data.session))
    .catch(()=>{});
}
window.addEventListener('pageshow', function(e){
  if(e.persisted){ if(sb) resyncSession(); else location.reload(); }
});
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState==='visible') resyncSession();
});

const FACTIONS = [
  { id:"necrons", name:"Les Éveillés", real:"Necrons — Dynastie inconnue", tag:"Xenos · Métal endormi", c:"#54CBA6",
    lore:["Le Nœud n'a pas réveillé la dynastie : il l'a appelée. Sous la poussière de Cytherea, des légions de métal redressent la tête après des éons de stase, mues par un protocole que même leurs seigneurs-liches ne reconnaissent pas. Ils ne défendent pas un territoire. Ils répondent à une convocation.",
      "Là où ils passent, la lumière prend une teinte verte et froide, et les machines impériales se taisent comme par déférence. Les Éveillés ne haïssent pas les vivants — ils les classent."],
    leader:{name:"SZARETH", title:"le Premier Réveillé · Phaeron sans dynastie", bio:"Premier à s'être dressé quand la note a retenti, Szareth gouverne une légion qui n'apparaît dans aucune archive. Il avance vers le Nœud avec la certitude tranquille de celui qui se souvient d'une chose que la galaxie a oubliée.", traits:["Protocole inconnu","Indéfait depuis 60 M d'années"]},
    role:"Gardiens involontaires du Nœud : la faction qui en sait le plus, et qui en dira le moins." },
  { id:"red-choir", name:"Le Chœur Rouge", real:"World Eaters — Le Chœur Rouge", tag:"Chaos · Khorne", c:"#C03A2B",
    lore:["Ils sont arrivés en silence — et c'est ce silence qui terrifie. Le Chœur Rouge a fait vœu de mutisme rituel jusqu'à ce que la note du Nœud se taise, et leurs gorges scellées rendent leur furie plus pure, plus totale. Pas de cri de guerre. Seulement le travail des chaînes et des haches.",
      "Khorne ne demande pas pourquoi le sang coule, seulement qu'il coule. Mais quelque chose, à Cytherea, a transformé la soif du Chœur en pèlerinage."],
    leader:{name:"VORTAK", title:"Gorge-Close · Maître du Chœur", bio:"Il n'a pas prononcé un mot depuis trois campagnes. Ses ordres passent par le geste, la lame, le regard. On dit que le jour où Vortak rompra le silence, ce sera pour hurler le nom de ce qui dort sous Cytherea.", traits:["Vœu de silence","Jamais vaincu en duel"]},
    role:"La marée qui ne négocie pas. Leur progression dicte le rythme brutal de la campagne." },
  { id:"treizieme-cantique", name:"Le Treizième Cantique", real:"Emperor's Children — Le Treizième Cantique", tag:"Chaos · Slaanesh", c:"#B057D6",
    lore:["Si le Chœur Rouge s'est tu, le Treizième Cantique est venu pour écouter. La résonance du Nœud est, pour eux, la plus parfaite des sensations jamais offertes à la galaxie. Ils ne veulent pas la détruire. Ils veulent la posséder, la prolonger, s'y noyer.",
      "Leurs guerres sont des compositions. Chaque assaut module la douleur et l'extase comme un mouvement de symphonie, et leurs armes soniques font éclater la chair en accords."],
    leader:{name:"SIGRIM LE FOURBE", title:"l'Archisonneur · Maître de chapelle", bio:"Première oreille du Cantique, Sigrim le Fourbe entend dans la note du Nœud une œuvre inachevée qu'il compte terminer. Sa arme sonique, dit-on, a déjà fait s'agenouiller des compagnies entières d'extase et d'effroi mêlés.", traits:["Oreille parfaite","Arme sonique unique"]},
    role:"Les seuls à comprendre le Nœud comme une œuvre. Cela les rend imprévisibles — et patients." },
  { id:"custodes", name:"La Garde Cytheréenne", real:"Adeptus Custodes", tag:"Imperium · Talons d'or", c:"#E6C871",
    lore:["Que des Custodes aient quitté Terra pour un système oublié dit assez la gravité de ce qui s'éveille. Ils ne sont qu'une poignée — mais chacun vaut une compagnie, et chacun sait précisément ce que le Nœud menace de défaire.",
      "Ils ne partagent rien, n'expliquent rien, ne reculent pas. Là où l'Astra Militarum tient des lignes, les Custodes tiennent des principes."],
    leader:{name:"AELRIC", title:"Capitaine-Bouclier · Porteur du Verdict", bio:"Envoyé de Terra avec un ordre scellé que nul autre n'a lu, Aelric agit comme s'il connaissait déjà la fin de cette campagne. Sa lame, le Verdict, n'a jamais tranché deux fois la même cause.", traits:["Serment de Terra","Connaît le secret du Nœud"]},
    role:"L'épée de l'Imperium et son secret. Ils savent quelque chose que Krieg ignore." },
  { id:"krieg", name:"La 88e de Krieg", real:"Death Korps of Krieg", tag:"Imperium · Astra Militarum", c:"#A79A66",
    lore:["On ne les a pas envoyés vaincre. On les a envoyés durer. La 88e Compagnie de siège creuse Cytherea comme elle creuse toujours : en chiffrant le terrain en mètres et en morts, en transformant chaque crête en tranchée et chaque tranchée en cercueil patient.",
      "Ils ne questionnent pas le Nœud, ni les Talons d'or qui marchent à leurs côtés sans leur parler. Le devoir n'a pas besoin de comprendre."],
    leader:{name:"MARÉCHAL DE SIÈGE KESSLER", title:"Commandant de la 88e", bio:"On ignore son visage, comme celui de tous les siens. Kessler tient un registre où chaque mètre de Cytherea est inscrit au prix exact de vies qu'il a coûté. Il compte. Il avance. Il ne recule pas.", traits:["Ne recule jamais","Compte chaque mètre"]},
    role:"La colonne vertébrale humaine de la campagne. Ce qu'ils paient se compte en chiffres." },
];

const ACTS = [
  { id:"1", num:"Acte I", title:"L'Appel", locked:false,
    teaser:"La note s'éveille. Cinq armées convergent vers un système qui n'aurait jamais dû compter.",
    lore:["La première résonance n'a duré qu'un battement de cœur. Assez pour que, d'un bout à l'autre du système, cinq forces lèvent la tête en même temps. Le Mechanicus, lui, a déjà compris qu'il avait ouvert quelque chose qu'il ne savait pas refermer.",
      "Cytherea n'est plus un nom oublié. C'est un point de convergence, et la course vers le Nœud a commencé avant que quiconque en saisisse l'enjeu."],
    state:["La Plaine de Verre est tombée aux mains du Chœur Rouge ; la 88e de Krieg s'y est saignée pour rien.","Les Éveillés progressent sans bruit vers la Ruche Sépulcre."] },
  { id:"2", num:"Acte II", title:"La Convergence", locked:true,
    teaser:"Les routes se croisent. Ce qui était course devient étreinte." },
  { id:"3", num:"Acte III", title:"La Réponse", locked:true,
    teaser:"Le Nœud répond. Et nul ne sait encore à qui." },
  { id:"4", num:"Acte IV", title:"Le Silence", locked:true,
    teaser:"La note s'achève — ou se tait à jamais. Le système retient son souffle." },
];

const DESTINEES=[
  { id:"red-choir", root:"Le Vœu — tant que le silence tient, la fureur grandit.",
    asc:[{tier:"Faveur I",name:"Le Silence Récompensé",trig:"Après 1 victoire.",eff:"Une relance d'assaut (charge) par bataille.",active:true},
         {tier:"Faveur II",name:"La Moisson",trig:"Après 3 victoires, ou la prise d'un site d'acte.",eff:"Au corps-à-corps, +1 pour toucher durant la première manche.",active:false}],
    ruin:[{tier:"Fardeau I",name:"La Note Brisée",trig:"Après 1 défaite.",eff:"Le vœu vacille : -1 au commandement la première manche.",active:false},
          {tier:"Fardeau II",name:"Gorges Ouvertes",trig:"Après 3 défaites, ou la perte du dirigeant.",eff:"Le silence se rompt : l'armée doit charger l'ennemi le plus proche si elle le peut.",active:false}] },
  { id:"necrons", root:"Le Protocole — chaque victoire révèle un fragment de l'ordre qui les a réveillés.",
    asc:[{tier:"Faveur I",name:"Réveil Échelonné",trig:"Après 1 victoire.",eff:"Une fois par bataille, relevez une unité détruite avec un tiers de ses figurines.",active:false},
         {tier:"Faveur II",name:"Convergence",trig:"Après la prise d'un site clé.",eff:"Une unité par bataille peut se redéployer à mi-partie.",active:false}],
    ruin:[{tier:"Fardeau I",name:"Phase Instable",trig:"Après 1 défaite.",eff:"-1 aux jets de réanimation jusqu'au prochain acte.",active:false},
          {tier:"Fardeau II",name:"Dormance",trig:"Après 3 défaites.",eff:"Une unité débute chaque bataille en stase et n'arrive qu'en renfort.",active:false}] },
  { id:"treizieme-cantique", root:"La Note — chaque excès rapproche le Cantique de la fréquence parfaite.",
    asc:[{tier:"Faveur I",name:"Crescendo",trig:"Après 1 victoire.",eff:"+1 au mouvement durant la première manche.",active:true},
         {tier:"Faveur II",name:"L'Accord Parfait",trig:"Après 3 victoires.",eff:"Une arme sonique par bataille impose un test de moral aggravé à sa cible.",active:false}],
    ruin:[{tier:"Fardeau I",name:"Dissonance",trig:"Après 1 défaite.",eff:"Distraite par sa propre douleur, l'armée perd une relance par manche.",active:false},
          {tier:"Fardeau II",name:"Saturation",trig:"Après la perte du dirigeant.",eff:"Une unité aléatoire, submergée d'extase, ne peut agir à la première manche.",active:false}] },
  { id:"custodes", root:"Le Verdict — les Talons d'or appliquent une sentence qu'eux seuls connaissent.",
    asc:[{tier:"Faveur I",name:"Sentence",trig:"Après 1 victoire.",eff:"Désignez un ennemi : relances pour blesser contre lui pendant une manche.",active:false},
         {tier:"Faveur II",name:"Inflexible",trig:"Après avoir défendu un site d'acte.",eff:"Sur un objectif tenu, l'unité ne peut être délogée qu'au corps-à-corps.",active:false}],
    ruin:[{tier:"Fardeau I",name:"Doute",trig:"Après 1 défaite.",eff:"L'ordre scellé vacille : perte d'une relance de commandement.",active:false},
          {tier:"Fardeau II",name:"Le Rite du Sang",trig:"Après la perte d'un site sacré.",eff:"Un Custode se retire pour un rite : -1 figurine d'élite à la prochaine bataille.",active:false}] },
  { id:"krieg", root:"Le Devoir — Krieg ne mesure pas la victoire, mais la durée.",
    asc:[{tier:"Faveur I",name:"Mètre par Mètre",trig:"Après 1 victoire.",eff:"Gagnez un retranchement (couvert) gratuit au déploiement.",active:false},
         {tier:"Faveur II",name:"Sacrifice Calculé",trig:"Après 3 batailles livrées.",eff:"Une fois par partie, sacrifiez une unité pour déclencher un tir d'artillerie.",active:false}],
    ruin:[{tier:"Fardeau I",name:"Saignée",trig:"Après 1 défaite.",eff:"Pertes lourdes : commencez la prochaine bataille avec une unité en moins.",active:true},
          {tier:"Fardeau II",name:"Le Registre s'allonge",trig:"Après 3 défaites.",eff:"Pour avancer, une unité doit subir une perte volontaire chaque manche.",active:false}] },
];

const ARMIES={
  "red-choir":{style:"Agression totale : tout converge vers le corps-à-corps le plus vite possible, pression dès le premier tour.",format:"≈ 2000 pts (provisoire)",roster:[
    {unit:"Vortak, Maître du Chœur",role:"Seigneur de guerre",pts:150},
    {unit:"Berzerkers de Khorne ×2",role:"Troupe",pts:200},
    {unit:"Eightbound",role:"Élite",pts:180},
    {unit:"Maître de meute (monture rapide)",role:"Attaque rapide",pts:160},
    {unit:"Forgefiend",role:"Soutien",pts:150}]},
  "necrons":{style:"Avance implacable et réanimation : encaisser, se relever, reprendre le terrain.",format:"≈ 2000 pts (provisoire)",roster:[
    {unit:"Szareth, Phaeron",role:"Seigneur de guerre",pts:170},
    {unit:"Guerriers Necrons ×2",role:"Troupe",pts:200},
    {unit:"Lychguard",role:"Élite",pts:170},
    {unit:"Spectres Skorpekh",role:"Attaque rapide",pts:150},
    {unit:"Monolithe",role:"Soutien",pts:250}]},
  "treizieme-cantique":{style:"Vitesse et frappes chirurgicales ; les armes soniques brisent le moral avant la lame.",format:"≈ 2000 pts (provisoire)",roster:[
    {unit:"Sigrim le Fourbe, Archisonneur",role:"Seigneur de guerre",pts:160},
    {unit:"Marines du Bruit ×2",role:"Troupe",pts:200},
    {unit:"Lames Sans Défaut",role:"Élite rapide",pts:180},
    {unit:"Extatiques",role:"Élite",pts:150},
    {unit:"Transport blindé",role:"Soutien",pts:200}]},
  "custodes":{style:"Peu de figurines, chacune redoutable : tenir, juger, ne jamais céder.",format:"≈ 2000 pts (provisoire)",roster:[
    {unit:"Aelric, Capitaine-Bouclier",role:"Seigneur de guerre",pts:170},
    {unit:"Garde Custodienne ×2",role:"Troupe",pts:260},
    {unit:"Custodiens Allarus",role:"Élite",pts:200},
    {unit:"Char Caladius",role:"Soutien",pts:200}]},
  "krieg":{style:"Masse d'infanterie et artillerie : creuser, tenir, payer chaque mètre.",format:"≈ 2000 pts (provisoire)",roster:[
    {unit:"Maréchal Kessler & état-major",role:"Seigneur de guerre",pts:100},
    {unit:"Infanterie du Death Korps ×3",role:"Troupe",pts:300},
    {unit:"Équipe d'artillerie",role:"Soutien",pts:120},
    {unit:"Char Leman Russ",role:"Soutien",pts:170},
    {unit:"Sentinelle de reconnaissance",role:"Attaque rapide",pts:80}]},
};

const HEROPATH={
  "red-choir":{intro:"Tant que Vortak n'a pas parlé, sa légende grandit. Chaque haut fait le rapproche du moment où il rompra le silence.",nodes:[
    {tier:"Échelon I",name:"La Première Offrande",trig:"Après avoir tué un personnage ennemi.",eff:"Une fois par bataille, Vortak relance ses jets pour blesser.",active:true},
    {tier:"Échelon II",name:"Le Silence Pèse",trig:"Après avoir survécu à 3 batailles.",eff:"Les ennemis à proximité subissent -1 au commandement.",active:false},
    {tier:"Échelon III",name:"La Parole Retenue",trig:"En atteignant un site du Nœud.",eff:"Une fois par campagne, Vortak « parle » : son unité gagne une activation supplémentaire.",active:false}]},
  "necrons":{intro:"À chaque victoire, un fragment du protocole qui anime Szareth se révèle.",nodes:[
    {tier:"Échelon I",name:"Fragment de Protocole",trig:"Après avoir remporté un objectif.",eff:"Les unités à portée de Szareth améliorent leur réanimation.",active:false},
    {tier:"Échelon II",name:"Commandement Éveillé",trig:"Après avoir survécu à un acte entier.",eff:"Une fois par bataille, relever une unité détruite près de lui.",active:false},
    {tier:"Échelon III",name:"Le Protocole Complet",trig:"À la révélation du Nœud.",eff:"Szareth se reconstitue à chaque manche : presque indestructible.",active:false}]},
  "treizieme-cantique":{intro:"Chaque champ de bataille est une répétition. Sigrim le Fourbe s'approche, mesure après mesure, de l'accord parfait.",nodes:[
    {tier:"Échelon I",name:"Première Mesure",trig:"Après avoir brisé une unité au moral.",eff:"La arme sonique de Sigrim le Fourbe ignore le couvert.",active:true},
    {tier:"Échelon II",name:"Contrepoint",trig:"Après 3 victoires.",eff:"Les unités amies à portée relancent les tests de moral ratés.",active:false},
    {tier:"Échelon III",name:"L'Accord Final",trig:"En atteignant le cœur du Nœud.",eff:"Une fois par campagne, les ennemis proches subissent un test de moral aggravé.",active:false}]},
  "custodes":{intro:"Aelric exécute une sentence dont lui seul connaît les termes. Chaque jugement rendu le rapproche du verdict.",nodes:[
    {tier:"Échelon I",name:"Première Sentence",trig:"Après avoir tué un personnage ennemi.",eff:"Désigner une cible : Aelric la touche et la blesse avec relances.",active:false},
    {tier:"Échelon II",name:"Jugement Rendu",trig:"Après avoir défendu un site.",eff:"Aelric ne peut être réduit à moins d'1 PV par une seule attaque.",active:false},
    {tier:"Échelon III",name:"Le Verdict Scellé",trig:"À l'ouverture de l'ordre de Terra.",eff:"Aelric révèle sa mission : effet de campagne majeur, à définir.",active:false}]},
  "krieg":{intro:"Kessler ne cherche pas la gloire. Il tient. Et tenir, assez longtemps, devient une forme de victoire.",nodes:[
    {tier:"Échelon I",name:"Le Premier Mètre",trig:"Après avoir tenu un objectif une bataille entière.",eff:"L'infanterie proche de Kessler tient les objectifs même en sous-nombre.",active:false},
    {tier:"Échelon II",name:"Inébranlable",trig:"Après avoir survécu à une défaite sans fuir.",eff:"L'état-major de Kessler ne rate jamais son premier test de moral.",active:false},
    {tier:"Échelon III",name:"Jusqu'au Dernier",trig:"À la fin du dernier acte.",eff:"Tant que Kessler vit, la 88e ne peut être contrainte à la retraite.",active:false}]},
};

const REWARDS={
  "red-choir":[
    {obj:"Marée de sang",cond:"Remporter 3 combats au corps-à-corps dans l'acte.",reward:"Frénésie sanctifiée : une charge gratuite par bataille pour toute l'armée.",status:"active"},
    {obj:"Faire taire",cond:"Capturer un site de résonance.",reward:"Les ennemis proches du site capturé subissent la terreur du silence.",status:"todo"},
    {obj:"Pèlerinage",cond:"Atteindre le cœur du Nœud avant toute autre faction.",reward:"Bénédiction du Chœur : récompense de campagne majeure, à définir.",status:"todo"}],
  "necrons":[
    {obj:"Récupération",cond:"Tenir la Ruche Sépulcre durant un acte entier.",reward:"Réanimation accélérée pour toute l'armée.",status:"active"},
    {obj:"Cartographie du protocole",cond:"Remporter une bataille sur trois terrains différents.",reward:"Téléportation stratégique entre les sites contrôlés.",status:"todo"},
    {obj:"Éveil total",cond:"Contrôler 3 sites du Nœud simultanément.",reward:"Réveil d'une unité d'élite supplémentaire (renfort permanent).",status:"todo"}],
  "treizieme-cantique":[
    {obj:"Première sensation",cond:"Briser le moral de 3 unités ennemies.",reward:"Sonance partagée : une arme de l'armée ignore le couvert.",status:"active"},
    {obj:"Captation",cond:"S'emparer d'un site de résonance intact.",reward:"L'armée perçoit la note : avantage d'initiative durable.",status:"todo"},
    {obj:"L'œuvre",cond:"Atteindre le cœur du Nœud.",reward:"Récompense majeure liée à la note parfaite, à définir.",status:"todo"}],
  "custodes":[
    {obj:"Sentence rendue",cond:"Tuer le dirigeant d'une faction adverse.",reward:"Relances pour blesser contre la faction jugée.",status:"todo"},
    {obj:"Rempart",cond:"Défendre un site sacré sans le perdre durant un acte.",reward:"Un site fortifié devient imprenable hors corps-à-corps.",status:"todo"},
    {obj:"L'ordre de Terra",cond:"Survivre jusqu'à l'Acte IV avec Aelric en vie.",reward:"Ouverture de l'ordre scellé : effet décisif de fin de campagne.",status:"todo"}],
  "krieg":[
    {obj:"Premier sang versé",cond:"Tenir une tête de pont une bataille entière.",reward:"Retranchement gratuit à chaque déploiement.",status:"active"},
    {obj:"Guerre d'usure",cond:"Livrer 5 batailles, victoire ou défaite.",reward:"Renforts garantis : une unité d'infanterie revient chaque acte.",status:"todo"},
    {obj:"Le dernier ordre",cond:"Être présent à la résolution du Nœud.",reward:"Frappe d'artillerie de campagne, à définir selon le narratif.",status:"todo"}],
};

const RLAB={done:"Accompli",active:"En cours",todo:"À venir"};

const HEROTABLE={
  "custodes":{
    voie:[
      {fait:"Vaincre un personnage ennemi en combat.", seuil:"2", titre:"Maître-Duelliste", regle:"<b>Verdict Assuré</b> — Aelric gagne 2 Attaques supplémentaires, utilisables uniquement contre des unités de type PERSONNAGE."},
      {fait:"Terminer une bataille en tenant seul un objectif (aucune unité alliée à portée).", seuil:"3", titre:"Le Rempart Immobile", regle:"<b>Le Serment Ne Cède Pas</b> — Aelric ignore les résultats de test de Moral. Une fois par bataille, il ignore un résultat Hors de combat qu'il devrait subir."},
      {fait:"Survivre à une bataille où son unité a été réduite à lui seul.", seuil:"1", titre:"Le Dernier Talon", regle:"<b>Seul Face au Nombre</b> — +1 en Endurance ; son arme gagne Sustained Hits 1 (« Fléau des Multitudes ») tant qu'il combat sans allié à portée de 6&quot;."},
      {fait:"Infliger la mort finale au dirigeant d'une faction rivale.", seuil:"1", titre:"Porteur du Verdict Accompli", regle:"Aelric lit son ordre scellé. Effet unique débloqué narrativement — la scène de révélation détermine la règle exacte."}
    ],
    couronnement:{fait:"Verrouillé jusqu'à l'obtention de 3 des 4 titres ci-dessus.", titre:"Refus de la Terre", regle:"Une fois par bataille, lorsqu'Aelric est réduit à un tiers de ses PV ou moins, sur un 2+ il refuse la mort et récupère D6 PV."},
    malus:[
      {fait:"Voir sa propre unité entièrement détruite alors qu'il survit au combat.", seuil:"2", irr:true, titre:"Le Poids des Talons Perdus", effet:"<b>Le Serment Ne Suffit Plus</b> — Aelric ne peut plus rejoindre d'unité alliée (il combat toujours seul). En contrepartie, il ne peut plus perdre ce titre ; mais tant qu'il n'a pas vaincu un personnage ennemi dans la même bataille, il subit -1 pour toucher."},
      {fait:"Perdre une bataille où il était présent sur le champ.", seuil:"2", titre:"Le Verdict en Doute", effet:"Aelric doit relancer ses jets de Blessure réussis sur un 6 naturel — jusqu'à ce qu'il inflige la mort finale à un personnage ennemi ou détruise entièrement une unité ennemie, auquel cas ce malus est suspendu pour le reste de la campagne."},
      {fait:"Utiliser Refus de la Terre (le revive de son 5ᵉ fait d'arme).", seuil:"3", titre:"Le Prix de l'Immortalité", effet:"Aelric subit -1 en Endurance lors des deux prochaines batailles suivant l'utilisation."}
    ]
  },
  "krieg":{
    voie:[
      {fait:"Infliger la mort de modèles ennemis, cumulés sur toute la campagne, par Kessler lui-même ou son unité (tir et mêlée confondus).", seuil:"10", titre:"Les Chiffres Ne Mentent Pas", regle:"<b>Compte Rendu de Kessler</b> — 10+ kills : 1 unité KRIEG à 9&quot; reçoit 2 Ordres au lieu d'un ; 20+ : 2 unités à 9&quot; ; 40+ : 3 unités à 12&quot;."},
      {fait:"Exécuter sommairement un modèle de sa propre unité ayant échoué un test de Moral ou de Commandement.", seuil:"4", titre:"La Volonté de l'Empereur", regle:"<b>Discipline par l'Exemple</b> — Une fois par bataille, après une exécution : son unité et toute unité KRIEG à 9&quot; réussissent leur prochain test de Moral sur 3+."},
      {fait:"Survivre à une bataille où son unité a été entièrement détruite autour de lui.", seuil:"1", titre:"Le Dernier Homme Debout", regle:"<b>Il Reste Debout</b> — +1 en Endurance, ignore le premier Hors de combat, tant qu'aucune unité KRIEG n'est à 6&quot;."},
      {fait:"Une unité KRIEG de cavalerie commandée par Kessler réussit une charge et survit.", seuil:"4", titre:"Pour l'Empereur", regle:"<b>Le Compte de la Charge</b> — +1F / +1AP / +1D permanent pour cette unité de cavalerie précise."}
    ],
    couronnement:{fait:"Tenir la ligne jusqu'au bout d'une bataille perdue, et avoir débloqué 3 des 4 titres ci-dessus.", titre:"Le Dernier Mètre", regle:"Effet unique, débloqué narrativement."},
    malus:[
      {fait:"Perdre une bataille où Kessler était présent sur le champ.", seuil:"2", titre:"Le Registre S'Alourdit", effet:"-1 aux tests de Moral pour toutes les unités KRIEG à portée de 6&quot; de Kessler — suspendu dès qu'une unité KRIEG s'empare d'un objectif."},
      {fait:"Utiliser La Volonté de l'Empereur (exécution sommaire) un total de 5 fois cumulées sur la campagne.", seuil:"5", irr:true, titre:"Il N'écoute Plus Les Vivants", effet:"Kessler ne peut plus jamais être ciblé par un Ordre lancé par un autre personnage — il n'obéit plus qu'à son propre registre."},
      {fait:"Voir l'unité de cavalerie liée à Pour l'Empereur être entièrement détruite lors d'une bataille.", seuil:"1", titre:"Le Nom Rayé", effet:"Le bonus permanent de Pour l'Empereur (+1F/+1AP/+1D) est perdu pour le reste de la campagne — suspendu si une nouvelle unité de cavalerie KRIEG débloque Pour l'Empereur à son tour."}
    ]
  },
  "necrons":{
    voie:[
      {fait:"PV rendus à l'unité de Szareth par les Reanimation Protocols, cumulés sur toute la campagne.", seuil:"20", titre:"Le Protocole S'Affûte", regle:"<b>Réveil Perpétuel</b> — 20+ : +1 aux jets de Reanimation Protocols. 30+ : relance en plus les jets ratés. 50+ : les unités ÉVEILLÉS à 6&quot; ajoutent aussi 1."},
      {fait:"Détruire un modèle CHARACTER ennemi et « l'inscrire au recensement » (Szareth ou son unité porte le coup fatal).", seuil:"2", titre:"Le Recensement des Vivants", regle:"<b>Ils Sont Classés</b> — contre les CHARACTER, l'unité de Szareth gagne Lethal Hits."},
      {fait:"Terminer une bataille en ayant contrôlé un objectif en permanence, sans jamais le céder.", seuil:"2", titre:"L'Avance Ne Recule Pas", regle:"<b>Marche du Métal Ancien</b> — chaque modèle de l'unité de Szareth compte double pour le contrôle des objectifs (OC)."},
      {fait:"Szareth réduit à un tiers de ses PV ou moins, et survit jusqu'à la fin de la bataille.", seuil:"3", titre:"Le Métal Ne Meurt Pas", regle:"<b>Chair de Nécrodermis</b> — Szareth gagne Feel No Pain 5+, de façon permanente."}
    ],
    couronnement:{fait:"Verrouillé jusqu'à l'obtention de 3 des 4 titres ci-dessus.", titre:"La Convocation Répond", regle:"<b>Rappel Dynastique</b> — une fois par bataille, si Szareth est détruit, il se relève en fin de phase avec la moitié de ses PV, à 3&quot; de sa position (ni charge ni tir ce tour-là)."},
    malus:[
      {fait:"Szareth détruit et retiré du jeu sans se relever (Rappel Dynastique non déclenché ou pas encore débloqué).", seuil:"1", irr:true, titre:"Le Protocole a Failli", effet:"<b>Fêlure dans le Métal Éternel</b> — les jets de Reanimation Protocols de son unité subissent -1 en permanence."},
      {fait:"L'unité de Szareth Falls Back au cours d'une bataille.", seuil:"1", titre:"Le Recul Impensable", effet:"-1 OC lors de sa bataille suivante. Rédemption : levée si son unité contrôle un objectif du début à la fin de cette bataille suivante, sans jamais le céder."},
      {fait:"Un CHARACTER ennemi engagé au corps-à-corps avec Szareth survit et quitte le combat vivant.", seuil:"1", titre:"Le Recensement Inachevé", effet:"Son unité perd Lethal Hits contre les CHARACTER lors de sa bataille suivante. Rédemption : levée dès que Szareth ou son unité détruit un modèle CHARACTER."}
    ]
  },
  "red-choir":{
    voie:[
      {fait:"Infliger la mort de modèles ennemis en corps-à-corps, cumulés sur toute la campagne, par Vortak lui-même ou son unité.", seuil:"10", titre:"Le Chœur Compte Ses Morts", regle:"<b>Litanie du Sang</b> — 10+ : l'unité de Vortak gagne Sustained Hits 1 en mêlée. 20+ : passe à Sustained Hits 2. 40+ : les unités CHŒUR ROUGE à 9&quot; gagnent aussi Sustained Hits 1."},
      {fait:"Remporter un duel contre un modèle CHARACTER ennemi (combat singulier arbitré).", seuil:"2", titre:"Le Duel Ne Se Refuse Pas", regle:"<b>Le Sang Appelle le Sang</b> — contre les CHARACTER uniquement : les jets pour blesser de Vortak obtiennent un critique sur 5+ au lieu de 6+. Vortak gagne également Précision (Precision)."},
      {fait:"Terminer une bataille sans que son unité n'ait jamais Fallen Back.", seuil:"2", titre:"Le Geste Suffit", regle:"<b>Le Silence Commande</b> — aura permanente 6&quot; : les unités CHŒUR ROUGE amies relancent les tests de Battle-shock ratés."},
      {fait:"Terminer une bataille réduit à la moitié de ses blessures ou moins, et survivre jusqu'à la fin de la partie.", seuil:"3", titre:"Le Sang Paie Ses Dettes", regle:"<b>Endurci par le Sacrifice</b> — Vortak gagne Feel No Pain 5+, de façon permanente."}
    ],
    couronnement:{fait:"Verrouillé jusqu'à l'obtention de 3 des 4 titres ci-dessus.", titre:"Le Silence Devient Cri", regle:"<b>Le Cri du Chœur</b> — une fois par bataille, au début d'un round de combat, Vortak et son unité gagnent Fights First pour ce round."},
    malus:[
      {fait:"Vortak ou son unité effectue une attaque à distance au cours d'une bataille.", seuil:"1", irr:true, titre:"Le Silence Trahi", effet:"Vortak perd définitivement l'accès à « Le Silence Commande » (l'aura de relance de Battle-shock ne s'applique plus jamais, même si le titre reste débloqué narrativement)."},
      {fait:"L'unité de Vortak Falls Back alors qu'il est engagé au corps-à-corps avec un modèle CHARACTER ennemi (duel esquivé).", seuil:"1", titre:"Le Duel Refusé", effet:"Vortak subit -1 pour toucher contre les modèles CHARACTER. Rédemption : levée dès que Vortak remporte un duel contre un CHARACTER lors d'une bataille suivante."},
      {fait:"L'unité de Vortak termine une bataille sans avoir tué le moindre modèle ennemi.", seuil:"1", titre:"Le Chœur Muet", effet:"Vortak subit -1 en Force lors de sa bataille suivante. Rédemption : levée si Vortak ou son unité inflige 5 tués ou plus lors de cette bataille suivante."}
    ]
  },
  "treizieme-cantique":{
    voie:[
      {fait:"Détruire entièrement une unité ennemie au tir ou au corps à corps, au cours de la campagne.", seuil:"3", titre:"La Fréquence Parfaite", regle:"<b>Accord Dévastateur</b> — à chaque charge de Sigrim, sur un 4+ l'unité chargée subit D3 Blessures Mortelles."},
      {fait:"Faire rater un test de commandement à une unité ennemie au corps à corps (au contact de Sigrim ou de son unité).", seuil:"2", titre:"Le Cri Qui Fauche", regle:"<b>Terreur Mélodique</b> — une fois par bataille, Sigrim force une unité ennemie à 9&quot; à relancer un test de commandement réussi."},
      {fait:"Achever un PERSONNAGE ennemi (le réduire à 0 PV) au cours d'un même combat.", seuil:"2", titre:"Le Point d'Orgue", regle:"<b>Extase Assumée</b> — chaque fois que l'arme sonique de Sigrim blesse un PERSONNAGE ennemi, sur un 6 elle inflige une Blessure Mortelle supplémentaire."},
      {fait:"Infliger la mort finale au dirigeant d'une faction rivale.", seuil:"1", titre:"Porteur de la Dernière Note", regle:"<b>Symphonie Achevée</b> — une fois par bataille, quand Sigrim achève un PERSONNAGE ennemi ou détruit entièrement une unité, les unités TREIZIÈME CANTIQUE à 6&quot; gagnent +1 pour toucher jusqu'à la fin de la phase."}
    ],
    couronnement:{fait:"Verrouillé jusqu'à l'obtention de 3 des 4 titres ci-dessus.", titre:"L'Apothéose Sonore", regle:"Le rayon de Symphonie Achevée passe de 6&quot; à 9&quot;, et devient : les unités TREIZIÈME CANTIQUE dans le rayon gagnent +1 pour toucher et +1 en Force jusqu'à la fin de la phase."},
    malus:[
      {fait:"À la fin d'un tour du TREIZIÈME CANTIQUE, Sigrim contrôle un objectif.", seuil:"1", irr:true, titre:"Le Sourd à Tout le Reste", effet:"Sigrim n'entend plus que la Note. Il ne peut plus bénéficier des règles spéciales ni des auras d'unités alliées du TREIZIÈME CANTIQUE, et il n'en émet plus lui-même (Symphonie Achevée, L'Apothéose Sonore et tout autre bonus allié sont perdus). En échange, tant qu'il combat, Sigrim gagne +1 pour toucher, +1 pour blesser et +1 en Force."},
      {fait:"Terminer une bataille où l'unité de Sigrim n'a réussi à faire rater aucun test de commandement à l'ennemi.", seuil:"1", titre:"La Note Fausse", effet:"Sigrim doute de son oreille. Terreur Mélodique ne peut plus être utilisée tant que le malus est actif. Rédemption : effacé dès que Sigrim fait rater un test de commandement à une unité ennemie au corps à corps dans une bataille suivante."},
      {fait:"Voir Sigrim réduit Hors de Combat au cours d'une bataille.", seuil:"1", titre:"La Corde Rompue", effet:"Son arme sonique se tait. Accord Dévastateur (si débloqué) est inactif jusqu'à la fin de sa prochaine bataille. Rédemption : la règle revient dès que Sigrim achève un PERSONNAGE ennemi dans cette bataille suivante."}
    ]
  }
};

const BATTLES = [
  { part:"Partie 1", date:"M42.018.036", act:"Acte I", a:"Le Treizième Cantique", b:"La 88e de Krieg", mission:"Saignée", winner:"Le Treizième Cantique", place:"Faille d'Écho" },
  { part:"Partie 2", date:"M42.018.039", act:"Acte I", a:"Les Éveillés", b:"La Garde Cytheréenne", mission:"Reconnaissance en force", winner:"Match nul", place:"Ruche Sépulcre" },
  { part:"Partie 3", date:"M42.018.041", act:"Acte I", a:"Le Chœur Rouge", b:"La 88e de Krieg", mission:"Tête de pont", winner:"Le Chœur Rouge", place:"Plaine de Verre" },
];

const JOURNAL = [
  { date:"M42.018.041", author:"— Rapport du Commissaire Haldenn, 88e de Krieg", title:"Ce que coûte un mètre",
    body:["Nous avons tenu la Plaine de Verre douze heures. Au matin, il n'en restait rien que je puisse appeler une ligne. Ils ne crient pas. C'est cela qu'aucun manuel ne prépare.",
      "J'ai inscrit trois cent quatorze noms au registre des pertes. Le Quartier-Maître m'a demandé si je voulais les arrondir. Je ne les arrondis pas."] },
  { date:"M42.018.036", author:"— Transcription, fréquence non identifiée", title:"La note qui ne s'éteint pas",
    body:["Le capteur a relevé un signal sous le champ de bataille bien après le silence des armes. Une seule note, soutenue, parfaite. Le Magos l'a fait taire trois fois. Trois fois elle est revenue.",
      "Il a fini par ordonner qu'on cesse d'essayer. Il a dit que c'était une réponse."] },
];

const SCORES=(()=>{const m={};FACTIONS.forEach(f=>m[f.name]=0);BATTLES.forEach(x=>{if(m[x.winner]!==undefined)m[x.winner]++;});return m;})();
function el(h){const t=document.createElement('template');t.innerHTML=h.trim();return t.content.firstChild;}
const LOCK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const OPEN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5" y="11" width="14" height="9" rx="1"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>';

function renderFactions(){
  const g=document.getElementById('factionGrid'); g.innerHTML='';
  FACTIONS.forEach(f=>g.appendChild(el(`<a class="card" data-go="/factions/${f.id}" style="--c:${f.c}">
    <span class="tag">${f.tag}</span><h3>${f.name}</h3><div class="real">${f.real}</div>
    <p>${f.lore[0].slice(0,120)}…</p><div class="more">Ouvrir le dossier →</div></a>`)));
}
function renderFactio(id){
  const f=FACTIONS.find(x=>x.id===id), d=document.getElementById('factioDetail');
  if(!f){d.className='sec factio';d.innerHTML='<a class="back" data-go="/factions">← Tous les dossiers</a><p>Dossier introuvable.</p>';return;}
  d.className='sec factio factio-'+id;
  d.style.setProperty('--c',f.c);
  const mode=heroMode(id);
  d.innerHTML=`<a class="back" data-go="/factions">← Tous les dossiers</a>
    <div class="factio-fx" aria-hidden="true"></div>
    <span class="eyebrow" style="color:${f.c}">${f.tag}</span>
    <h2>${f.name}<span class="accentbar"></span></h2>
    <div class="meta"><span class="chip">${f.real}</span></div>
    <div class="subhead">Lore</div>
    <div class="lore">${f.lore.map(p=>`<p>${p}</p>`).join('')}</div>
    <div class="subhead">Dirigeant</div>
    <div class="leader">
      <div class="portrait"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="${f.c}" stroke-width="1"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".6"/><circle cx="12" cy="12" r="10.5" opacity=".3"/></svg></div>
      <div><div class="lname">${f.leader.name}</div><div class="ltitle">${f.leader.title}</div>
        <p class="lbio">${f.leader.bio}</p>
        <div class="traits">${f.leader.traits.map(t=>`<span>${t}</span>`).join('')}</div></div>
    </div>
    ${HEROTABLE[f.id] ? heroTableHTML(f.id, mode) : heroPathHTML(f.id)}
    ${armyHTML(f.id)}
    <div class="subhead">Récompenses de campagne</div>
    ${rewardsHTML(f.id)}
    <div class="subhead">Rôle dans la campagne</div>
    <div class="role"><p>${f.role}</p></div>
    <p class="note">Dirigeant, voie du héros, armée et récompenses provisoires — à valider.</p>`;
  if(mode!=='static' && HEROTABLE[id]) buildRecap(id, mode==='edit' ? (ME.progress[id]||{}) : (ALLPROG[id]||{}));
}
function renderActs(){
  const l=document.getElementById('actsList'); l.innerHTML='';
  ACTS.forEach(a=>{
    if(a.locked){
      l.appendChild(el(`<div class="act-card sealed" data-go="/actes/${a.id}">
        <div class="num">${a.num}</div><h3>${a.title}</h3><p>${a.teaser}</p>
        <div class="seal locked">${LOCK} Scellé</div></div>`));
    } else {
      l.appendChild(el(`<div class="act-card" data-go="/actes/${a.id}">
        <div class="num">${a.num}</div><h3>${a.title}</h3><p>${a.teaser}</p>
        <div class="seal open">${OPEN} Ouvert · lire</div></div>`));
    }
  });
}
function renderActe(id){
  const a=ACTS.find(x=>x.id===id), d=document.getElementById('acteDetail');
  if(!a){d.innerHTML='<a class="back" data-go="/actes">← Tous les actes</a><p>Acte introuvable.</p>';return;}
  if(a.locked){
    d.innerHTML=`<a class="back" data-go="/actes">← Tous les actes</a>
      <span class="eyebrow">${a.num}</span><h2 style="color:var(--bone-dim)">${a.title}</h2><span class="accentbar" style="background:var(--bone-dim);box-shadow:none"></span>
      <div class="block"><div class="seal locked" style="font-size:.8rem">${LOCK} Acte scellé</div>
      <p style="color:var(--bone-dim);max-width:680px;margin-top:14px">${a.teaser}</p>
      <p class="note">Cet acte n'est pas encore ouvert. Son contenu n'existera côté joueurs qu'au moment où le maître de campagne le publiera.</p></div>`;
    return;
  }
  d.innerHTML=`<a class="back" data-go="/actes">← Tous les actes</a>
    <span class="eyebrow">${a.num}</span><h2>${a.title}<span class="accentbar"></span></h2>
    <div class="subhead">Ouverture · lore canonique</div>
    <div class="lore block">${a.lore.map(p=>`<p>${p}</p>`).join('')}</div>
    <div class="subhead">État de campagne · conséquences</div>
    <div class="panel">${a.state.map(s=>`<p>${s}</p>`).join('')}</div>
    <p class="adapt">Cette section évolue selon les résultats des batailles ; l'ouverture, elle, reste fixe.</p>`;
}
function renderBattles(){
  const host=document.getElementById('battleHistory'); host.innerHTML='';
  ACTS.forEach(a=>{
    const list=BATTLES.filter(b=>b.act===a.num);
    let rows;
    if(list.length){
      rows=list.map(x=>{const draw=x.winner==='Match nul';
        return `<div class="brow">
          <div class="bpart">${x.part||''}</div>
          <div class="bmain"><div class="bvs">${x.a} <span class="vs">vs</span> ${x.b}</div>
            <div class="bmeta">${x.mission} · ${x.place} · ${x.date}</div></div>
          <div class="bres">${draw?'<span class="bdraw">Match nul</span>':`<span class="win">${x.winner}</span>`}</div>
        </div>`;}).join('');
    } else {
      rows=`<div class="bempty">Aucune bataille consignée${a.locked?' · acte scellé':''}.</div>`;
    }
    host.appendChild(el(`<div class="bact"><div class="bact-h"><span class="ba-num">${a.num}</span><span class="ba-title">${a.title}</span></div>${rows}</div>`));
  });
  const s=document.getElementById('standings'); s.innerHTML='';
  const max=Math.max(1,...Object.values(SCORES));
  FACTIONS.forEach(f=>{const v=SCORES[f.name]||0,w=Math.round(v/max*100);
    s.appendChild(el(`<div><div class="standrow"><div class="nm"><span class="dot" style="background:${f.c}"></span>${f.name}</div><span class="v">${v} V</span></div>
      <div class="bar-bg"><i style="width:${Math.max(4,w)}%;background:${f.c}"></i></div></div>`));});
}
function renderJournal(){
  const j=document.getElementById('journalBody'); j.innerHTML='';
  JOURNAL.forEach(e=>j.appendChild(el(`<article class="entry"><div class="ehead"><span class="edate">${e.date}</span><span class="eauth">${e.author}</span></div>
    <h3>${e.title}</h3>${e.body.map(p=>`<p>${p}</p>`).join('')}</article>`)));
}

function heroTableHTML(id, mode){
  const h=HEROTABLE[id]; if(!h) return '';
  const track = mode==='edit' || mode==='view';
  const editable = mode==='edit';
  const prog = mode==='edit' ? (ME.progress[id]||{}) : (mode==='view' ? (ALLPROG[id]||{}) : {});
  const entry=(r,kind,i)=>{
    const isM=kind==='m';
    if(!track){
      return `<div class="hrow ${isM?'malusrow':''}">
        <div class="hrow-h"><span class="htitre">${r.titre}</span><span class="hseuil ${isM?'malseuil':''}">Seuil ${r.seuil}${r.irr?' · irréversible':''}</span></div>
        <div class="hfait"><span class="hlab">Fait d'arme${isM?' négatif':''}</span>${r.fait}</div>
        <div class="hregle">${isM?r.effet:r.regle}</div></div>`;
    }
    const key=kind+i, seuil=parseInt(r.seuil,10)||1, count=prog[key]||0;
    const unlocked=count>=seuil, p=Math.min(count/seuil,1);
    const ctrl = editable ? `<button class="tbtn minus" aria-label="Retirer">−</button><button class="tbtn plus" aria-label="Ajouter">+</button>` : '';
    return `<div class="hrow ${isM?'malusrow':''} track ${unlocked?'unlocked':''}" data-fac="${id}" data-kind="${kind}" data-key="${key}" data-seuil="${seuil}" style="--p:${p}">
      <div class="hrow-h">
        <span class="htitre">${r.titre}</span>
        <span class="hstate">
          <span class="hbadge">${isM?'Subi':'Débloqué'}</span>
          <span class="hcount"><b class="cval">${count}</b> / ${seuil}</span>
          ${ctrl}
        </span>
      </div>
      <div class="hseuil-line"><span class="hseuil ${isM?'malseuil':''}">Seuil ${r.seuil}${r.irr?' · irréversible':''}</span></div>
      <div class="hfait"><span class="hlab">Fait d'arme${isM?' négatif':''}</span>${r.fait}</div>
      <div class="hregle">${isM?r.effet:r.regle}</div></div>`;
  };
  const voie=h.voie.map((r,i)=>entry(r,'v',i)).join('');
  const malus=h.malus.map((r,i)=>entry(r,'m',i)).join('');
  const cr=h.couronnement; let crown='';
  if(cr){
    if(track){
      const n=h.voie.reduce((a,r,i)=>a+(((prog['v'+i]||0)>=(parseInt(r.seuil,10)||1))?1:0),0), on=n>=3;
      crown=`<div class="hrow crown ${on?'unlocked':'locked'}" data-fac="${id}" data-kind="crown">
        <div class="hrow-h"><span class="htitre">${cr.titre}</span><span class="hseuil crownseuil">Couronnement</span></div>
        <div class="hfait"><span class="hlab">Déblocage</span>${cr.fait}</div>
        <div class="hregle">${cr.regle}</div>
        <div class="crownstate">${on?'✦ Couronnement débloqué — 3 titres obtenus':('Verrouillé — '+Math.min(n,3)+'/3 titres requis')}</div></div>`;
    } else {
      crown=`<div class="hrow crown">
        <div class="hrow-h"><span class="htitre">${cr.titre}</span><span class="hseuil crownseuil">Couronnement</span></div>
        <div class="hfait"><span class="hlab">Déblocage</span>${cr.fait}</div>
        <div class="hregle">${cr.regle}</div></div>`;
    }
  }
  const adminOther = ME.role==='admin' && (ME.factions||[]).indexOf(id)<0;
  const banner = mode==='view'
    ? `<div class="gmview">Vue maître de campagne — progression réelle du joueur · lecture seule</div>`
    : (adminOther && mode==='edit'
        ? `<div class="gmview">Bac à sable — test des effets · sans impact sur la progression réelle du joueur</div>`
        : '');
  const recap = track ? `<div id="recap-${id}" class="recap"></div>` : '';
  return `<div class="subhead">Voie du héros</div>
    ${banner}${recap}
    <div class="herotable" data-fac="${id}">${voie}${crown}</div>
    <div class="subhead">Tableau des malus</div>
    <div class="herotable" data-fac="${id}">${malus}</div>`;
}
function heroPathHTML(id){
  const h=HEROPATH[id]; if(!h) return '';
  const node=n=>`<div class="node hero ${n.active?'active':'locked'}">
    <div class="tier"><span>${n.tier}</span><span class="state">${n.active?'Atteint':'À débloquer'}</span></div>
    <div class="nm">${n.name}</div><p class="trig">${n.trig}</p><p class="eff">${n.eff}</p></div>`;
  return `<div class="subhead">Voie du héros</div>
    <p class="hero-intro">${h.intro}</p>
    <div class="heropath"><div class="path">${h.nodes.map(node).join('')}</div></div>`;
}
function rewardsHTML(id){
  const r=REWARDS[id]; if(!r) return '';
  return `<div class="rewards">${r.map(o=>`<div class="reward ${o.status}">
    <div class="rhead"><span class="rstatus">${RLAB[o.status]}</span><span class="robj">${o.obj}</span></div>
    <p class="rcond">${o.cond}</p>
    <div class="rgain"><span class="rg-l">Récompense</span>${o.reward}</div></div>`).join('')}</div>`;
}
function armyHTML(id){
  const a=ARMIES[id]; if(!a) return '';
  const tot=a.roster.reduce((s,u)=>s+u.pts,0);
  const rows=a.roster.map(u=>`<div class="rrow"><div class="rleft"><span class="ru">${u.unit}</span><span class="rr">${u.role}</span></div><span class="rp">${u.pts} pts</span></div>`).join('');
  return `<div class="subhead">Armée</div>
    <p class="army-style">${a.style}</p>
    <div class="army-meta">Ordre de bataille · ${a.format} · total indicatif ${tot} pts</div>
    <div class="roster">${rows}</div>`;
}
function destineeHTML(id){
  const d=DESTINEES.find(x=>x.id===id); if(!d) return '';
  const node=(n,kind)=>`<div class="node ${kind} ${n.active?'active':'locked'}">
    <div class="tier"><span>${n.tier}</span><span class="state">${n.active?'Atteint':'À débloquer'}</span></div>
    <div class="nm">${n.name}</div><p class="trig">${n.trig}</p><p class="eff">${n.eff}</p></div>`;
  return `<div class="rootnode"><span class="rl">Racine</span>${d.root}</div>
    <div class="branches">
      <div class="branch asc"><h4>Voie de l'Ascension · Faveurs</h4><div class="path">${d.asc.map(n=>node(n,'asc')).join('')}</div></div>
      <div class="branch ruin"><h4>Voie de la Ruine · Fardeaux</h4><div class="path">${d.ruin.map(n=>node(n,'ruin')).join('')}</div></div>
    </div>`;
}
const VIEWS={'/':'v-accueil','/factions':'v-factions','/actes':'v-actes','/batailles':'v-batailles'};
function show(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id===id));}
function setActive(r){document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('data-go')===r));}
function go(route){
  if(!route)route='/';
  const p=route.split('/').filter(Boolean);
  if(p[0]==='factions'&&p[1]){renderFactio(p[1]);show('v-factio');setActive('/factions');}
  else if(p[0]==='actes'&&p[1]){renderActe(p[1]);show('v-acte');setActive('/actes');}
  else{const base='/'+(p[0]||'');show(VIEWS[base]||'v-accueil');setActive(p[0]?base:'/');}
  CUR=route;
  try{window.scrollTo(0,0);}catch(e){}
}
document.addEventListener('click',e=>{
  const tb=e.target.closest('.tbtn');
  if(tb){ e.preventDefault(); const row=tb.closest('.hrow.track'); if(row) adjustEntry(row, tb.classList.contains('plus')?1:-1); return; }
  const j=e.target.closest('[data-jump]');
  if(j){e.preventDefault();const t=document.getElementById(j.getAttribute('data-jump'));if(t)t.scrollIntoView({behavior:'smooth',block:'start'});return;}
  const t=e.target.closest('[data-go]');if(!t)return;e.preventDefault();go(t.getAttribute('data-go'));
});
renderFactions();renderActs();renderBattles();go('/');initAuth();
