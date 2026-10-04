/* ============================================================
   CYTHEREA — EFFETS VALIDÉS · FACTION KRIEG (la 88e)
   Proposition D du bac à sable (octobre 2026) :
   - fond « Registre » : papier réglé, bâtonnets de décompte qui
     s'ajoutent dans la marge, la ligne sous le curseur s'éclaire ;
   - socle « Registre » : ouverture tapée à la machine, compteurs à
     rouleau, titres obtenus frappés au tampon, malus tamponné cendre ;
   - couronnement « Tranchée » : trois départs sur l'horizon, sifflement,
     impact, lettres qui retombent, puis encadré « Piquets » (piquets de
     bois, barbelé, parapet de sacs, plaque de la 88e) ;
   - survol des lignes « Viseur » et portrait « Viseur ».
   Actif uniquement sur la page de la faction Krieg. Se branche derrière
   fx-custodes.js : window.CytFX relaie les appels de script.js aux deux
   modules, chacun ne réagissant que sur sa propre page.
   Sans GSAP (CDN coupé) : ne fait rien.
   Respecte « réduire les animations » : états finaux sans mouvement.
   ============================================================ */
(function(){
  "use strict";
  const PREV = window.CytFX;
  const NOOP = { onView(){}, onAdjust(){} };
  function chain(mod){
    window.CytFX = {
      onView(){ if (PREV) PREV.onView.apply(PREV, arguments); mod.onView.apply(mod, arguments); },
      onAdjust(){ if (PREV) PREV.onAdjust.apply(PREV, arguments); mod.onAdjust.apply(mod, arguments); }
    };
  }
  if (typeof window.gsap === "undefined") { chain(NOOP); return; }
  const PL = ["SplitText","ScrambleTextPlugin","DrawSVGPlugin","MotionPathPlugin","ScrollToPlugin","ScrollTrigger"];
  gsap.registerPlugin(...PL.filter(n => window[n]).map(n => window[n]));
  const HAS = { split: !!window.SplitText, scr: !!window.ScrambleTextPlugin, draw: !!window.DrawSVGPlugin, mp: !!window.MotionPathPlugin, sto: !!window.ScrollToPlugin, st: !!window.ScrollTrigger };

  const FAC = "krieg";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [].slice.call((r || document).querySelectorAll(s));
  const KHAKI = "#A9AE72", BRIGHT = "#CDD19A", PALE = "#ECEEC8", DEEP = "#525634", ASH = "#B9ADA2", ASHD = "#8E8279";
  const MUD = "#4C4532", MUD2 = "#6E6447", FIRE = "#E8D9A0", WOOD = "#3A3326", WOOD2 = "#4A4131", STEEL = "#23251A";
  const DIGITS = "0123456789";
  const NS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs, parent){ const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const osReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const anim = () => !osReduce.matches;
  const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  /* Mode allégé : petits appareils ou peu de cœurs. Le fond devient une image
     fixe et les effets liés au curseur sont coupés ; tout le reste est conservé. */
  let LIGHT = (navigator.hardwareConcurrency || 8) <= 4 || window.matchMedia("(max-width: 760px)").matches;
  try { if (sessionStorage.getItem("cytfx-light") === "1") LIGHT = true; } catch(e){}

  /* ---------- couches ---------- */
  let MAIN, VEIL, DST, BC, bx, FLASH, HORIZON;
  function layers(){
    if (BC) return;
    MAIN = $("main.wrap");
    VEIL = document.createElement("div"); VEIL.id = "kfxveil"; VEIL.setAttribute("aria-hidden", "true");
    DST = sv("svg", { id: "kfxdstage", "aria-hidden": "true" });
    MAIN.prepend(DST); MAIN.prepend(VEIL);
    HORIZON = document.createElement("div"); HORIZON.id = "kfxhorizon"; HORIZON.setAttribute("aria-hidden", "true");
    FLASH = document.createElement("div"); FLASH.id = "kfxflash"; FLASH.setAttribute("aria-hidden", "true");
    BC = document.createElement("canvas"); BC.id = "kfxburst"; BC.setAttribute("aria-hidden", "true");
    document.body.append(HORIZON, FLASH, BC);
    bx = BC.getContext("2d"); sizeBurst();
    window.addEventListener("resize", sizeBurst);
  }
  function sizeBurst(){ const d = LIGHT ? 1 : Math.min(2, window.devicePixelRatio || 1); BC.width = innerWidth * d; BC.height = innerHeight * d; BC.style.width = innerWidth + "px"; BC.style.height = innerHeight + "px"; bx.setTransform(d, 0, 0, d, 0, 0); }

  /* ---------- outils : particules, flash, éclairs, secousses, frappe ---------- */
  let P = [], braf = 0;
  const vrect = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
  const mrect = el => { const m = MAIN.getBoundingClientRect(), r = el.getBoundingClientRect(); return { x: r.left - m.left, y: r.top - m.top, w: r.width, h: r.height, cx: r.left - m.left + r.width / 2, cy: r.top - m.top + r.height / 2 }; };
  function burst(x, y, o){
    let n = o.n || 20; if (LIGHT) n = Math.ceil(n * 0.6);
    for (let i = 0; i < n; i++) {
      const a = (o.angle != null ? o.angle : -Math.PI / 2) + (Math.random() - 0.5) * (o.spread != null ? o.spread : Math.PI * 2);
      const sp = (o.speed || 3) * (0.35 + Math.random() * 0.9), life = (o.life || 50) * (0.6 + Math.random() * 0.6);
      P.push({ x: x + (Math.random() - 0.5) * (o.jx || 0), y: y + (Math.random() - 0.5) * (o.jy || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        g: o.g != null ? o.g : 0.06, drag: o.drag || 0.96, life, max: life, size: (o.size || 2) * (0.5 + Math.random()), grow: o.grow || 0, alpha: o.alpha || 1,
        c: o.colors[Math.floor(Math.random() * o.colors.length)], shape: o.shape || "dot", rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, k: [Math.random(), Math.random(), Math.random(), Math.random()] });
    }
    if (!braf) braf = requestAnimationFrame(tick);
  }
  function tick(){
    bx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i];
      q.vx *= q.drag; q.vy = q.vy * q.drag + q.g; q.life--; q.rot += q.vr; q.size += q.grow;
      q.x += q.vx; q.y += q.vy;
      if (q.life <= 0) { P.splice(i, 1); continue; }
      bx.globalAlpha = Math.max(0, Math.min(1, q.life / q.max * 1.6)) * q.alpha;
      bx.fillStyle = q.c; bx.strokeStyle = q.c;
      if (q.shape === "clod") {
        const s = q.size, k = q.k; bx.save(); bx.translate(q.x, q.y); bx.rotate(q.rot); bx.beginPath();
        bx.moveTo(-s, -s * (0.4 + k[0] * 0.5)); bx.lineTo(s * (0.5 + k[1] * 0.5), -s); bx.lineTo(s, s * (0.3 + k[2] * 0.6)); bx.lineTo(-s * (0.3 + k[3] * 0.6), s); bx.closePath(); bx.fill(); bx.restore();
      } else if (q.shape === "dust") {
        const gr = bx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.size); gr.addColorStop(0, q.c); gr.addColorStop(1, "rgba(0,0,0,0)");
        bx.fillStyle = gr; bx.beginPath(); bx.arc(q.x, q.y, q.size, 0, Math.PI * 2); bx.fill();
      } else if (q.shape === "spark") { bx.lineWidth = q.size * 0.6; bx.beginPath(); bx.moveTo(q.x, q.y); bx.lineTo(q.x - q.vx * 3, q.y - q.vy * 3); bx.stroke(); }
      else { bx.beginPath(); bx.arc(q.x, q.y, q.size, 0, Math.PI * 2); bx.fill(); }
    }
    bx.globalAlpha = 1;
    braf = P.length ? requestAnimationFrame(tick) : 0;
  }
  function flash(peak, dur, color){ FLASH.style.background = color || "var(--accent)"; gsap.fromTo(FLASH, { opacity: 0 }, { keyframes: [{ opacity: peak, duration: dur * 0.15, ease: "power2.out" }, { opacity: 0, duration: dur * 0.85, ease: "power2.inOut" }], overwrite: true }); }
  function horizon(x, peak, dur){ HORIZON.style.setProperty("--hx", x + "%"); gsap.fromTo(HORIZON, { opacity: 0 }, { keyframes: [{ opacity: peak, duration: 0.06 }, { opacity: peak * 0.4, duration: 0.12 }, { opacity: peak * 0.8, duration: 0.05 }, { opacity: 0, duration: dur || 0.9, ease: "power2.out" }], overwrite: true }); }
  function shake(el, amp, dur, axis){ const p = axis || "x"; gsap.fromTo(el, { [p]: 0 }, { keyframes: { [p]: [-amp, amp, -amp * 0.6, amp * 0.35, -amp * 0.15, 0] }, duration: dur || 0.34, ease: "none", clearProps: p }); }
  // secousse de la page : appliquée à la section, jamais à main (qui contient des couches fixes)
  function quake(amp, dur){ if (!ROOT) return; gsap.fromTo(ROOT, { x: 0, y: 0 }, { keyframes: { x: [amp, -amp * 0.8, amp * 0.5, -amp * 0.3, amp * 0.1, 0], y: [-amp * 0.6, amp * 0.5, -amp * 0.3, amp * 0.15, 0, 0] }, duration: dur || 0.5, ease: "none", clearProps: "x,y" }); }
  // machine à écrire : révèle le texte caractère par caractère, avec un curseur
  function typeIn(el, text, dur){
    const obj = { n: 0 };
    el.innerHTML = '<i class="kfx-caret"></i>';
    return gsap.to(obj, { n: text.length, duration: dur, ease: "steps(" + Math.max(1, text.length) + ")",
      onUpdate: () => { el.innerHTML = esc(text.slice(0, Math.round(obj.n))) + '<i class="kfx-caret"></i>'; },
      onComplete: () => { el.textContent = text; }, onInterrupt: () => { el.textContent = text; } });
  }

  /* ---------- état de la page ---------- */
  let ROOT = null, CR = null, DECO = null, CTITLE = null, CTEXT = null, active = false;
  const CROWNED = { on: false, tl: null, subs: [], splits: [] };
  const sub = t => { CROWNED.subs.push(t); return t; };
  let pendingCrown = null;
  const crownText = n => n >= 3 ? "✦ Couronnement débloqué — 3 titres obtenus" : "Verrouillé — " + Math.min(n, 3) + "/3 titres requis";
  function titlesOwned(){
    const h = (typeof HEROTABLE !== "undefined") ? HEROTABLE[FAC] : null;
    const prog = (typeof ME !== "undefined" && ME.progress && ME.progress[FAC]) || {};
    if (!h) return 0;
    return h.voie.reduce((a, r, i) => a + ((prog["v" + i] || 0) >= (parseInt(r.seuil, 10) || 1) ? 1 : 0), 0);
  }
  function progOf(key){ try { return (ME.progress[FAC] && ME.progress[FAC][key]) || 0; } catch(e){ return 0; } }

  /* ---------- enrichissement du DOM rendu par script.js ---------- */
  function enhance(){
    const h2 = $("h2", ROOT);
    if (h2 && !$(".kfx-fname", h2)) {
      const tn = [].slice.call(h2.childNodes).find(n => n.nodeType === 3 && n.textContent.trim());
      if (tn) { const s = document.createElement("span"); s.className = "kfx-fname"; s.textContent = tn.textContent; h2.replaceChild(s, tn); }
    }
    $$(".hrow.track", ROOT).forEach(row => {
      if (row.dataset.kfx) return; row.dataset.kfx = "1";
      row.insertAdjacentHTML("afterbegin", '<i class="kfx-sweep" aria-hidden="true"></i>' + ["tl","tr","bl","br"].map(c => `<i class="kfx-b ${c}" aria-hidden="true"></i>`).join(""));
      const cv = $(".cval", row);
      if (cv && !cv.parentNode.classList.contains("kfx-cwin")) { const w = document.createElement("span"); w.className = "kfx-cwin"; cv.parentNode.insertBefore(w, cv); w.appendChild(cv); }
    });
    CR = $(".hrow.crown[data-fac]", ROOT);
    if (CR && !$(".kfx-deco", CR)) {
      DECO = document.createElement("div"); DECO.className = "kfx-deco"; DECO.setAttribute("aria-hidden", "true"); CR.prepend(DECO);
      const t = $(".htitre", CR);
      if (t) t.innerHTML = '<span class="kfx-ctitle">' + esc(t.textContent) + "</span>";
    } else DECO = CR ? $(".kfx-deco", CR) : null;
    CTITLE = CR ? $(".kfx-ctitle", CR) : null;
    CTEXT = CR ? $(".crownstate", CR) : null;
    const por = $(".leader .portrait svg", ROOT);
    if (por) { const c = $$("circle", por); if (c[1]) c[1].setAttribute("stroke-dasharray", "3 2.2"); if (c[2]) c[2].setAttribute("stroke-dasharray", "1 2"); }
  }

  /* ============================================================
     SOCLE « REGISTRE » : titres, compteurs, malus
     ============================================================ */
  function unlockFX(row, btn){
    if (!anim()) return;
    const badge = $(".hbadge", row); if (!badge) return;
    if (row.classList.contains("malusrow")) {
      // malus : tampon cendre, de travers, qui se redresse
      gsap.fromTo(badge, { scale: 2.8, rotation: 12, opacity: 0 }, { scale: 1, rotation: -3, opacity: 1, duration: 0.22, ease: "power4.in",
        onComplete: () => { shake(row, 5, 0.34); const c = vrect(badge); burst(c.cx, c.cy, { n: 18, colors: [ASH, ASHD], speed: 2, g: 0.02, drag: 0.86, size: 1.8, life: 50 }); gsap.to(badge, { rotation: 0, duration: 1.4, ease: "power2.out", clearProps: "all" }); } });
      return;
    }
    // titre obtenu : le badge est frappé comme un tampon, un filet se trace sous la ligne
    gsap.fromTo(badge, { scale: 2.6, rotation: -14, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 0.2, ease: "power4.in", clearProps: "scale,rotation,opacity",
      onComplete: () => { shake(row, 3, 0.22, "y"); const c = vrect(badge); burst(c.cx, c.cy, { n: 12, colors: [KHAKI, DEEP, BRIGHT], speed: 1.8, g: 0, drag: 0.85, size: 1.6, life: 40 }); } });
    const b = $(".kfx-sweep", row);
    if (b) gsap.timeline().fromTo(b, { scaleX: 0, opacity: 1, transformOrigin: "0 50%" }, { scaleX: 1, duration: 0.55, ease: "power2.inOut", delay: 0.2 }).to(b, { opacity: 0, duration: 0.8 }, "+=0.4");
  }
  function lockFX(row, done){
    const badge = $(".hbadge", row);
    if (!anim() || !badge) { done(); return; }
    // titre perdu : le badge est barré d'un trait, puis s'efface
    const l = document.createElement("i"); l.className = "kfx-strike";
    badge.appendChild(l);
    gsap.timeline({ onComplete: () => { l.remove(); gsap.set(badge, { clearProps: "all" }); done(); } })
      .fromTo(l, { scaleX: 0 }, { scaleX: 1, duration: 0.18, ease: "power2.in" }).to(badge, { opacity: 0, duration: 0.35 }, "+=0.15");
  }
  function counterFX(row, dir, btn){
    if (!anim()) return;
    const cv = $(".cval", row);
    if (cv) gsap.fromTo(cv, { yPercent: dir > 0 ? 110 : -110 }, { yPercent: 0, duration: 0.32, ease: "back.out(2.2)", overwrite: true });
    if (btn) gsap.fromTo(btn, { y: 2 }, { y: 0, duration: 0.25, ease: "power2.out", clearProps: "y" });
  }

  /* ============================================================
     COURONNEMENT : barrage de la Tranchée + encadré « Piquets »
     ============================================================ */
  function prepStage(){
    const w = MAIN.offsetWidth, h = MAIN.scrollHeight;
    DST.setAttribute("width", w); DST.setAttribute("height", h); DST.setAttribute("viewBox", `0 0 ${w} ${h}`);
    DST.style.width = w + "px"; DST.style.height = h + "px";
    DST.innerHTML = "";
  }
  function cleanStage(){
    if (!DST) return;
    DST.innerHTML = "";
    gsap.killTweensOf(VEIL); gsap.set(VEIL, { opacity: 0 });
    if (CR) CR.classList.remove("onstage");
    CROWNED.splits.forEach(s => s.revert()); CROWNED.splits = [];
    document.documentElement.style.scrollBehavior = "";
  }
  function makeRoom(){ if (CR) CR.dataset.kfxDeco = "piquets"; }
  function clearPersist(){
    if (!CR || !DECO) return;
    delete CR.dataset.kfxDeco;
    gsap.killTweensOf($$("*", DECO));
    DECO.innerHTML = "";
    if (CTITLE) { gsap.killTweensOf(CTITLE); gsap.set(CTITLE, { clearProps: "all" }); }
    if (CTEXT) { gsap.killTweensOf(CTEXT); gsap.set(CTEXT, { clearProps: "all" }); }
  }
  function commit(on){
    if (!CR) return;
    CR.classList.toggle("unlocked", on); CR.classList.toggle("locked", !on);
    if (CTEXT) CTEXT.textContent = crownText(on ? Math.max(3, titlesOwned()) : Math.min(2, titlesOwned()));
  }
  function focusCrown(tl){
    if (!HAS.sto) return;
    const r = CR.getBoundingClientRect(), target = window.scrollY + r.top - (innerHeight - r.height) / 2;
    if (Math.abs(target - window.scrollY) > 40) {
      tl.add(() => { document.documentElement.style.scrollBehavior = "auto"; }, 0);
      tl.to(window, { scrollTo: { y: Math.max(0, target), autoKill: false }, duration: 0.7, ease: "power3.inOut" }, 0);
    }
  }

  /* ---------- encadré « Piquets » ---------- */
  function sacsEl(){
    const w = CR.offsetWidth + 8, s = sv("svg", { class: "kfx-sacs", viewBox: `0 0 ${w} 26`, preserveAspectRatio: "none" }, DECO), out = [];
    for (let row = 0; row < 2; row++) {
      const sw = 46, off = row ? 0 : sw / 2, y = row ? 12 : 1;
      for (let x = -off; x < w; x += sw) {
        const g = sv("g", { "data-row": row }, s);
        sv("path", { d: `M${x + 3} ${y + 7} Q${x + 2} ${y + 1} ${x + 9} ${y + 1} H${x + sw - 9} Q${x + sw - 2} ${y + 1} ${x + sw - 3} ${y + 7} Q${x + sw - 2} ${y + 13} ${x + sw - 9} ${y + 13} H${x + 9} Q${x + 2} ${y + 13} ${x + 3} ${y + 7}Z`,
          fill: row ? "#3A3C27" : "#2C2E1E", stroke: row ? KHAKI : DEEP, "stroke-width": 1 }, g);
        sv("path", { d: `M${x + sw / 2 - 4} ${y + 3} q4 4 0 8`, fill: "none", stroke: row ? DEEP : "#3A3C27", "stroke-width": 1 }, g);
        out.push(g);
      }
    }
    out.filter(g => g.dataset.row === "1").forEach(g => s.appendChild(g));   // le rang du bas passe devant
    return out;
  }
  function frameSvg(){
    const w = CR.offsetWidth, h = CR.offsetHeight, ox = 18, oy = 36, bot = 30;
    const s = sv("svg", { class: "kfx-frm", width: w + 2 * ox, height: h + oy + bot, viewBox: `0 0 ${w + 2 * ox} ${h + oy + bot}` }, DECO);
    s.style.left = -ox + "px"; s.style.top = -oy + "px";
    return { g: sv("g", { transform: `translate(${ox} ${oy})` }, s), w, h };
  }
  function plaque(g, x, y){
    const pl = sv("g", { transform: `translate(${x} ${y})` }, g), inner = sv("g", {}, pl);
    sv("rect", { x: 0, y: 0, width: 150, height: 21, fill: STEEL, stroke: KHAKI, "stroke-width": 1 }, inner);
    sv("rect", { x: 3, y: 3, width: 144, height: 15, fill: "none", stroke: DEEP, "stroke-width": 0.8 }, inner);
    [[6, 10.5], [144, 10.5]].forEach(([cx, cy]) => sv("circle", { cx, cy, r: 1.6, fill: KHAKI }, inner));
    const t = sv("text", { x: 75, y: 14.2, "text-anchor": "middle", fill: BRIGHT, "font-family": "Marcellus, Georgia, serif", "font-size": 7.4, "letter-spacing": 1.2, textLength: 122, lengthAdjust: "spacingAndGlyphs" }, inner);
    t.textContent = "88e · COMPAGNIE DE SIÈGE";
    return inner;
  }
  function barbsAlong(g, x1, y1, x2, sag){
    const out = [];
    for (let x = x1 + 18; x < x2 - 10; x += 30) {
      const t = (x - x1) / (x2 - x1), y = y1 + sag * 4 * t * (1 - t);
      out.push(sv("path", { d: `M${x - 2.6} ${y - 2.6} L${x + 2.6} ${y + 2.6} M${x + 2.6} ${y - 2.6} L${x - 2.6} ${y + 2.6}`, stroke: KHAKI, "stroke-width": 1 }, g));
    }
    return out;
  }
  function buildFrame(){
    const sacs = sacsEl(), { g, w, h } = frameSvg(), posts = [], stubs = [], wires = [], barbs = [];
    const post = (x, y1, y2, wd) => {
      const pg = sv("g", {}, g);
      sv("path", { d: `M${x} ${y1 + 6} L${x + wd / 2} ${y1} L${x + wd} ${y1 + 6} V${y2} H${x} Z`, fill: WOOD, stroke: DEEP, "stroke-width": 1 }, pg);
      sv("path", { d: `M${x + 1.5} ${y1 + 12} V${y2 - 4}`, stroke: WOOD2, "stroke-width": 1 }, pg);
      [y1 + 10, y1 + 19].forEach(yy => sv("path", { d: `M${x - 1.5} ${yy} L${x + wd + 1.5} ${yy + 4} M${x - 1.5} ${yy + 4} L${x + wd + 1.5} ${yy}`, stroke: KHAKI, "stroke-width": 0.9 }, pg));
      return pg;
    };
    posts.push(post(-15, -30, h + 18, 8), post(w + 7, -30, h + 18, 8));
    const n = Math.max(0, Math.floor(w / 230)), xs = [-11];
    for (let i = 1; i <= n; i++) { const x = (w * i) / (n + 1); xs.push(x); stubs.push(post(x - 3, -28, -2, 6)); }
    xs.push(w + 11);
    [-21, -11].forEach((y, k) => {
      let d = `M${xs[0]} ${y}`;
      for (let i = 1; i < xs.length; i++) { const a = xs[i - 1], b = xs[i]; d += ` Q${(a + b) / 2} ${y + 9} ${b} ${y}`; barbs.push(...barbsAlong(g, a, y, b, 4.5)); }
      wires.push(sv("path", { d, fill: "none", stroke: k ? KHAKI : DEEP, "stroke-width": 1.1 }, g));
    });
    const pl = plaque(g, 22, -14);
    return { sacs, posts, stubs, wires, barbs, pl };
  }
  function enterFrame(tl, p, t){
    tl.fromTo(p.posts, { y: -70, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "bounce.out", stagger: 0.08 }, t)
      .fromTo(p.stubs, { y: -40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: "bounce.out", stagger: 0.06 }, t + 0.12)
      .fromTo(p.sacs, { y: -46, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "bounce.out", stagger: { each: 0.022, from: "edges" } }, t + 0.15);
    if (HAS.draw) tl.fromTo(p.wires, { drawSVG: "0%" }, { drawSVG: "100%", duration: 0.8, ease: "power2.inOut", stagger: 0.15 }, t + 0.5);
    else tl.from(p.wires, { opacity: 0, duration: 0.3 }, t + 0.5);
    if (p.barbs.length) tl.fromTo(p.barbs, { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.25, ease: "back.out(3)", stagger: { each: 0.012 } }, t + 0.8);
    tl.fromTo(p.pl, { rotation: -32, opacity: 0, svgOrigin: "6 10.5" }, { rotation: 0, opacity: 1, duration: 1.2, ease: "elastic.out(1,0.35)" }, t + 0.95)
      .add(() => shake(CR, 2, 0.18, "y"), t + 0.95);
  }
  function staticOn(){ if (!CR || !DECO) return; makeRoom(); buildFrame(); }

  /* ---------- cérémonie ---------- */
  function play(tl){
    // trois départs sur l'horizon, de plus en plus proches
    [0, 0.42, 0.82].forEach((t, i) => tl.add(() => { horizon(30 + i * 22, 0.5 + i * 0.2, 0.8); quake(1.5 + i, 0.3); }, 0.6 + t));
    // le sifflement : trajectoire du coin de l'écran jusqu'à la dalle
    const r = mrect(CR), m = MAIN.getBoundingClientRect();
    const sx = innerWidth - m.left + 30, sy = -m.top - 30, ex = r.x + r.w * 0.72, ey = r.y + r.h * 0.45;
    const path = sv("path", { d: `M${sx} ${sy} Q${(sx + ex) / 2 + 60} ${Math.min(sy, ey) - 140} ${ex} ${ey}`, fill: "none", stroke: BRIGHT, "stroke-width": 1.4, "stroke-dasharray": "2 7", opacity: 0.8 }, DST);
    const shell = sv("circle", { r: 3.5, fill: PALE, opacity: 0 }, DST);
    if (HAS.draw) { gsap.set(path, { drawSVG: "0%" }); tl.to(path, { drawSVG: "100%", duration: 0.7, ease: "power2.in" }, 1.3); }
    if (HAS.mp) tl.set(shell, { opacity: 1 }, 1.3).to(shell, { motionPath: { path, align: path, alignOrigin: [0.5, 0.5] }, duration: 0.7, ease: "power2.in" }, 1.3);
    tl.set(shell, { opacity: 0 }, 2.0).to(path, { opacity: 0, duration: 0.3 }, 2.0);
    // impact
    const parts = buildFrame();
    tl.add(() => {
      flash(0.22, 0.9, FIRE); quake(11, 0.7);
      const c = vrect(CR), ix = c.x + c.w * 0.72, iy = c.y + c.h * 0.45;
      burst(ix, iy, { n: 60, colors: [MUD, MUD2, DEEP, "#3A3526"], shape: "clod", speed: 7, g: 0.3, drag: 0.985, spread: 2.2, size: 3.2, life: 75 });
      burst(ix, iy, { n: 18, colors: ["rgba(110,100,71,.55)", "rgba(92,94,76,.5)", "rgba(169,174,114,.25)"], shape: "dust", speed: 2.2, g: -0.015, drag: 0.96, size: 30, grow: 1.1, life: 120, alpha: 0.7 });
      burst(ix, iy, { n: 16, colors: [PALE, FIRE], shape: "spark", speed: 6, g: 0.1, drag: 0.93, size: 2, life: 26 });
    }, 2.0);
    if (CTEXT) gsap.set(CTEXT, { opacity: 0 });
    // les lettres du titre retombent en place
    if (HAS.split && CTITLE) tl.add(() => {
      const sp = SplitText.create(CTITLE, { type: "chars" }); CROWNED.splits.push(sp);
      gsap.from(sp.chars, { y: -60, opacity: 0, rotation: () => gsap.utils.random(-30, 30), duration: 0.9, ease: "bounce.out", stagger: { each: 0.035, from: "random" } });
    }, 2.15);
    enterFrame(tl, parts, 2.25);
    if (CTEXT) tl.add(() => { CTEXT.textContent = crownText(3); }, 2.3).fromTo(CTEXT, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, 2.6);
    tl.add(() => { CROWNED.splits.forEach(s => s.revert()); CROWNED.splits = []; }, 3.4);
  }
  function revoke(tl){
    const parts = [...DECO.querySelectorAll(".kfx-frm g g, .kfx-sacs g")];
    tl.add(() => { const c = vrect(CR); burst(c.cx, c.y + c.h, { n: 12, colors: ["rgba(110,100,71,.45)"], shape: "dust", speed: 1.2, g: 0, size: 22, grow: 0.6, life: 80, jx: c.w, alpha: 0.6 }); }, 0)
      .to(parts, { y: () => gsap.utils.random(12, 34), rotation: () => gsap.utils.random(-20, 20), opacity: 0, duration: 0.6, ease: "power2.in", stagger: { each: 0.004, from: "random" } }, 0);
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
    commit(true); makeRoom();
    if (!animate || !anim()) { staticOn(); return; }
    CR.classList.add("onstage");
    const tl = sub(gsap.timeline());
    focusCrown(tl);
    tl.to(VEIL, { opacity: 0.85, duration: 0.6, ease: "power2.out" }, 0);
    // la cérémonie se construit après le défilement : les positions sont alors justes
    tl.call(() => {
      prepStage();
      const inner = gsap.timeline({ onComplete: () => {
        CROWNED.tl = null;
        sub(gsap.to(VEIL, { opacity: 0, duration: 1.1, ease: "power2.inOut", onComplete: cleanStage }));
      } });
      CROWNED.tl = inner;
      play(inner);
      inner.seek(0.5);
    });
  }
  function crownOff(animate){
    const running = !!CROWNED.tl || CROWNED.subs.length > 0;
    killCeremony();
    if (!CR) return;
    if (running) { clearPersist(); staticOn(); }
    const done = () => { clearPersist(); commit(false); };
    if (!animate || !anim() || !DECO.children.length) { done(); return; }
    const tl = gsap.timeline({ onComplete: () => { CROWNED.tl = null; done(); } });
    CROWNED.tl = tl; revoke(tl);
  }

  /* ---------- ouverture : sur-titre et nom tapés à la machine ---------- */
  let OPEN = null;
  function playOpening(){
    if (!anim()) return;
    const fname = $(".kfx-fname", ROOT), eb = $(".eyebrow", ROOT), bar = $(".accentbar", ROOT);
    const tl = OPEN = gsap.timeline({ onComplete: () => { OPEN = null; } });
    tl.fromTo(".fond", { opacity: 0 }, { opacity: 1, duration: 1.6, ease: "power2.out", clearProps: "opacity" }, 0);
    const lead = [$(".back", ROOT), $(".meta .chip", ROOT)].filter(Boolean);
    if (lead.length) tl.from(lead, { opacity: 0, duration: 0.6, stagger: 0.1, clearProps: "opacity" }, 0.5);
    if (eb) tl.add(typeIn(eb, eb.textContent, 0.7), 0.2);
    if (fname) tl.add(typeIn(fname, fname.textContent, 1.0), 0.75);
    if (bar) tl.from(bar, { scaleX: 0, transformOrigin: "0 50%", duration: 0.9, ease: "power2.inOut", clearProps: "transform" }, 1.6);
  }

  /* ============================================================
     PORTRAIT DU DIRIGEANT : « Viseur » au survol du bloc
     ============================================================ */
  let PO = null;
  function portraitLayer(){
    const por = $(".leader .portrait", ROOT); if (!por) return null;
    if (PO && PO.por === por) return PO;
    const s = sv("svg", { class: "kfx-pov", viewBox: "-14 -14 124 124", "aria-hidden": "true" }, por);
    const br = [[0, 0, 1, 1], [96, 0, -1, 1], [0, 96, 1, -1], [96, 96, -1, -1]].map(([x, y, sx, sy]) =>
      sv("path", { d: `M${x + sx * 16} ${y - sy * 7} H${x - sx * 7} V${y + sy * 16}`, fill: "none", stroke: BRIGHT, "stroke-width": 1.6 }, s));
    const ch = [sv("path", { d: "M-6 48 H34 M62 48 H102", stroke: BRIGHT, "stroke-width": 0.9, fill: "none" }, s),
                sv("path", { d: "M48 -6 V34 M48 62 V102", stroke: BRIGHT, "stroke-width": 0.9, fill: "none" }, s)];
    const tk = sv("g", { stroke: KHAKI, "stroke-width": 0.9 }, s);
    for (let i = 0; i <= 8; i++) { const v = 4 + i * 11, l = i % 4 ? 3 : 6; sv("path", { d: `M${v} 48 v${-l}`, fill: "none" }, tk); sv("path", { d: `M48 ${v} h${l}`, fill: "none" }, tk); }
    const lab = sv("text", { x: 92, y: 10, "text-anchor": "end", fill: BRIGHT, "font-family": "Marcellus, Georgia, serif", "font-size": 8, "letter-spacing": 1 }, s); lab.textContent = "88";
    const cs = $$("svg:not(.kfx-pov) circle", por);
    PO = { por, s, br, ch, tk, lab, icon: $("svg:not(.kfx-pov)", por), r2: cs[1], r3: cs[2] };
    gsap.set([...br, ...ch, tk, lab], { opacity: 0 });
    return PO;
  }
  function portraitEnter(P){
    const tl = gsap.timeline();
    tl.fromTo(P.br, { opacity: 0, x: i => [-12, 12, -12, 12][i], y: i => [-12, -12, 12, 12][i] }, { opacity: 1, x: 0, y: 0, duration: 0.32, ease: "power3.out", stagger: 0.03 }, 0);
    if (HAS.draw) tl.add(gsap.fromTo(P.ch, { opacity: 1, drawSVG: "50% 50%" }, { drawSVG: "0% 100%", duration: 0.35, ease: "power2.out" }), 0.12);
    else tl.fromTo(P.ch, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.12);
    tl.fromTo(P.tk, { opacity: 0 }, { opacity: 0.8, duration: 0.2 }, 0.3)
      .fromTo(P.lab, { opacity: 0 }, { opacity: 1, duration: 0.1 }, 0.3)
      .fromTo(P.icon, { scale: 1 }, { scale: 0.86, duration: 0.3, ease: "power3.out", transformOrigin: "50% 50%" }, 0.1);
    if (HAS.scr) { P.lab.textContent = "88"; tl.add(gsap.to(P.lab, { duration: 0.6, scrambleText: { text: "1 284 M", chars: DIGITS, speed: 0.7 } }), 0.35); }
    else tl.add(() => { P.lab.textContent = "1 284 M"; }, 0.35);
    return tl;
  }
  function portraitLeave(P){
    return gsap.timeline().to(P.br, { opacity: 0, x: i => [-10, 10, -10, 10][i], y: i => [-10, -10, 10, 10][i], duration: 0.25, ease: "power2.in" }, 0)
      .to([...P.ch, P.tk, P.lab], { opacity: 0, duration: 0.2 }, 0).to(P.icon, { scale: 1, duration: 0.4, ease: "power3.out" }, 0);
  }

  /* ---------- page vivante : dévoilement au défilement, portrait ---------- */
  let living = null;
  function setupLiving(fresh){
    if (living) living(); living = null;
    if (!anim()) return;
    const triggers = [];
    if (HAS.st && fresh) {
      const els = $$(":scope > *", ROOT).filter(e => !e.matches(".back, .eyebrow, h2, .meta, .herotable")).concat($$(".herotable > .hrow", ROOT));
      gsap.set(els, { clipPath: "inset(0 0 100% 0)", opacity: 0.001 });
      triggers.push(...ScrollTrigger.batch(els, { start: "top 92%", once: true, onEnter: batch => gsap.to(batch, { clipPath: "inset(0 0 0% 0)", opacity: 1, duration: 0.9, ease: "power2.out", stagger: 0.1, clearProps: "clipPath,opacity" }) }));
    }
    const LEAD = $(".leader", ROOT), P = portraitLayer();
    let pa, pb, ptl = null, ptimer = 0;
    const enter = () => {
      clearTimeout(ptimer); if (ptl) ptl.kill(); if (pa) pa.kill(); if (pb) pb.kill();
      // le cadran tourne par crans, comme un télémètre
      if (P.r2) pa = gsap.to(P.r2, { rotation: "+=30", svgOrigin: "12 12", duration: 0.25, ease: "power3.out", repeat: -1, repeatDelay: 0.45 });
      if (P.r3) pb = gsap.to(P.r3, { rotation: "-=15", svgOrigin: "12 12", duration: 0.25, ease: "power3.out", repeat: -1, repeatDelay: 0.7 });
      ptl = portraitEnter(P);
    };
    const leave = () => {
      if (pa) pa.kill(); if (pb) pb.kill();
      gsap.to([P.r2, P.r3].filter(Boolean), { rotation: 0, svgOrigin: "12 12", duration: 0.6, ease: "power3.out" });
      if (ptl) ptl.kill(); ptl = portraitLeave(P);
    };
    // écran tactile : un toucher joue l'effet puis le retire
    const tap = () => { enter(); clearTimeout(ptimer); ptimer = setTimeout(leave, 1800); };
    if (LEAD && P) {
      if (canHover) { LEAD.addEventListener("pointerenter", enter); LEAD.addEventListener("pointerleave", leave); }
      else LEAD.addEventListener("click", tap);
    }
    living = () => {
      triggers.forEach(t => t.kill());
      if (LEAD) { LEAD.removeEventListener("pointerenter", enter); LEAD.removeEventListener("pointerleave", leave); LEAD.removeEventListener("click", tap); }
      clearTimeout(ptimer); if (pa) pa.kill(); if (pb) pb.kill(); if (ptl) ptl.kill();
    };
  }

  /* ============================================================
     FOND « REGISTRE » : papier réglé et bâtonnets de décompte
     Redessiné seulement quand quelque chose change (un bâtonnet qui se
     trace, la souris qui bouge, la page qui tourne) : le reste du temps,
     la boucle ne fait rien.
     ============================================================ */
  const BG = { cv: null, ctx: null, raf: 0, prev: 0, st: null, dirty: true, my: -999 };
  function bgSize(){
    if (!BG.cv) return;
    const s = LIGHT ? 1 : Math.min(1.5, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    BG.cv.width = Math.round(W * s); BG.cv.height = Math.round(H * s); BG.ctx.setTransform(s, 0, 0, s, 0, 0);
    const R = W / 2 + 330, st = { tallies: [], next: 600, cur: null, fade: 0, W, H };   // à droite de la colonne de lecture
    st.zone = W >= 1100 ? { x: R + 70, w: W - R - 110, y: 120, h: H - 180 } : { x: 24, w: W - 48, y: 100, h: H - 140 };
    st.cols = Math.max(1, Math.floor(st.zone.w / 64)); st.rows = Math.max(1, Math.floor(st.zone.h / 34));
    st.cap = st.cols * st.rows * 5;
    if (LIGHT || !anim()) { const n = Math.floor(st.cap * 0.35); for (let k = 0; k < n; k++) st.tallies.push(k); }
    BG.st = st; BG.dirty = true;
    if (!BG.raf) bgDraw();
  }
  function strokeAt(st, k){
    const g = Math.floor(k / 5), j = k % 5, col = g % st.cols, row = Math.floor(g / st.cols);
    const x = st.zone.x + col * 64, y = st.zone.y + row * 34 + 6;
    return j < 4 ? [x + j * 8, y, x + j * 8 + 1, y + 20] : [x - 5, y + 17, x + 31, y + 3];
  }
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  function bgDraw(){
    const c = BG.ctx, st = BG.st, W = st.W, H = st.H;
    c.clearRect(0, 0, W, H);
    c.lineWidth = 1;
    for (let y = 72; y < H; y += 34) {
      const near = Math.max(0, 1 - Math.abs(y - BG.my) / 40);
      c.strokeStyle = rgba(KHAKI, 0.05 + near * 0.12);
      c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke();
    }
    if (W >= 1100) { const mx = st.zone.x - 34; c.strokeStyle = rgba(DEEP, 0.4); c.beginPath(); c.moveTo(mx + 0.5, 0); c.lineTo(mx + 0.5, H); c.moveTo(mx + 4.5, 0); c.lineTo(mx + 4.5, H); c.stroke(); }
    const a = (W >= 1100 ? 0.42 : 0.16) * (1 - st.fade);
    c.lineCap = "round"; c.lineWidth = 1.6; c.strokeStyle = rgba(BRIGHT, a);
    c.beginPath();
    st.tallies.forEach(k => { const [x1, y1, x2, y2] = strokeAt(st, k); c.moveTo(x1, y1); c.lineTo(x2, y2); });
    c.stroke();
    if (st.cur) { const [x1, y1, x2, y2] = strokeAt(st, st.cur.k), p = Math.min(1, st.cur.p); c.strokeStyle = rgba(PALE, a * 1.4); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p); c.stroke(); }
    BG.dirty = false;
  }
  function bgLoop(ts){
    BG.raf = requestAnimationFrame(bgLoop);
    const dt = BG.prev ? Math.min(64, ts - BG.prev) : 16; BG.prev = ts;
    const st = BG.st; if (!st) return;
    st.next -= dt;
    if (!st.cur && st.next <= 0 && st.tallies.length < st.cap) st.cur = { k: st.tallies.length, p: 0 };
    if (st.cur) { st.cur.p += dt / 260; BG.dirty = true; if (st.cur.p >= 1) { st.tallies.push(st.cur.k); st.cur = null; st.next = 700 + Math.random() * 900; } }
    if (st.tallies.length >= st.cap) { st.fade += dt / 1500; BG.dirty = true; if (st.fade >= 1) { st.tallies = []; st.fade = 0; } }
    if (BG.dirty) bgDraw();
  }
  const bgMouse = e => { if (Math.abs(e.clientY - BG.my) > 1) { BG.my = e.clientY; BG.dirty = true; } };
  function bgVis(){ if (!BG.cv) return; if (document.hidden) { cancelAnimationFrame(BG.raf); BG.raf = 0; BG.prev = 0; } else if (anim() && !LIGHT && !BG.raf) BG.raf = requestAnimationFrame(bgLoop); }
  function bgStart(){
    if (BG.cv) return;
    BG.cv = document.createElement("canvas"); BG.cv.id = "kfxbg"; BG.cv.setAttribute("aria-hidden", "true");
    const fond = $(".fond"); if (fond && fond.nextSibling) fond.parentNode.insertBefore(BG.cv, fond.nextSibling); else document.body.prepend(BG.cv);
    BG.ctx = BG.cv.getContext("2d"); BG.my = -999;
    window.addEventListener("resize", bgSize); document.addEventListener("visibilitychange", bgVis);
    bgSize();
    if (!anim() || LIGHT) return;
    if (canHover) window.addEventListener("pointermove", bgMouse, { passive: true });
    gsap.fromTo(BG.cv, { opacity: 0 }, { opacity: 1, duration: 1.8, ease: "power1.out", clearProps: "opacity" });
    BG.prev = 0; BG.raf = requestAnimationFrame(bgLoop);
  }
  function bgStop(){
    if (!BG.cv) return;
    cancelAnimationFrame(BG.raf); BG.raf = 0; gsap.killTweensOf(BG.cv);
    window.removeEventListener("resize", bgSize); document.removeEventListener("visibilitychange", bgVis); window.removeEventListener("pointermove", bgMouse);
    BG.cv.remove(); BG.cv = null; BG.ctx = null; BG.st = null;
  }

  /* ---------- redimensionnement : redessiner l'encadré ---------- */
  let rz = 0;
  window.addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (active && CROWNED.on && !CROWNED.tl && !CROWNED.subs.length) { clearPersist(); staticOn(); } }, 250); });

  /* ---------- points d'entrée appelés par script.js (via CytFX) ---------- */
  function deactivate(){
    if (!active) return;
    active = false;
    if (OPEN) { OPEN.kill(); OPEN = null; }
    killCeremony(); clearPersist();
    if (living) { living(); living = null; }
    bgStop();
    document.body.classList.remove("fx-krieg");
    ROOT = CR = DECO = CTITLE = CTEXT = null; PO = null;
  }
  function onView(fac, viewId, opts){
    opts = opts || {};
    deactivate();
    if (fac !== FAC || viewId !== "v-factio") return;
    ROOT = $("#factioDetail"); if (!ROOT || !ROOT.classList.contains("factio-" + FAC)) return;
    layers();
    active = true;
    document.body.classList.add("fx-krieg");
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
        if (CTEXT) CTEXT.textContent = crownText(2);
        pendingCrown = gsap.delayedCall(0.7, () => { pendingCrown = null; crownOn(true); });
      } else crownOn(false);
    } else if (!nowC && wasC && CROWNED.on) {
      CROWNED.on = false;
      if (anim()) { CR.classList.add("unlocked"); CR.classList.remove("locked"); if (CTEXT) CTEXT.textContent = crownText(3); }
      crownOff(true);
    }
  }
  chain({ onView, onAdjust });
})();
