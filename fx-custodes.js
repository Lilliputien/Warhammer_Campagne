/* ============================================================
   CYTHEREA — EFFETS VALIDÉS · FACTION CUSTODES
   Proposition E du bac à sable (octobre 2026) :
   - socle « Apothéose liturgique » : ouverture, dévoilement au
     défilement, parallaxe du fond, constellation de fond, titres
     qui s'ouvrent, compteurs qui défilent, malus qui tremblent ;
   - couronnement : le Sceau de Terra se trace puis s'abat sur le
     coin de la ligne, encadré d'orfèvrerie, lettrine enluminée et
     texte réécrit ligne à ligne ; révocation : le cachet se fend ;
   - survol « Filet ».
   Actif uniquement sur la page de la faction Custodes. Appelé par
   script.js : CytFX.onView() à la fin de go(), CytFX.onAdjust()
   dans adjustEntry(). Sans GSAP (CDN coupé) : ne fait rien.
   Respecte « réduire les animations » : états finaux sans mouvement.
   ============================================================ */
(function(){
  "use strict";
  const NOOP = { onView(){}, onAdjust(){} };
  if (typeof window.gsap === "undefined") { window.CytFX = NOOP; return; }
  const PL = ["SplitText","DrawSVGPlugin","ScrollToPlugin","ScrollTrigger"];
  gsap.registerPlugin(...PL.filter(n => window[n]).map(n => window[n]));
  const HAS = { split: !!window.SplitText, draw: !!window.DrawSVGPlugin, sto: !!window.ScrollToPlugin, st: !!window.ScrollTrigger };

  const FAC = "custodes";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [].slice.call((r || document).querySelectorAll(s));
  const GOLD = "#DDB64F", BRIGHT = "#F2D788", PALE = "#FFF1C9", DEEP = "#7C6024", INK = "#13100A", ASH = "#B9ADA2", ASHD = "#8E8279";
  const NS = "http://www.w3.org/2000/svg";
  const STAR = "M12 2.5l2.4 7.1 7.1 2.4-7.1 2.4L12 21.5l-2.4-7.1L2.5 12l7.1-2.4z";
  let uid = 0; const nid = p => "fx" + p + (++uid);
  function sv(tag, attrs, parent){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  const osReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const anim = () => !osReduce.matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  /* Mode allégé : petits appareils, peu de cœurs, ou fluidité mesurée trop basse
     (voir bgLoop). Le fond animé devient une image fixe et la parallaxe à la
     souris est coupée ; tout le reste est conservé. Mémorisé pour la session. */
  let LIGHT = (navigator.hardwareConcurrency || 8) <= 4 || window.matchMedia("(max-width: 760px)").matches;
  try { if (sessionStorage.getItem("cytfx-light") === "1") LIGHT = true; } catch(e){}

  /* ---------- couches ---------- */
  let MAIN, VEIL, FST, DST, BC, bx, FLASH;
  function layers(){
    if (BC) return;
    MAIN = $("main.wrap");
    VEIL = document.createElement("div"); VEIL.id = "fxveil"; VEIL.setAttribute("aria-hidden", "true");
    DST = sv("svg", { id: "fxdstage", "aria-hidden": "true" });
    FST = sv("svg", { id: "fxfstage", "aria-hidden": "true" });
    MAIN.prepend(FST); MAIN.prepend(DST); MAIN.prepend(VEIL);
    FLASH = document.createElement("div"); FLASH.id = "fxflash"; FLASH.setAttribute("aria-hidden", "true");
    BC = document.createElement("canvas"); BC.id = "fxburst"; BC.setAttribute("aria-hidden", "true");
    document.body.appendChild(FLASH); document.body.appendChild(BC);
    bx = BC.getContext("2d"); sizeBurst();
    window.addEventListener("resize", sizeBurst);
  }
  function sizeBurst(){ const d = LIGHT ? 1 : Math.min(2, window.devicePixelRatio || 1); BC.width = innerWidth * d; BC.height = innerHeight * d; BC.style.width = innerWidth + "px"; BC.style.height = innerHeight + "px"; bx.setTransform(d, 0, 0, d, 0, 0); }

  /* ---------- outils : particules, anneaux, flash, secousse ---------- */
  let P = [], braf = 0;
  const vrect = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
  const mrect = el => { const m = MAIN.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - m.left, y: r.top - m.top, w: r.width, h: r.height, cx: r.left - m.left + r.width / 2, cy: r.top - m.top + r.height / 2 }; };
  function burst(x, y, o){
    const n = o.n || 20;
    for (let i = 0; i < n; i++) {
      const a = (o.angle != null ? o.angle : -Math.PI / 2) + (Math.random() - 0.5) * (o.spread != null ? o.spread : Math.PI * 2);
      const sp = (o.speed || 3) * (0.35 + Math.random() * 0.9), life = (o.life || 50) * (0.6 + Math.random() * 0.6);
      P.push({ x: x + (Math.random() - 0.5) * (o.jx || 0), y: y + (Math.random() - 0.5) * (o.jy || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: o.g != null ? o.g : 0.06, drag: o.drag || 0.96, life, max: life, size: (o.size || 2) * (0.5 + Math.random()),
        c: o.colors[Math.floor(Math.random() * o.colors.length)], shape: o.shape || "dot", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.25, ph: Math.random() * 6 });
    }
    if (!braf) braf = requestAnimationFrame(tick);
  }
  function tick(){
    bx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.vx *= q.drag; q.vy = q.vy * q.drag + q.g; q.life--; q.rot += q.vr;
      if (q.shape === "leaf") q.x += Math.sin(q.life * 0.06 + q.ph) * 0.7;
      q.x += q.vx; q.y += q.vy;
      if (q.life <= 0) { P.splice(i, 1); continue; }
      bx.globalAlpha = Math.max(0, Math.min(1, q.life / q.max * 1.6));
      bx.fillStyle = q.c; bx.strokeStyle = q.c;
      if (q.shape === "diamond") { bx.save(); bx.translate(q.x, q.y); bx.rotate(Math.PI / 4 + q.rot * 0.2); bx.lineWidth = 0.8; bx.strokeRect(-q.size, -q.size, q.size * 2, q.size * 2); bx.restore(); }
      else if (q.shape === "leaf") { bx.save(); bx.translate(q.x, q.y); bx.rotate(q.rot); bx.scale(1, Math.abs(Math.sin(q.life * 0.08 + q.ph)) * 0.8 + 0.2); bx.fillRect(-q.size, -q.size * 0.6, q.size * 2, q.size * 1.2); bx.restore(); }
      else { bx.beginPath(); bx.arc(q.x, q.y, q.size, 0, Math.PI * 2); bx.fill(); }
    }
    bx.globalAlpha = 1;
    braf = P.length ? requestAnimationFrame(tick) : 0;
  }
  function ring(x, y, o){
    const d = document.createElement("div"); d.className = "fxring" + (o.square ? " sq" : "");
    d.style.left = x + "px"; d.style.top = y + "px"; if (o.color) d.style.borderColor = o.color;
    document.body.appendChild(d);
    gsap.fromTo(d, { scale: 0.2, opacity: o.op || 0.9, rotation: o.square ? 45 : 0 }, { scale: o.scale || 6, opacity: 0, rotation: o.square ? 135 : 0, duration: o.dur || 0.8, delay: o.delay || 0, ease: "expo.out", onComplete: () => d.remove() });
  }
  function flash(peak, dur, color){ FLASH.style.background = color || "var(--accent)"; gsap.fromTo(FLASH, { opacity: 0 }, { keyframes: [{ opacity: peak, duration: dur * 0.2, ease: "power2.out" }, { opacity: 0, duration: dur * 0.8, ease: "power2.inOut" }] }); }
  function shake(el, amp, dur){ gsap.fromTo(el, { x: 0 }, { keyframes: { x: [-amp, amp, -amp * 0.6, amp * 0.35, -amp * 0.15, 0] }, duration: dur || 0.34, ease: "none", clearProps: "x" }); }

  /* ---------- état de la page ---------- */
  let ROOT = null, CR = null, DECO = null, active = false;
  const CROWNED = { on: false, tl: null, splits: [], persist: [], subs: [] };
  const sub = t => { CROWNED.subs.push(t); return t; };
  let pendingCrown = null;

  function seuilOf(r){ return parseInt(r.seuil, 10) || 1; }
  function titlesOwned(){
    const h = (typeof HEROTABLE !== "undefined") ? HEROTABLE[FAC] : null;
    const prog = (typeof ME !== "undefined" && ME.progress && ME.progress[FAC]) || {};
    if (!h) return 0;
    return h.voie.reduce((a, r, i) => a + ((prog["v" + i] || 0) >= seuilOf(r) ? 1 : 0), 0);
  }
  function progOf(key){ try { return (ME.progress[FAC] && ME.progress[FAC][key]) || 0; } catch(e){ return 0; } }
  const crownText = n => n >= 3 ? "✦ Couronnement débloqué — 3 titres obtenus" : "Verrouillé — " + Math.min(n, 3) + "/3 titres requis";

  /* ---------- enrichissement du DOM rendu par script.js ---------- */
  function enhance(){
    const h2 = $("h2", ROOT);
    if (h2 && !$(".fx-fname", h2)) {
      const tn = [].slice.call(h2.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
      if (tn) { const s = document.createElement("span"); s.className = "fx-fname"; s.textContent = tn.textContent; h2.replaceChild(s, tn); }
    }
    $$(".hrow.track", ROOT).forEach(row => {
      if (row.dataset.fx) return; row.dataset.fx = "1";
      row.insertAdjacentHTML("afterbegin", '<i class="fx-sweep t" aria-hidden="true"></i><i class="fx-sweep b" aria-hidden="true"></i><i class="fx-line t" aria-hidden="true"></i><i class="fx-line b" aria-hidden="true"></i>');
      const cv = $(".cval", row);
      if (cv && !cv.parentNode.classList.contains("fx-cwin")) { const w = document.createElement("span"); w.className = "fx-cwin"; cv.parentNode.insertBefore(w, cv); w.appendChild(cv); }
    });
    CR = $(".hrow.crown[data-fac]", ROOT);
    if (CR && !$(".fx-deco", CR)) {
      DECO = document.createElement("div"); DECO.className = "fx-deco"; DECO.setAttribute("aria-hidden", "true"); CR.prepend(DECO);
      const t = $(".htitre", CR), txt = t ? t.textContent : "";
      if (t && txt.length > 1) t.innerHTML = '<span class="fx-lslot"></span><span class="fx-L">' + txt.charAt(0) + "</span>" + txt.slice(1);
    } else DECO = CR ? $(".fx-deco", CR) : null;
    const por = $(".leader .portrait svg", ROOT);
    if (por) { const c = $$("circle", por); if (c[1]) c[1].setAttribute("stroke-dasharray", "3 2.2"); if (c[2]) c[2].setAttribute("stroke-dasharray", "1.2 3"); }
  }

  /* ---------- socle : titres, compteurs, malus ---------- */
  const palette = row => row.classList.contains("malusrow") ? [ASH, ASHD, "#D8CDB4"] : [GOLD, BRIGHT, PALE];
  function unlockFX(row, btn){
    if (!anim()) return;
    const badge = $(".hbadge", row), isM = row.classList.contains("malusrow"), t = $(".fx-sweep.t", row), b = $(".fx-sweep.b", row);
    gsap.fromTo(badge, { clipPath: "inset(0 50% 0 50%)", letterSpacing: ".7em", opacity: 0 }, { clipPath: "inset(0 0% 0 0%)", letterSpacing: ".18em", opacity: 1, duration: 0.6, ease: "expo.out", clearProps: "clipPath,letterSpacing,opacity" });
    gsap.timeline().fromTo([t, b], { scaleX: 0, opacity: 1, transformOrigin: "50% 50%" }, { scaleX: 1, duration: 0.75, ease: "expo.out" }).to([t, b], { opacity: 0, duration: 0.7, ease: "power1.inOut" }, "-=0.15");
    const c = vrect(btn || badge);
    if (isM) {
      shake(row, 5, 0.36);
      burst(c.cx, c.cy, { n: 28, colors: palette(row), speed: 1.6, g: 0.08, spread: Math.PI * 1.3, angle: Math.PI / 2, size: 1.5, life: 70 });
      flash(0.09, 0.8, ASHD);
      return;
    }
    burst(c.cx, c.cy - 40, { n: 22, colors: [GOLD, BRIGHT, PALE], speed: 0.5, g: 0.025, angle: Math.PI / 2, spread: 1.4, shape: "leaf", size: 2.2, life: 130, jx: 80, drag: 0.99 });
    ring(c.cx, c.cy, { scale: 7, dur: 1 });
    burst(c.cx, c.cy, { n: 10, colors: palette(row), speed: 1.6, g: 0, shape: "diamond", size: 2.2, life: 70, drag: 0.965 });
  }
  function lockFX(row, done){
    const badge = $(".hbadge", row);
    if (!anim() || !badge) { done(); return; }
    const c = vrect(badge);
    gsap.to(badge, { clipPath: "inset(0 50% 0 50%)", letterSpacing: ".6em", duration: 0.4, ease: "power3.in", onComplete: () => { gsap.set(badge, { clearProps: "all" }); done(); } });
    ring(c.cx, c.cy, { scale: 4, dur: 0.6, color: DEEP });
  }
  function counterFX(row, dir, btn){
    if (!anim()) return;
    const el = $(".cval", row), hc = $(".hcount", row);
    if (el) gsap.fromTo(el, { yPercent: dir > 0 ? 100 : -100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.42, ease: "expo.out", overwrite: true });
    if (hc) gsap.fromTo(hc, { color: row.classList.contains("malusrow") ? ASH : BRIGHT, scale: 1.22 }, { color: "#A99C82", scale: 1, duration: 0.7, ease: "elastic.out(1,0.5)", clearProps: "color,scale" });
    if (btn) gsap.fromTo(btn, { scale: 0.84 }, { scale: 1, duration: 0.45, ease: "elastic.out(1,0.45)", clearProps: "scale" });
  }

  /* ============================================================
     COURONNEMENT
     ============================================================ */
  function prepStage(){
    FST.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    const w = MAIN.offsetWidth, h = MAIN.scrollHeight;
    DST.setAttribute("width", w); DST.setAttribute("height", h); DST.setAttribute("viewBox", `0 0 ${w} ${h}`);
    DST.style.width = w + "px"; DST.style.height = h + "px";
  }
  let SEALBOX = null;
  function cleanStage(){
    if (!FST) return;
    FST.innerHTML = ""; DST.innerHTML = "";
    if (SEALBOX) { SEALBOX.remove(); SEALBOX = null; }
    gsap.killTweensOf(VEIL); gsap.set(VEIL, { opacity: 0 });
    $$(".onstage").forEach(e => e.classList.remove("onstage"));
    CROWNED.splits.forEach(s => s.revert()); CROWNED.splits = [];
    document.documentElement.style.scrollBehavior = "";
  }
  function clearPersist(){
    CROWNED.persist.forEach(t => t.kill()); CROWNED.persist = [];
    if (!CR || !DECO) return;
    DECO.innerHTML = "";
    CR.classList.remove("fx-crowned");
    const slot = $(".fx-lslot", CR), L = $(".fx-L", CR), hf = $(".hfait", CR), hr = $(".hregle", CR);
    gsap.killTweensOf([slot, L, CR, hf, hr].filter(Boolean));
    if (slot) slot.innerHTML = "";
    gsap.set([slot, L, hf, hr].filter(Boolean), { clearProps: "all" });
  }
  function commit(on){
    if (!CR) return;
    CR.classList.toggle("unlocked", on); CR.classList.toggle("locked", !on);
    const st = $(".crownstate", CR); if (st) st.textContent = crownText(on ? Math.max(3, titlesOwned()) : Math.min(2, titlesOwned()));
  }
  function writeState(delay){
    const st = $(".crownstate", CR);
    if (!st || !HAS.split) return;
    const sp = SplitText.create(st, { type: "chars" }); CROWNED.splits.push(sp);
    gsap.from(sp.chars, { opacity: 0, y: 4, duration: 0.45, stagger: 0.016, ease: "power2.out", delay: (delay || 0) + 0.15 });
  }
  function focusCrown(tl, frac){
    if (!HAS.sto) return;
    const r = CR.getBoundingClientRect(), target = window.scrollY + r.top - innerHeight * frac + r.height / 2;
    if (Math.abs(target - window.scrollY) > 40) {
      tl.add(() => { document.documentElement.style.scrollBehavior = "auto"; });
      tl.to(window, { scrollTo: { y: Math.max(0, target), autoKill: false }, duration: 0.9, ease: "power3.inOut" });
    }
  }

  /* sceau, cachet, encadré, lettrine
     k = pixels par unité du sceau : les épaisseurs sont exprimées en pixels écran.
     Le sceau de la cérémonie est un SVG fixe dans un conteneur HTML que l'on
     déplace, tourne et réduit en CSS : la carte graphique s'en charge sans
     redessiner le SVG (c'était la cause du ralentissement). */
  function buildSeal(parent, opts){
    opts = opts || {};
    const k = opts.k || 1, sw = px => (px / k).toFixed(3);
    const g = sv("g", {}, parent), els = {};
    const st = opts.nss ? { fill: "none", stroke: BRIGHT, "vector-effect": "non-scaling-stroke" } : { fill: "none", stroke: BRIGHT };
    const W = px => opts.nss ? px : sw(px);
    els.disc = sv("circle", { r: 100, fill: INK, opacity: opts.disc ? 0.94 : 0 }, g);
    els.c1 = sv("circle", Object.assign({ r: 98, "stroke-width": W(1.2) }, st), g);
    els.c2 = sv("circle", Object.assign({ r: 92, "stroke-width": W(0.6), "stroke-dasharray": "1 4", opacity: 0.7 }, st), g);
    // les 72 graduations forment un seul tracé : un seul élément à animer au lieu de 72
    let dS = "", dL = "";
    for (let i = 0; i < 72; i++) {
      const a = i * 5 * Math.PI / 180, long = i % 9 === 0, r1 = long ? 76 : 84;
      const seg = `M${(Math.cos(a) * r1).toFixed(2)} ${(Math.sin(a) * r1).toFixed(2)}L${(Math.cos(a) * 89).toFixed(2)} ${(Math.sin(a) * 89).toFixed(2)}`;
      if (long) dL += seg; else dS += seg;
    }
    els.ticks = sv("path", Object.assign({ d: dS, "stroke-width": W(0.5) }, st), g);
    els.ticksL = sv("path", Object.assign({ d: dL, "stroke-width": W(1.1) }, st), g);
    const defs = sv("defs", {}, g), pid = nid("ins");
    sv("path", { id: pid, d: "M -70 0 A 70 70 0 1 1 70 0 A 70 70 0 1 1 -70 0" }, defs);
    const txtAttrs = { fill: BRIGHT, "font-family": "Marcellus, Georgia, serif", "font-size": 8, "letter-spacing": 2 };
    if (opts.mask) {
      const mid = nid("msk");
      const mask = sv("mask", { id: mid, maskUnits: "userSpaceOnUse", x: -110, y: -110, width: 220, height: 220 }, defs);
      els.mc = sv("circle", { r: 70, fill: "none", stroke: "#fff", "stroke-width": 18, transform: "rotate(180)" }, mask);
      txtAttrs.mask = `url(#${mid})`;
    }
    els.txt = sv("text", txtAttrs, g);
    const tp = sv("textPath", { href: "#" + pid, textLength: 436, lengthAdjust: "spacing" }, els.txt);
    tp.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#" + pid);
    tp.textContent = "IN NOMINE IMPERATORIS ✦ VERITAS ✦ FIDES ✦ CUSTODES ✦ ";
    els.c3 = sv("circle", Object.assign({ r: 60, "stroke-width": W(1) }, st), g);
    const sq = a0 => [0, 1, 2, 3].map(j => { const a = (a0 + j * 90) * Math.PI / 180; return (Math.cos(a) * 58).toFixed(2) + "," + (Math.sin(a) * 58).toFixed(2); }).join(" ");
    els.sq1 = sv("polygon", Object.assign({ points: sq(45), "stroke-width": W(0.9) }, st), g);
    els.sq2 = sv("polygon", Object.assign({ points: sq(0), "stroke-width": W(0.9) }, st), g);
    els.star = sv("path", Object.assign({ d: STAR, transform: "translate(-28.8,-28.8) scale(2.4)", "stroke-width": opts.nss ? 1.2 : (1.2 / k / 2.4).toFixed(3) }, st), g);
    els.dot = sv("circle", { r: 3.2, fill: BRIGHT }, g);
    els.strokes = [els.c1, els.c3, els.sq1, els.sq2, els.star, els.ticks, els.ticksL];
    return { g, els };
  }
  function cachetEl(){
    const svg = sv("svg", { class: "fx-cachet", viewBox: "-104 -104 208 208" }, DECO);
    ["top", "bot"].forEach(side => {
      const cid = nid("half");
      const cp = sv("clipPath", { id: cid }, sv("defs", {}, svg));
      sv("rect", { x: -110, y: side === "top" ? -110 : 0, width: 220, height: 110 }, cp);
      const hg = sv("g", { "clip-path": `url(#${cid})` }, svg);
      buildSeal(sv("g", {}, hg), { disc: true, nss: true });
    });
    sv("path", { d: "M-104 2 L-60 -6 L-30 8 L-4 -4 L24 9 L52 -7 L78 5 L104 -2", fill: "none", stroke: PALE, "stroke-width": 1.4, "vector-effect": "non-scaling-stroke", opacity: 0 }, svg);
    const spin = sv("circle", { r: 102, fill: "none", stroke: GOLD, "stroke-width": 0.8, "stroke-dasharray": "2 7", "vector-effect": "non-scaling-stroke", opacity: 0.8 }, svg);
    return { svg, spin };
  }
  /* encadré d'orfèvrerie en HTML/CSS : il suit la taille réelle de la ligne,
     même quand la lettrine ou le retour à la ligne la font grandir (téléphone) */
  function frameC(){
    const box = document.createElement("div"); box.className = "fx-frame"; DECO.appendChild(box);
    const orn = "M0 36 V12 Q0 0 12 0 H36 M7 28 C7 14 14 7 28 7 M-5 -5 L0 0";
    const corners = ["tl", "tr", "bl", "br"].map(pos => {
      const s = sv("svg", { class: "fx-fc " + pos, viewBox: "0 0 36 36" }, box);
      return { p: sv("path", { d: orn, fill: "none", stroke: BRIGHT, "stroke-width": 1 }, s), dm: sv("polygon", { points: "-6,-6 -3,-9 0,-6 -3,-3", fill: BRIGHT }, s) };
    });
    const mk = c => { const e = document.createElement("i"); e.className = "fx-fe " + c; box.appendChild(e); return e; };
    const edgesH = [mk("t"), mk("b")], edgesV = [mk("l"), mk("r")];
    return { box, corners, edgesH, edgesV };
  }
  function lettrine(){
    const slot = $(".fx-lslot", CR); if (!slot) return null;
    const ch = ($(".fx-L", CR) || {}).textContent || "R";
    const svg = sv("svg", { viewBox: "0 0 52 52" }, slot);
    const r1 = sv("rect", { x: 1, y: 1, width: 50, height: 50, fill: "none", stroke: GOLD, "stroke-width": 1.2 }, svg);
    const r2 = sv("rect", { x: 5, y: 5, width: 42, height: 42, fill: "none", stroke: GOLD, "stroke-width": 0.5, opacity: 0.7 }, svg);
    const fl = sv("path", { d: "M8 44 C14 38 18 43 24 39 M44 8 C38 14 43 18 39 24", fill: "none", stroke: BRIGHT, "stroke-width": 0.7 }, svg);
    const dots = [[5, 5], [47, 5], [5, 47], [47, 47]].map(p => sv("circle", { cx: p[0], cy: p[1], r: 1.4, fill: BRIGHT }, svg));
    const L = sv("text", { x: 26, y: 38, "text-anchor": "middle", "font-family": "Marcellus, Georgia, serif", "font-size": 34, fill: BRIGHT, "fill-opacity": 1, stroke: PALE, "stroke-width": 0.6, "stroke-dasharray": 220, "stroke-dashoffset": 0 }, svg);
    L.textContent = ch;
    return { slot, svg, r1, r2, fl, dots, L };
  }
  function staticOn(){
    if (!CR || !DECO) return null;
    CR.classList.add("fx-crowned");
    const f = frameC(), c = cachetEl(), l = lettrine();
    if (l) { gsap.set(l.slot, { width: 52, height: 52, marginRight: 12 }); gsap.set($(".fx-L", CR), { width: 0, opacity: 0 }); }
    if (anim() && !LIGHT) CROWNED.persist.push(gsap.to(c.spin, { rotation: 360, svgOrigin: "0 0", duration: 60, ease: "none", repeat: -1 }));
    return { f, c, l };
  }
  function hideIllum(parts){
    if (!parts.l) return;
    gsap.set(parts.l.slot, { width: 0, height: 0, marginRight: 0 });
    gsap.set($(".fx-L", CR), { clearProps: "width,opacity" });
    gsap.set([parts.l.r1, parts.l.r2, parts.l.fl], { drawSVG: "0%" });
    gsap.set(parts.l.dots, { scale: 0, transformOrigin: "50% 50%" });
    gsap.set(parts.l.L, { attr: { "stroke-dashoffset": 220, "fill-opacity": 0 } });
  }
  function illuminate(parts, delay){
    if (!parts.l) return;
    const Lsp = $(".fx-L", CR), lw = Lsp.offsetWidth || 14, hf = $(".hfait", CR), hr = $(".hregle", CR);
    gsap.set(Lsp, { width: lw });
    sub(gsap.timeline({ delay: delay || 0 }))
      .to(Lsp, { width: 0, opacity: 0, duration: 0.7, ease: "expo.inOut" }, 0)
      .to(parts.l.slot, { width: 52, height: 52, marginRight: 12, duration: 0.9, ease: "expo.inOut" }, 0)
      .to([parts.l.r1, parts.l.r2], { drawSVG: "100%", duration: 1, ease: "power2.inOut", stagger: 0.15 }, 0.25)
      .to(parts.l.L, { attr: { "stroke-dashoffset": 0 }, duration: 1.2, ease: "power1.inOut" }, 0.4)
      .to(parts.l.L, { attr: { "fill-opacity": 1 }, duration: 0.9, ease: "power2.out" }, 1.2)
      .to(parts.l.fl, { drawSVG: "100%", duration: 0.9, ease: "power2.out" }, 1.1)
      .to(parts.l.dots, { scale: 1, duration: 0.4, ease: "back.out(3)", stagger: 0.07 }, 1.4)
      .add(() => {
        gsap.set([hf, hr].filter(Boolean), { opacity: 1 });
        if (!HAS.split) return;
        [hf, hr].filter(Boolean).forEach((el, j) => {
          const sp = SplitText.create(el, { type: "lines" }); CROWNED.splits.push(sp);
          gsap.fromTo(sp.lines, { clipPath: "inset(0 100% 0 0)", opacity: 0.3 }, { clipPath: "inset(0 0% 0 0)", opacity: 1, duration: 0.9, ease: "power2.inOut", stagger: 0.24, delay: j * 0.3 });
        });
      }, 0.55);
  }

  function ceremony(){
    prepStage();
    const tl = gsap.timeline();
    focusCrown(tl, 0.55);
    tl.add(() => { CR.classList.add("onstage"); }, ">");
    tl.to(VEIL, { opacity: 1, duration: 0.8, ease: "power2.inOut" }, "<");
    const R = Math.min(300, Math.max(120, Math.min(innerWidth * 0.84, innerHeight) * 0.36));
    const k = R / 100, D = 208 * k;
    const sx = Math.min(innerWidth - R - 12, Math.max(R + 12, vrect(CR).cx)), sy = innerHeight / 2;
    SEALBOX = document.createElement("div"); SEALBOX.className = "fx-sealbox"; SEALBOX.setAttribute("aria-hidden", "true");
    Object.assign(SEALBOX.style, { width: D + "px", height: D + "px", left: (sx - D / 2) + "px", top: (sy - D / 2) + "px" });
    MAIN.appendChild(SEALBOX);
    const svg = sv("svg", { viewBox: "-104 -104 208 208" }, SEALBOX);
    const useMask = !LIGHT && HAS.draw;
    const seal = buildSeal(svg, { k, mask: useMask });
    gsap.set(SEALBOX, { scale: 0.9, rotation: -50, transformOrigin: "50% 50%" });
    if (HAS.draw) gsap.set(seal.els.strokes, { drawSVG: "0%" });
    gsap.set([seal.els.c2, seal.els.dot], { opacity: 0 });
    if (!useMask) gsap.set(seal.els.txt, { opacity: 0 });
    const t0 = tl.duration() - 0.3;
    if (HAS.draw) {
      tl.to(seal.els.c1, { drawSVG: "100%", duration: 1.2, ease: "expo.inOut" }, t0)
        .to([seal.els.ticks, seal.els.ticksL], { drawSVG: "100%", duration: 0.9, ease: "power1.inOut" }, t0 + 0.35)
        .to([seal.els.sq1, seal.els.sq2], { drawSVG: "100%", duration: 1.1, ease: "power3.inOut", stagger: 0.18 }, t0 + 0.7)
        .to([seal.els.c3, seal.els.star], { drawSVG: "100%", duration: 0.9, ease: "power2.inOut", stagger: 0.15 }, t0 + 1.1);
      if (useMask) tl.fromTo(seal.els.mc, { drawSVG: "0%" }, { drawSVG: "100%", duration: 1.4, ease: "power2.inOut" }, t0 + 0.8);
    }
    if (!useMask) tl.to(seal.els.txt, { opacity: 1, duration: 1.2, ease: "power1.inOut" }, t0 + 0.8);
    tl.to(seal.els.c2, { opacity: 0.7, duration: 0.8 }, t0 + 0.4)
      .fromTo(seal.els.dot, { opacity: 0, scale: 0, svgOrigin: "0 0" }, { opacity: 1, scale: 1, svgOrigin: "0 0", duration: 0.6, ease: "back.out(3)" }, t0 + 1.7)
      .to(SEALBOX, { rotation: 0, scale: 1, duration: 2.4, ease: "expo.out" }, t0)
      .to(seal.els.disc, { opacity: 0.94, duration: 0.5 }, t0 + 2.1);
    tl.add(() => { ring(sx, sy, { scale: R / 5, dur: 1.1, color: BRIGHT, op: 0.5 }); }, t0 + 2.2);
    let parts = null;
    tl.add(() => {
      parts = staticOn();
      gsap.set(parts.c.svg, { opacity: 0 });
      hideIllum(parts);
      gsap.to([$(".hfait", CR), $(".hregle", CR)].filter(Boolean), { opacity: 0, duration: 0.3, ease: "power1.in" });
      parts.f.corners.forEach(c => { gsap.set(c.p, { drawSVG: "0%" }); gsap.set(c.dm, { scale: 0, transformOrigin: "50% 50%" }); });
      gsap.set(parts.f.edgesH, { scaleX: 0 }); gsap.set(parts.f.edgesV, { scaleY: 0 });
      const tr = vrect(parts.c.svg);
      sub(gsap.timeline())
        .to(SEALBOX, { x: tr.cx - sx, y: tr.cy - sy, scale: tr.w / D, rotation: 90, duration: 0.62, ease: "power4.in" }, 0)
        .to(VEIL, { opacity: 0, duration: 1.2, ease: "power2.inOut" }, 0.45)
        .add(() => impact(parts, tr), 0.62);
    }, t0 + 2.5);
    tl.to({}, { duration: 3.2 });
    return tl;
  }
  function impact(parts, tr){
    if (SEALBOX) { SEALBOX.remove(); SEALBOX = null; }
    gsap.set(parts.c.svg, { opacity: 1 });
    gsap.delayedCall(1.3, () => CR && CR.classList.remove("onstage"));
    commit(true);
    const q = LIGHT ? 0.5 : 1;
    ring(tr.cx, tr.cy, { scale: 5, dur: 0.7, color: PALE }); ring(tr.cx, tr.cy, { scale: 12, dur: 1.2, color: GOLD, op: 0.7 });
    if (!LIGHT) ring(tr.cx, tr.cy, { scale: 20, dur: 1.6, delay: 0.1, color: DEEP, op: 0.5 });
    burst(tr.cx, tr.cy, { n: Math.round(26 * q), colors: [GOLD, BRIGHT, PALE], speed: 3.4, g: 0.02, shape: "diamond", size: 2.2, life: 80, drag: 0.95 });
    flash(0.07, 0.9, BRIGHT);
    gsap.fromTo(CR, { y: 0 }, { keyframes: [{ y: 5, duration: 0.07, ease: "power2.out" }, { y: 0, duration: 0.9, ease: "elastic.out(1,0.35)" }], clearProps: "y" });
    gsap.fromTo(parts.c.svg, { scale: 1.12 }, { scale: 1, duration: 0.8, ease: "elastic.out(1,0.4)", transformOrigin: "50% 50%" });
    sub(gsap.timeline({ delay: 0.05 }))
      .to(parts.f.corners.map(c => c.p), { drawSVG: "100%", duration: 1.2, ease: "power2.inOut", stagger: 0.12 }, 0)
      .to(parts.f.edgesH, { scaleX: 1, duration: 1.2, ease: "expo.out", stagger: 0.08 }, 0.35)
      .to(parts.f.edgesV, { scaleY: 1, duration: 1.2, ease: "expo.out", stagger: 0.08 }, 0.45)
      .to(parts.f.corners.map(c => c.dm), { scale: 1, duration: 0.5, ease: "back.out(3)", stagger: 0.1 }, 0.9);
    writeState(0.2);
    illuminate(parts, 0.35);
  }
  function revoke(){
    const tl = gsap.timeline();
    const c = DECO && $(".fx-cachet", DECO), fc = DECO && $(".fx-frame", DECO);
    if (!c) { commit(false); return tl; }
    const halves = $$(":scope > g", c), crack = $$(":scope > path", c)[0], r = vrect(c);
    tl.set(crack, { opacity: 1, drawSVG: "0%" })
      .to(crack, { drawSVG: "100%", duration: 0.28, ease: "power2.in" })
      .add(() => { shake(c, 3, 0.25); burst(r.cx, r.cy, { n: LIGHT ? 10 : 18, colors: [GOLD, DEEP, BRIGHT], speed: 2.4, g: 0.14, shape: "diamond", size: 1.8, life: 55 }); })
      .to(halves[0], { y: -14, x: -6, rotation: -14, svgOrigin: "0 0", opacity: 0, duration: 0.8, ease: "power3.in" }, "+=0.12")
      .to(halves[1], { y: 22, x: 8, rotation: 18, svgOrigin: "0 0", opacity: 0, duration: 0.9, ease: "power3.in" }, "<")
      .to(crack, { opacity: 0, duration: 0.3 }, "<");
    if (fc) tl.to($$(".fx-fc path", fc), { drawSVG: "0%", duration: 0.7, ease: "power2.inOut", stagger: 0.06 }, "<0.1")
      .to($$(".fx-fe.t, .fx-fe.b", fc), { scaleX: 0, duration: 0.6, ease: "power2.in" }, "<")
      .to($$(".fx-fe.l, .fx-fe.r", fc), { scaleY: 0, duration: 0.6, ease: "power2.in" }, "<")
      .to($$(".fx-fc polygon", fc), { scale: 0, transformOrigin: "50% 50%", duration: 0.3 }, "<");
    const lsv = $(".fx-lslot svg", CR);
    if (lsv) {
      const t = $("text", lsv), txt = [$(".hfait", CR), $(".hregle", CR)].filter(Boolean);
      tl.to(txt, { opacity: 0.35, duration: 0.4 }, "<")
        .to(t, { attr: { "fill-opacity": 0 }, duration: 0.4 }, "<")
        .to(t, { attr: { "stroke-dashoffset": 220 }, duration: 0.6, ease: "power1.in" }, ">-0.1")
        .to($$("rect,path", lsv), { drawSVG: "0%", duration: 0.5 }, "<")
        .to($(".fx-lslot", CR), { width: 0, height: 0, marginRight: 0, duration: 0.7, ease: "expo.inOut" }, ">")
        .to($(".fx-L", CR), { width: "auto", opacity: 1, duration: 0.7, ease: "expo.inOut" }, "<")
        .to(txt, { opacity: 1, duration: 0.6 }, ">-0.2");
    }
    tl.add(() => commit(false), "-=0.2");
    return tl;
  }
  function killCeremony(){
    if (pendingCrown) { pendingCrown.kill(); pendingCrown = null; }
    CROWNED.subs.forEach(t => t.kill()); CROWNED.subs = [];
    if (CROWNED.tl) { CROWNED.tl.kill(); CROWNED.tl = null; }
    gsap.killTweensOf(window);
    cleanStage();
  }
  function crownOn(animate){
    killCeremony(); clearPersist();
    if (!CR) return;
    if (!animate || !anim()) { staticOn(); commit(true); return; }
    CROWNED.tl = ceremony();
    CROWNED.tl.eventCallback("onComplete", () => { CROWNED.tl = null; cleanStage(); });
  }
  function crownOff(animate){
    const running = !!CROWNED.tl || CROWNED.subs.length > 0;
    killCeremony();
    if (!CR) return;
    if (running) { clearPersist(); staticOn(); }
    if (!animate || !anim()) { clearPersist(); commit(false); return; }
    CROWNED.tl = revoke();
    CROWNED.tl.eventCallback("onComplete", () => { CROWNED.tl = null; clearPersist(); commit(false); cleanStage(); });
  }

  /* ---------- ouverture ---------- */
  function playOpening(){
    if (!anim()) return;
    const fname = $(".fx-fname", ROOT), bar = $(".accentbar", ROOT), eb = $(".eyebrow", ROOT);
    const tl = gsap.timeline();
    tl.fromTo(".fond", { opacity: 0, scale: 1.1 }, { opacity: 1, scale: 1, duration: 2.4, ease: "expo.out" }, 0);
    if (eb) tl.from(eb, { opacity: 0, letterSpacing: "0.8em", duration: 1.6, ease: "expo.out", clearProps: "letterSpacing,opacity" }, 0.15);
    const lead = [$(".back", ROOT), $(".meta .chip", ROOT)].filter(Boolean);
    if (lead.length) tl.from(lead, { opacity: 0, y: 8, duration: 0.8, stagger: 0.12, ease: "power3.out", clearProps: "opacity,transform" }, 0.7);
    if (fname && HAS.split) {
      const sp = SplitText.create(fname, { type: "words" });
      tl.from(sp.words, { opacity: 0, y: 14, filter: "blur(10px)", duration: 1.3, stagger: 0.16, ease: "power3.out" }, 0.3).add(() => sp.revert());
    }
    if (bar) tl.from(bar, { scaleX: 0, transformOrigin: "50% 50%", duration: 1.1, ease: "expo.inOut" }, 0.7);
  }

  /* ---------- page vivante ---------- */
  let living = null;
  function setupLiving(fresh){
    if (living) living(); living = null;
    if (!anim()) return;
    const tws = [], triggers = [];
    if (HAS.st && fresh) {
      const els = $$(":scope > *", ROOT).filter(e => !e.matches(".back, .eyebrow, h2, .meta, .herotable")).concat($$(".herotable > .hrow", ROOT));
      gsap.set(els, { clipPath: "inset(0 0 100% 0)", y: 16, opacity: 0.001 });
      triggers.push(...ScrollTrigger.batch(els, { start: "top 92%", once: true, onEnter: batch => gsap.to(batch, { clipPath: "inset(0 0 0% 0)", y: 0, opacity: 1, duration: 1.1, ease: "expo.out", stagger: 0.1, clearProps: "clipPath,transform,opacity" }) }));
    }
    if (HAS.st) tws.push(gsap.to(".fond", { yPercent: -4, ease: "none", scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.8 } }));
    const bar = $(".accentbar", ROOT);
    if (bar) tws.push(gsap.to(bar, { scaleX: 1.6, transformOrigin: "50% 50%", duration: 4.5, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2 }));
    const qx = LIGHT ? null : gsap.quickTo(".fond", "x", { duration: 1.4, ease: "power3.out" });
    // un seul calcul par image, quel que soit le nombre d'événements souris
    let lastE = null, pend = 0, curRow = null;
    const release = row => $$(".tbtn", row).forEach(b => { if (gsap.getProperty(b, "x") || gsap.getProperty(b, "y")) gsap.to(b, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1,0.4)", overwrite: "auto" }); });
    const frame = () => {
      pend = 0; const e = lastE; if (!e || !ROOT) return;
      if (qx) qx((e.clientX / innerWidth - 0.5) * -18);
      const row = e.target && e.target.closest ? e.target.closest(".hrow.track") : null;
      if (curRow && curRow !== row && canHover) release(curRow);
      curRow = row && ROOT.contains(row) ? row : null;
      if (!curRow) return;
      const r = curRow.getBoundingClientRect();
      curRow.style.setProperty("--mx", (e.clientX - r.left) + "px");
      if (!canHover) return;
      $$(".tbtn", curRow).forEach(b => {
        const c = vrect(b), dx = e.clientX - c.cx, dy = e.clientY - c.cy;
        if (Math.hypot(dx, dy) < 48) gsap.to(b, { x: dx * 0.3, y: dy * 0.3, duration: 0.35, ease: "power3.out", overwrite: "auto" });
        else if (gsap.getProperty(b, "x") || gsap.getProperty(b, "y")) gsap.to(b, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1,0.4)", overwrite: "auto" });
      });
    };
    const mv = e => { lastE = e; if (!pend) pend = requestAnimationFrame(frame); };
    window.addEventListener("pointermove", mv, { passive: true });
    const por = $(".leader .portrait", ROOT), cs = por ? $$("circle", por) : [];
    let sa, sb2;
    const enter = () => {
      if (cs[1]) sa = gsap.to(cs[1], { rotation: 360, svgOrigin: "12 12", duration: 7, ease: "none", repeat: -1 });
      if (cs[2]) sb2 = gsap.to(cs[2], { rotation: -360, svgOrigin: "12 12", duration: 14, ease: "none", repeat: -1 });
      gsap.to(por, { scale: 1.06, duration: 0.5, ease: "power3.out" });
      const c = vrect(por); ring(c.cx, c.cy, { scale: 5, dur: 1.1 });
    };
    const leave = () => { if (sa) sa.kill(); if (sb2) sb2.kill(); gsap.to(cs.slice(1), { rotation: 0, svgOrigin: "12 12", duration: 1, ease: "power3.out" }); gsap.to(por, { scale: 1, duration: 0.5 }); };
    if (por && canHover) { por.addEventListener("pointerenter", enter); por.addEventListener("pointerleave", leave); }
    living = () => {
      tws.forEach(t => { if (t.scrollTrigger) t.scrollTrigger.kill(); t.kill(); });
      triggers.forEach(t => t.kill());
      window.removeEventListener("pointermove", mv); if (pend) cancelAnimationFrame(pend);
      if (por) { por.removeEventListener("pointerenter", enter); por.removeEventListener("pointerleave", leave); }
      if (sa) sa.kill(); if (sb2) sb2.kill();
      gsap.killTweensOf(".fond");
      gsap.set(".fond", { clearProps: "all" });
    };
  }

  /* ---------- fond : constellation et géométrie sacrée ---------- */
  const BG = { cv: null, ctx: null, parts: [], raf: 0, t: 0, last: 0, alpha: 1, prev: 0, d: [] };
  const BGS = 0.5;   // le fond est dessiné à demi-résolution puis agrandi : 4 fois moins de pixels
  function colFade(x, W){
    if (W < 760) return 0.45;
    const cx = W / 2, L = cx - 560, R = cx + 260, soft = 120;
    const sm = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    return 1 - 0.6 * sm(L - soft, L + soft, x) * (1 - sm(R - soft, R + soft, x));
  }
  function bgSize(){
    if (!BG.cv) return;
    BG.cv.width = Math.round(innerWidth * BGS); BG.cv.height = Math.round(innerHeight * BGS);
    BG.ctx.setTransform(BGS, 0, 0, BGS, 0, 0);
    const area = Math.max(0.5, (innerWidth * innerHeight) / (1440 * 900)), n = Math.round(70 * area);
    BG.parts = [];
    for (let i = 0; i < n; i++) BG.parts.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, vx: (Math.random() - 0.5) * 0.34, vy: (Math.random() - 0.5) * 0.34 });
  }
  function bgDraw(){
    const c = BG.ctx, W = innerWidth, H = innerHeight, a = BG.alpha;
    c.clearRect(0, 0, W, H);
    const cx = W * 0.8, cy = H * 0.36, rot = BG.t * 0.0011;
    c.save(); c.translate(cx, cy); c.lineWidth = 1.8; c.strokeStyle = `rgba(221,182,79,${0.15 * a})`;
    [[120, 0.6, [4, 10]], [210, -1.4, [2, 7]], [320, 0.35, [10, 14]], [450, -0.2, [1, 12]]].forEach(r => {
      c.save(); c.rotate(rot * r[1]); c.setLineDash(r[2]); c.beginPath(); c.arc(0, 0, r[0], 0, Math.PI * 2); c.stroke(); c.restore();
    });
    c.setLineDash([]); c.rotate(rot * 0.5); c.strokeStyle = `rgba(221,182,79,${0.13 * a})`;
    for (let k = 0; k < 2; k++) { c.rotate(Math.PI / 4); c.strokeRect(-150, -150, 300, 300); }
    c.restore();
    const md = 150, ps = BG.parts;
    c.lineWidth = 1.4;   // demi-résolution : traits épaissis pour garder la même présence
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]; p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
      for (let j = i + 1; j < ps.length; j++) {
        const q = ps[j], dx = p.x - q.x, dy = p.y - q.y; if (Math.abs(dx) > md || Math.abs(dy) > md) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < md) { c.strokeStyle = `rgba(221,182,79,${(1 - d / md) * 0.34 * colFade((p.x + q.x) / 2, W) * a})`; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); }
      }
      c.fillStyle = `rgba(242,215,136,${0.7 * colFade(p.x, W) * a})`; c.beginPath(); c.arc(p.x, p.y, 1.6, 0, Math.PI * 2); c.fill();
    }
  }
  function bgLoop(ts){
    BG.raf = requestAnimationFrame(bgLoop);
    // surveillance : si l'appareil n'arrive pas à suivre, on passe en mode allégé
    if (BG.prev) { BG.d.push(ts - BG.prev); if (BG.d.length >= 120) { const avg = BG.d.reduce((x, y) => x + y, 0) / BG.d.length; BG.d = []; if (avg > 24) { goLight(); return; } } }
    BG.prev = ts;
    if (ts - BG.last < 32) return; BG.last = ts;   // ~30 images par seconde suffisent pour un fond lent
    if (CROWNED.tl || document.documentElement.classList.contains("fx-scrolling")) return;
    BG.t++; bgDraw();
  }
  function goLight(){
    LIGHT = true;
    try { sessionStorage.setItem("cytfx-light", "1"); } catch(e){}
    cancelAnimationFrame(BG.raf); BG.raf = 0; BG.alpha = 1; if (BG.ctx) bgDraw();
    if (active) { gsap.killTweensOf(".fond", "x"); gsap.set(".fond", { x: 0 }); setupLiving(false); }
  }
  function bgVis(){ if (!BG.cv) return; if (document.hidden) { cancelAnimationFrame(BG.raf); BG.raf = 0; BG.prev = 0; BG.d = []; } else if (anim() && !LIGHT && !BG.raf) BG.raf = requestAnimationFrame(bgLoop); }
  function bgStart(){
    if (BG.cv) return;
    BG.cv = document.createElement("canvas"); BG.cv.id = "fxbg"; BG.cv.setAttribute("aria-hidden", "true");
    const fond = $(".fond"); if (fond && fond.nextSibling) fond.parentNode.insertBefore(BG.cv, fond.nextSibling); else document.body.prepend(BG.cv);
    BG.ctx = BG.cv.getContext("2d"); bgSize();
    window.addEventListener("resize", bgSize); document.addEventListener("visibilitychange", bgVis);
    if (!anim() || LIGHT) { BG.alpha = 1; bgDraw(); return; }
    BG.alpha = 0; BG.prev = 0; BG.d = []; gsap.to(BG, { alpha: 1, duration: 1.8, ease: "power1.out" });
    BG.raf = requestAnimationFrame(bgLoop);
  }
  function bgStop(){
    if (!BG.cv) return;
    cancelAnimationFrame(BG.raf); BG.raf = 0; gsap.killTweensOf(BG);
    window.removeEventListener("resize", bgSize); document.removeEventListener("visibilitychange", bgVis);
    BG.cv.remove(); BG.cv = null; BG.ctx = null; BG.parts = [];
  }

  /* ---------- pendant le défilement, le fond se fige (le défilement reste fluide) ---------- */
  let scT = 0;
  window.addEventListener("scroll", () => {
    if (!active) return;
    document.documentElement.classList.add("fx-scrolling");
    clearTimeout(scT); scT = setTimeout(() => document.documentElement.classList.remove("fx-scrolling"), 160);
  }, { passive: true });

  /* ---------- redimensionnement : redessiner l'encadré ---------- */
  let rz = 0;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (active && CROWNED.on && !CROWNED.tl && !CROWNED.subs.length) { clearPersist(); staticOn(); } }, 250); });

  /* ---------- points d'entrée appelés par script.js ---------- */
  function deactivate(){
    if (!active) return;
    active = false;
    killCeremony(); clearPersist();
    if (living) { living(); living = null; }
    bgStop();
    document.body.classList.remove("fx-custodes");
    ROOT = CR = DECO = null;
  }
  function onView(fac, viewId, opts){
    opts = opts || {};
    deactivate();
    if (fac !== FAC || viewId !== "v-factio") return;
    ROOT = $("#factioDetail"); if (!ROOT || !ROOT.classList.contains("factio-" + FAC)) return;
    layers();
    active = true;
    document.body.classList.add("fx-custodes");
    enhance();
    const fresh = !opts.keepScroll && typeof opts.y !== "number";
    bgStart();
    setupLiving(fresh);
    if (fresh) playOpening();
    CROWNED.on = !!(CR && CR.classList.contains("unlocked"));
    if (CROWNED.on) staticOn();
  }
  function onAdjust(row, delta, wasU, nowU, wasC, nowC, oldC, newC){
    if (!active || !ROOT || !ROOT.contains(row)) return;
    const btn = $(delta > 0 ? ".tbtn.plus" : ".tbtn.minus", row);
    if (oldC === newC) { if (anim() && btn) shake(btn, 3, 0.28); return; }
    counterFX(row, delta, btn);
    if (!wasU && nowU) unlockFX(row, btn);
    else if (wasU && !nowU) {
      row.classList.add("unlocked");
      const seuil = parseInt(row.dataset.seuil, 10) || 1, key = row.dataset.key;
      lockFX(row, () => { if (progOf(key) < seuil) row.classList.remove("unlocked"); });
    }
    if (!CR || row.dataset.kind !== "v") return;
    if (nowC && !wasC && !CROWNED.on) {
      CROWNED.on = true;
      if (anim()) {
        CR.classList.add("locked"); CR.classList.remove("unlocked");
        const st = $(".crownstate", CR); if (st) st.textContent = crownText(2);
        pendingCrown = gsap.delayedCall(0.55, () => { pendingCrown = null; crownOn(true); });
      } else crownOn(false);
    } else if (!nowC && wasC && CROWNED.on) {
      CROWNED.on = false;
      if (anim()) {
        CR.classList.add("unlocked"); CR.classList.remove("locked");
        const st = $(".crownstate", CR); if (st) st.textContent = crownText(3);
      }
      crownOff(true);
    }
  }
  window.CytFX = { onView, onAdjust };
})();
