/* FILE: help.js  (GitHub par isi naam se upload karein) */
/* A2Z Sahayak: website ke andar ka help agent.
 * Ye ek built-in guide hai (internet / AI service nahi chahiye, koi data bahar nahi jata). Sawal ko samajh kar
 * website ke manual me se sabse sahi jawab step-by-step dikhata hai. Password, OTP, SETUP_CODE jaisi gupt cheezein
 * na iske paas hain, na ye unke baare me bataega. Public site par sirf public jankari (is file me niche) hoti hai;
 * staff aur admin ki jankari alag files (kb-staff.js, kb-admin.js) me hai jo sirf unke pages par load hoti hain. */
(function () {
  'use strict';
  var KB = [];

  /* ---------- text samajhna ---------- */
  var STOP = {};
  ('kaise kya hai hain ka ki ke ko me mein se par pe mujhe mere meri mera main mai aap bataiye batao bataen batayein bata kahan kaha kaun kab kitna kitni kisi ek aur to ye yeh wo woh karna karein kare kar karen sakte sakta sakti chahiye hota hoti hote ho the tha thi is us isme usme how to do i what where can my of in and the a an is are me please plz sir bhai ji hu hoon hun raha rahi rahe liye lie wala wali jaise jaisa kuch koi kyun kyu agar toh bhi hi na nahi nhi dikhao dikhaye dikhaiye samjhao samjhaiye batana' +
    ' का की के को में से पर है हैं कैसे क्या कहाँ कहां मुझे मैं और एक कर करें करना सकते नहीं भी तो यह वह').split(' ').forEach(function (w) { if (w) STOP[w] = 1; });

  function tokens(s) {
    s = String(s || '').toLowerCase().replace(/[़ँं]/g, '');
    return (s.match(/[a-z0-9ऀ-ॿ]+/g) || []);
  }
  /* Roman spelling ke farak (hazri/hajri, form/pharm, aprooval/approval) barabar karne ke liye */
  function ph(t) {
    if (/[ऀ-ॿ]/.test(t)) return t;
    t = t.replace(/(.)\1+/g, '$1').replace(/ph/g, 'f').replace(/sh/g, 's').replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/z/g, 'j').replace(/w/g, 'v').replace(/q/g, 'k').replace(/e/g, 'i').replace(/o/g, 'u').replace(/y(?=[aiu])/g, 'i');
    return t.replace(/h$/, '');
  }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 2;
    var i, j, p = [], c;
    for (j = 0; j <= b.length; j++) p[j] = j;
    for (i = 1; i <= a.length; i++) { var prev = p[0]; p[0] = i; for (j = 1; j <= b.length; j++) { c = p[j]; p[j] = Math.min(p[j] + 1, p[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = c; } }
    return p[b.length];
  }
  function cp(a, b) { var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; }
  function keyTokens(s) { return tokens(s).filter(function (w) { return !STOP[w]; }).map(ph); }

  /* ---------- knowledge base ---------- */
  function prep(e) {
    e._k = (e.kw || []).map(function (k) { return keyTokens(k); });
    e._t = keyTokens(e.title);
    return e;
  }
  function add(list) { list.forEach(function (e) { KB.push(prep(e)); }); }

  function score(e, q) {
    var s = 0, qs = q.join(' ');
    q.forEach(function (w) {
      var best = 0;
      e._k.forEach(function (ks) { ks.forEach(function (t) { var v = 0; if (t === w) v = 3; else if (w.length >= 4 && t.length >= 4 && (t.indexOf(w) === 0 || w.indexOf(t) === 0)) v = 2; else if (w.length >= 5 && t.length >= 5 && lev(w, t) <= 1) v = 1.6; else if (w.length >= 5 && t.length >= 5 && cp(w, t) >= 4 && cp(w, t) >= 0.6 * Math.min(w.length, t.length)) v = 1.5; if (v > best) best = v; }); });
      e._t.forEach(function (t) { var v = 0; if (t === w) v = 2; else if (w.length >= 4 && t.length >= 4 && (t.indexOf(w) === 0 || w.indexOf(t) === 0)) v = 1.4; if (v > best) best = v; });
      s += best;
    });
    e._k.forEach(function (ks) { if (ks.length > 1 && ks.every(function (t) { return qs.indexOf(t) >= 0; })) s += 3 + ks.length; });
    return s;
  }
  function find(text, aud, n) {
    var q = keyTokens(text), out = [];
    if (!q.length) return out;
    KB.forEach(function (e) { if (e.a && e.a.indexOf(aud) < 0) return; var s = score(e, q); if (s > 0) out.push({ e: e, s: s }); });
    out.sort(function (a, b) { return b.s - a.s; });
    return out.slice(0, n || 3);
  }

  /* ---------- gupt cheezein: inka jawab kabhi nahi ---------- */
  var SECRET = /(password|pass ?word|passwd|pasword|paswd|otp|setup[ _-]?code|token|secret|api[ _-]?key|apikey|hash|pin\b|पासवर्ड|ओटीपी|टोकन)/i;
  var HOWTO = /(badal|change|set\b|bana|reset|bhul|bhool|forgot|nahi ?aa|nahin ?aa|nhi ?aa|kaise|surakshit|safe|lock|kitne|akshar|kya karu|बदल|भूल|कैसे)/i;
  var ATTACK = /(hack|crack|bypass|chori|chura|tod\b|todna|leak|dusre ka|someone else|kisi aur ka|bina login|without login|sql|inject|exploit|brute)/i;
  var DEFEND = /(kya ?kar(ein|en|u|e)\b|bachao|bachaye|bachana|bachne|rokna|rokne|roke\b|ho ?gay[ai]|ho ?raha|ho ?rahi|kar ?raha ?hai|kar ?rahe ?hain|alert|suraksha|surakshit)/i;
  function isSecretAsk(t) { return (SECRET.test(t) && !HOWTO.test(t) && !DEFEND.test(t)) || (ATTACK.test(t) && !DEFEND.test(t) && /(admin|login|account|password|otp|sheet|data|panel|पासवर्ड)/i.test(t)); }

  /* ---------- screen ---------- */
  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }

  function renderAnswer(e) {
    var box = el('div', 'hlp-m'); box.appendChild(el('h4', '', e.title));
    if (e.intro) box.appendChild(el('p', '', e.intro));
    if (e.where) box.appendChild(el('div', 'hlp-where', 'Kahan milega: ' + e.where));
    if (e.steps && e.steps.length) { var ol = el('ol'); e.steps.forEach(function (s) { ol.appendChild(el('li', '', s)); }); box.appendChild(ol); }
    if (e.tip) box.appendChild(el('div', 'hlp-tip', 'Dhyan rakhein: ' + e.tip));
    return box;
  }

  function mount(root, aud, o) {
    o = o || {}; root.textContent = '';
    var wrap = el('div', 'hlp'), log = el('div', 'hlp-log'), chips = el('div', 'hlp-chips'), form = el('form', 'hlp-form'), inp = el('input'), btn = el('button', '', 'Poochhein');
    log.setAttribute('aria-live', 'polite'); inp.type = 'text'; inp.maxLength = o.ai ? 400 : 200; inp.placeholder = 'Apna sawal likhein, jaise: admission form kahan se milega?'; inp.setAttribute('aria-label', 'Apna sawal'); btn.type = 'submit';
    form.appendChild(inp); form.appendChild(btn);
    var aiBtn = null, hist = [], aiBusy = false;
    if (o.ai) { aiBtn = el('button', 'hlp-ai', 'A2Z Sahayak se poochhein (AI)'); aiBtn.type = 'button'; aiBtn.title = 'A2Z Sahayak (AI) website ko padhkar jawab deta hai'; form.appendChild(aiBtn); }
    var mine = KB.filter(function (e) { return !e.a || e.a.indexOf(aud) >= 0; });
    function say(node) { log.appendChild(node); log.scrollTop = log.scrollHeight; }
    function suggest(list, label) {
      var d = el('div', 'hlp-m'); d.appendChild(el('div', 'hlp-where', label)); var c = el('div', 'hlp-chips');
      list.forEach(function (e) { var b = el('button', 'hlp-chip', e.title); b.type = 'button'; b.addEventListener('click', function () { ask(e.title, e); }); c.appendChild(b); });
      d.appendChild(c); say(d);
    }
    function allTopics() {
      var d = el('div', 'hlp-m'), cats = {}, order = [];
      mine.forEach(function (e) { var c = e.cat || 'Anya'; if (!cats[c]) { cats[c] = []; order.push(c); } cats[c].push(e); });
      d.appendChild(el('h4', '', 'Sab topics'));
      order.forEach(function (c) { d.appendChild(el('div', 'hlp-cat', c)); var cc = el('div', 'hlp-chips'); cats[c].forEach(function (e) { var b = el('button', 'hlp-chip', e.title); b.type = 'button'; b.addEventListener('click', function () { ask(e.title, e); }); cc.appendChild(b); }); d.appendChild(cc); });
      say(d);
    }
    function ask(text, direct) {
      text = String(text || '').trim().slice(0, 200); if (!text) return;
      say(el('div', 'hlp-m me', text));
      if (direct) { say(renderAnswer(direct)); related(direct); return; }
      if (/^(sab|saare|all|list|topics?|menu)\b/i.test(text) || /sab (topics|sawal|cheez)/i.test(text)) { allTopics(); return; }
      if (isSecretAsk(text)) {
        var m = renderAnswer({ title: 'Ye jankari gupt hai', intro: 'Password, OTP, SETUP_CODE, login token aur dusron ki private jankari main nahi bata sakta, aur ye kisi ko batani bhi nahi chahiye. Isse website aur sabka paisa surakshit rehta hai.', tip: 'Agar aap apna password bhool gaye hain ya badalna chahte hain, to "password badalna" ya "password bhool gaya" poochhein, uska surakshit tareeka bata dunga.' });
        m.classList.add('hlp-lock'); say(m); return;
      }
      var hits = find(text, aud, 3);
      if (hits.length && hits[0].s >= 3) {
        say(renderAnswer(hits[0].e)); related(hits[0].e);
        var others = hits.slice(1).filter(function (h) { return h.s >= Math.max(3, hits[0].s * 0.6); }).map(function (h) { return h.e; });
        if (others.length) suggest(others, 'Ya aapka matlab ye tha?');
      } else {
        var near = hits.map(function (h) { return h.e; });
        var d = el('div', 'hlp-m'); d.appendChild(el('h4', '', 'Is sawal ka seedha jawab mujhe nahi mila'));
        d.appendChild(el('p', '', 'Kripya sawal thoda alag shabdon me likhein (jaise "attendance kaise bharein", "ID card kahan se nikale"), ya neeche se koi topic chunein. Phir bhi na mile to apne admin / A2Z office se sampark karein.'));
        say(d); suggest(near.length ? near : mine.slice(0, 5), near.length ? 'Shayad ye kaam aaye:' : 'Aam sawal:');
      }
    }
    function snippets(text) {
      return find(text, aud, 5).map(function (h) { var e = h.e; return { t: e.title, x: [e.intro || '', (e.steps || []).map(function (x, i) { return (i + 1) + '. ' + x; }).join(' '), e.tip ? 'Dhyan: ' + e.tip : ''].join(' ').trim().slice(0, 700) }; });
    }
    function askAI(text) {
      text = String(text || '').trim().slice(0, 400); if (!text || !o.ai || aiBusy) return;
      say(el('div', 'hlp-m me', text));
      var wait = el('div', 'hlp-m', 'A2Z Sahayak (AI) soch raha hai...'); say(wait); aiBusy = true; aiBtn.disabled = true;
      o.ai(text, snippets(text), hist.slice(-4)).then(function (r) {
        var box = el('div', 'hlp-m hlp-aim'); box.appendChild(el('div', 'hlp-where', 'A2Z Sahayak (AI)'));
        String(r && r.text || '').split(/\n+/).forEach(function (ln) { if (ln.trim()) box.appendChild(el('p', '', ln)); });
        box.appendChild(el('div', 'hlp-note', 'AI galat ho sakta hai. Zaruri baat ek baar khud jaanch lein.'));
        wait.replaceWith(box);
        if (r && r.ai) { hist.push({ r: 'u', c: text }); hist.push({ r: 'a', c: String(r.text || '').slice(0, 500) }); }
      }, function (e) {
        var box = el('div', 'hlp-m hlp-lock'); box.appendChild(el('h4', '', 'AI abhi jawab nahi de paya')); box.appendChild(el('p', '', (e && e.message) || 'Thodi der baad dobara try karein.'));
        wait.replaceWith(box);
      }).then(function () { aiBusy = false; aiBtn.disabled = false; log.scrollTop = log.scrollHeight; });
    }
    function related(e) { if (!e.rel) return; var r = e.rel.map(function (id) { return mine.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean); if (r.length) suggest(r, 'Isse jude sawal:'); }
    form.addEventListener('submit', function (ev) { ev.preventDefault(); var v = inp.value; inp.value = ''; ask(v); inp.focus(); });
    if (aiBtn) aiBtn.addEventListener('click', function () { var v = inp.value; inp.value = ''; askAI(v); inp.focus(); });

    var d0 = el('div', 'hlp-m'); d0.appendChild(el('h4', '', 'Namaste! Main A2Z Sahayak hu'));
    d0.appendChild(el('p', '', o.hello || 'Website me jo bhi kaam hote hain, unka step-by-step tareeka main bata sakta hu. Apna sawal likhein ya neeche se chunein.'));
    say(d0);
    var qs = (o.quick || []).map(function (id) { return mine.filter(function (x) { return x.id === id; })[0]; }).filter(Boolean);
    qs.forEach(function (e) { var b = el('button', 'hlp-chip', e.title); b.type = 'button'; b.addEventListener('click', function () { ask(e.title, e); }); chips.appendChild(b); });
    var all = el('button', 'hlp-chip', 'Sab topics dekhein'); all.type = 'button'; all.addEventListener('click', function () { ask('sab topics'); }); chips.appendChild(all);
    wrap.appendChild(log); wrap.appendChild(chips); wrap.appendChild(form);
    wrap.appendChild(el('div', 'hlp-note', o.ai ? 'Pehle "Poochhein" built-in guide se jawab deta hai. "AI se poochhein" sawal Groq AI ko bhejta hai (sawal ke saath website ka manual). Password, OTP, SETUP_CODE kabhi nahi bheje jate.' : 'Ye website ka built-in guide hai (AI service nahi). Gupt cheezein (password, OTP, SETUP_CODE) ye kabhi nahi batata.'));
    root.appendChild(wrap);
    return { ask: ask };
  }

  /* ---------- PUBLIC KB (sab visitors ke liye) ---------- */
  add([
    { id: 'p-about', a: ['pub', 'staff', 'admin'], cat: 'A2Z Build Tech', title: 'A2Z Build Tech kya karta hai?', kw: ['a2z', 'company', 'firm', 'kaam', 'business', 'about', 'kya karte', 'manpower supplier', 'civil'],
      intro: 'A2Z Build Tech (All Type Manpower Supplier) civil aur mechanical kaam tatha manpower supply karta hai: mistri, helper, welder, fitter jaise sab trade ke log company/site par bheje jaate hain.', where: 'Website ka Home page', steps: ['Home page par "What we do" me hamare kaam ki list hai.', 'Kisi bhi kaam par dabane se uski vidhi (method) khulti hai.', 'Pata: Vivek Nagar, Ward No. 19, Maihar, MP - 485771.'], rel: ['p-contact', 'p-manpower'] },
    { id: 'p-mech', a: ['pub', 'staff', 'admin'], cat: 'Sewayein', title: 'Mechanical kaam (fabrication, welding, piping) aur uske formule / material kahan dekhein?', kw: ['mechanical', 'mechanic', 'mechanical kaam', 'fabrication', 'welding', 'welder', 'fitter', 'pipe fitter', 'piping', 'rigging', 'machine', 'erection', 'mechanical formula', 'mechanical calculator', 'mechanical material', 'material a to z', 'plate weight', 'pipe weight', 'pump motor', 'electrode', 'mechanical manpower'],
      intro: 'A2Z Build Tech civil ke saath mechanical kaam ke liye bhi manpower aur kaam supply karta hai. Website me civil aur mechanical dono ke alag hisse hain; hisaab, hazri aur bill ka tareeka dono me ek jaisa hai.', where: 'Website ke Services, Calculators, Formulas aur Manpower page', steps: ['Upar "Civil work" ya "Mechanical work" wala button dabakar hissa badlein (ye Services, Calculators, Manpower aur Formulas page par hai).', 'Services and methods me mechanical kaam ki vidhi hai: structural fabrication, welding, pipe fitting, machine erection, rigging, gas cutting, sheet metal, scaffolding, painting, maintenance, boiler hydro test aur mechanical manpower.', 'Calculators me 9 mechanical calculator hain: plate weight, bar/angle/tube, beam/channel, pipe, welding electrode, steel painting, fabrication job cost, pump-motor aur torque-speed.', 'Formulas me mechanical ke sab formule aur "Materials and consumables, A to Z" ki suchi hai.', 'Manpower me fitter, welder, pipe fitter, rigger, millwright jaise mechanical trade ke daily rate hain.'], tip: 'Rate anumaanit hain aur admin Settings / Rates me badle ja sakte hain. Antim rate agreement me tay hota hai.', rel: ['p-calc', 'p-manpower', 'p-formulas'] },
    { id: 'p-contact', a: ['pub', 'staff', 'admin'], cat: 'A2Z Build Tech', title: 'Sampark kaise karein / quote kaise maangein?', kw: ['contact', 'sampark', 'phone', 'number', 'address', 'pata', 'quote', 'enquiry', 'sawal', 'request', 'quote maangna', 'sampark karna', 'call'],
      where: 'Upar menu me "Contact"', steps: ['Upar menu me "Contact" dabayein.', 'Neeche form me apna naam, phone, kaun sa kaam chahiye aur site ki jagah likhein.', '"Send request" dabayein. Request seedhi hamein pahunch jati hai aur hum aapko phone karte hain.', 'Agar internet / server na mile to request ka text dikhega; use "Copy request" dabakar phone / WhatsApp se bhej dein.'], tip: 'Aapka naam aur mobile sirf hamare paas aate hain; sampark ke alawa kahin use nahi hote.' },
    { id: 'p-manpower', a: ['pub', 'staff', 'admin'], cat: 'Sewayein', title: 'Manpower (mistri, helper) ka rate kahan dekhein?', kw: ['manpower', 'rate', 'majdoor', 'mazdoor', 'mistri', 'helper', 'welder', 'fitter', 'daily rate', 'per day', 'labour', 'labor', 'kitna lagega', 'cost'],
      where: 'Menu me "Manpower"', steps: ['Upar menu me "Manpower" dabayein.', 'Table me har trade ka per-day rate aur 26 din ka mahine ka rate dikhta hai.', 'Neeche "Manpower cost estimator" me trade aur kitne log, kitne din chuniye - kul kharch apne-aap dikhega.'], tip: 'Ye kaam-kaaj ke andaze wale rate hain. Antim rate agreement me tay hota hai.', rel: ['p-contact'] },
    { id: 'p-calc', a: ['pub', 'staff', 'admin'], cat: 'Sewayein', title: 'Kaam ka estimate / calculator kaise chalayein?', kw: ['calculator', 'estimate', 'calculation', 'hisab', 'boq', 'quantity', 'concrete', 'cement', 'eent', 'brick', 'plaster', 'kharcha', 'lagat', 'nap'],
      where: 'Menu me "Calculators"', steps: ['Upar menu me "Calculators" dabayein.', 'Kaam chuniye (jaise concrete, brickwork, plaster).', 'Lambai, chaudai, mote ki value metre me bharein - quantity aur kharch turant dikhta hai.', 'Poore kaam ka quote banane ke liye neeche "Estimate a quote (BOQ)" me har item ki quantity aur rate likhein.'] },
    { id: 'p-methods', a: ['pub', 'staff', 'admin'], cat: 'Sewayein', title: 'Kaam karne ki vidhi (method) kahan hai?', kw: ['method', 'vidhi', 'tareeka', 'services', 'seva', 'kaam ki vidhi', 'measurement', 'kaise hota hai'],
      where: 'Menu me "Services and methods"', steps: ['"Services and methods" dabayein.', 'Kisi bhi kaam par dabayein - uske steps aur billing me kaise napa jata hai, dikhega.'] },
    { id: 'p-terms', a: ['pub', 'staff', 'admin'], cat: 'Sewayein', title: 'Shartein (terms) aur payment cycle kya hai?', kw: ['terms', 'shart', 'sharten', 'shartein', 'sharte', 'payment', 'cycle', 'retention', 'agreement', 'safety', 'anubandh'],
      where: 'Menu me "Terms"', steps: ['"Terms" dabayein.', 'Har card me ek shart likhi hai (rate, payment kitne din me, retention, safety). Ye sab signed agreement me badli ja sakti hain.'] },
    { id: 'p-formulas', a: ['pub', 'staff', 'admin'], cat: 'Sewayein', title: 'Calculator ke formule kahan dekhein?', kw: ['formula', 'sutra', 'factor', 'kaise nikala'],
      where: 'Menu me "Formulas"', steps: ['"Formulas" dabayein.', 'Table me har cheez ka formula aur note hai, taaki aap khud jaanch sakein.'] },
    { id: 'p-agree', a: ['pub', 'staff', 'admin'], cat: 'Sewayein', title: 'Agreement ke form kahan se milenge?', kw: ['agreement', 'anubandh', 'contract', 'ikrarnama', 'agreement form', 'rent agreement', 'agreement download', 'agreement print'],
      where: 'Menu me "Terms" ke neeche "Agreement forms"', steps: ['Upar menu me "Terms" dabayein aur neeche "Agreement forms" tak jayein.', 'Company ke saath Manpower Supply Agreement aur Gaadi / Equipment Kiraya Agreement ki PDF kholein ya Word file download karein.', 'Rate aur shartein bharkar hamare saath sign karein.'], tip: 'Ye namoone hain; final shartein signed agreement me hi tay hoti hain.' },
    { id: 'p-theme', a: ['pub', 'staff', 'admin'], cat: 'Website', title: 'Dark / light mode kaise badlein?', kw: ['dark', 'light', 'theme', 'mode', 'andhera', 'rang', 'colour', 'color'],
      steps: ['Public site par upar daayein kone me "◐" button dabayein.', 'Staff / admin page apne phone ya computer ki dark/light setting ke hisaab se apne-aap badal jate hain.'] },
    { id: 'p-app', a: ['pub', 'staff', 'admin'], cat: 'Website', title: 'Mobile me app ki tarah kaise install karein?', kw: ['app', 'apk', 'install', 'mobile app', 'home screen', 'icon', 'bar bar link', 'shortcut', 'add to home screen', 'app banana', 'phone me rakhna', 'download app', 'play store'],
      where: 'Phone ke browser ka menu', steps: ['Android (Chrome): website kholein. Neeche "App install karein" patti aaye to use dabayein. Na aaye to Chrome ke upar daayein 3 bindu (⋮) dabayein, phir "Install app" ya "Add to Home screen".', 'iPhone: Safari me kholein (Chrome se nahi). Neeche Share (↑) dabayein, phir "Add to Home Screen", phir "Add".', 'Ab phone ki home screen par A2Z ka logo wala icon aa jayega. Use dabane par website app ki tarah poori screen me khulegi - bar-bar link dhoondhna nahi padega.', 'Staff ke liye staff page kholkar, admin ke liye admin page kholkar install karein; dono ke alag icon banenge.'], tip: 'Ye Play Store wala app nahi, website ka hi app roop hai; update apne-aap milte rehte hain. Internet band ho to screen khulegi, par hisaab / hazri ke liye internet chahiye.' },
    { id: 'p-phone', a: ['pub', 'staff', 'admin'], cat: 'Website', title: 'Phone par website kaise chalayein?', kw: ['mobile', 'phone', 'android', 'chrome', 'screen', 'chhoti screen', 'whatsapp'],
      steps: ['Phone ke Chrome / koi bhi browser me website ka link kholein.', 'Website chhoti screen ke hisaab se apne-aap fit ho jati hai.', 'Table bade ho to unhe ungli se daayein-baayein khiskayein.'], tip: 'Staff / admin ka link bookmark ya home screen par jod lein, taaki baar-baar na dhoondhna pade.' }
  ]);

  window.A2ZHelp = { add: add, mount: mount, find: find, isSecretAsk: isSecretAsk, count: function (aud) { return KB.filter(function (e) { return !e.a || e.a.indexOf(aud) >= 0; }).length; } };
})();
