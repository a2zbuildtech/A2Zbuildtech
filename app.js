/* A2Z Build Tech - page logic. Calculations live in calc.js, content and storage rules in data.js. */
(function(){
'use strict';
var D=A2ZData,C=A2ZCalc,METHODS=D.METHODS,FORMULAS=D.FORMULAS,TERMS=D.TERMS,CALCS=C.CALCS;
var $=function(s,r){return (r||document).querySelector(s)};
var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var noop=function(){};
var esc=C.esc;
function inr(n){return '₹'+(+n||0).toLocaleString('en-IN',{maximumFractionDigits:0})}
function inr2(n){return '₹'+(+n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}
function nf(n,d){return (+n||0).toLocaleString('en-IN',{maximumFractionDigits:d==null?2:d})}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
var toastT;
function toast(m){var t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('on')},2600)}

/* ---------- data (stored in this browser only) ---------- */
var LS='a2z_build_tech_v1';
var DB=load();
function load(){try{var r=localStorage.getItem(LS);if(r)return D.sanitize(JSON.parse(r))}catch(e){}return D.defaults()}
function save(){try{localStorage.setItem(LS,JSON.stringify(DB))}catch(e){toast('This browser blocked storage, changes will not be kept.')}}
function rateOf(id){var m=DB.mats.filter(function(x){return x.id===id})[0];return m?+m.rate||0:0}

/* ---------- shared form helper ---------- */
function fld(f,v){
  var lab=esc(f.l)+(f.u?' <em>('+esc(f.u)+')</em>':'');
  var val=(v==null||v==='')?(f.d==null?'':f.d):v;
  if(f.o){
    return '<label>'+lab+'<select name="'+f.k+'">'+f.o.map(function(o){o=Array.isArray(o)?o:[o,o];return '<option value="'+esc(o[0])+'"'+(String(o[0])===String(val)?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select></label>';
  }
  if(f.t==='area') return '<label style="grid-column:1/-1">'+lab+'<textarea name="'+f.k+'" maxlength="2000">'+esc(val)+'</textarea></label>';
  var t=f.t||(typeof f.d==='number'?'number':'text');
  var extra=t==='number'?' inputmode="decimal" step="any" min="0"':'';
  return '<label>'+lab+'<input name="'+f.k+'" type="'+t+'"'+extra+(t==='number'?'':' maxlength="300"')+(f.r?' required':'')+' value="'+esc(val)+'"></label>';
}

var calcId='concrete',calcVals={},labPct=30;
function readCalc(c){
  var root=$('#calcBox'),v={};
  c.f.forEach(function(f){var el=root.querySelector('[name="'+f.k+'"]');v[f.k]=f.o?el.value:C.n(el.value)});
  var lp=root.querySelector('[name="_lab"]');labPct=C.n(lp.value);
  calcVals[c.id]=v;return v;
}
function drawCalc(){
  var c=CALCS.filter(function(x){return x.id===calcId})[0], sv=calcVals[c.id]||{};
  $('#calcBox').innerHTML='<h3>'+esc(c.n)+'<span class="hi">'+esc(c.hi)+'</span></h3><div class="grid">'+
    c.f.map(function(f){return fld(f,sv[f.k])}).join('')+
    '<label>Labour and margin on materials <em>(%)</em><input name="_lab" type="number" inputmode="decimal" min="0" value="'+labPct+'"></label></div><div class="scroll" id="calcOut"></div>';
  calcOut();
}
function calcOut(){
  var c=CALCS.filter(function(x){return x.id===calcId})[0],v=readCalc(c),rows=c.run(v,rateOf);
  var tt=C.totals(rows,labPct),mat=tt.mat,lab=tt.lab;
  $('#calcOut').innerHTML='<table><thead><tr><th>Item</th><th class="n">Quantity</th><th>Unit</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead><tbody>'+
   rows.map(function(r){return '<tr><td>'+esc(r.label)+'</td><td class="n">'+nf(r.qty)+'</td><td>'+esc(r.unit)+'</td><td class="n">'+(r.rate!=null?inr(r.rate):'–')+'</td><td class="n">'+(r.amt!=null?inr(r.amt):'–')+'</td></tr>'}).join('')+
   '<tr class="tot"><td colspan="4">Material cost</td><td class="n">'+inr(mat)+'</td></tr>'+
   '<tr><td colspan="4">Labour and margin ('+nf(labPct,1)+'%)</td><td class="n">'+inr(lab)+'</td></tr>'+
   '<tr class="big"><td colspan="4">Estimated total</td><td class="n">'+inr(mat+lab)+'</td></tr></tbody></table>';
}

/* BOQ */
var boq=[{d:'Excavation in ordinary soil',u:'m³',q:40,r:180},{d:'PCC 1:4:8 below footings',u:'m³',q:6,r:5200},{d:'Brickwork 230 mm in 1:6 mortar',u:'m³',q:25,r:6800}];
var boqP={oh:10,pr:10,gst:18};
function syncBoq(){
  var rows=$$('#boqRows tr');
  if(rows.length||$('#boqRows')){boq=rows.map(function(tr){var g=function(n){return tr.querySelector('[name="'+n+'"]').value};return {d:g('d'),u:g('u'),q:C.n(g('q')),r:C.n(g('r'))}})}
  ['oh','pr','gst'].forEach(function(k){var el=$('#boqP [name="'+k+'"]');if(el)boqP[k]=C.n(el.value)});
}
function drawBoq(){
  $('#boqBox').innerHTML='<div class="scroll"><table><thead><tr><th>Description of work</th><th>Unit</th><th class="n">Quantity</th><th class="n">Rate (₹)</th><th class="n">Amount</th><th></th></tr></thead><tbody id="boqRows">'+
   boq.map(function(r,i){return '<tr><td><input name="d" type="text" style="min-width:220px" value="'+esc(r.d)+'"></td><td><input name="u" type="text" style="min-width:60px;width:70px" value="'+esc(r.u)+'"></td><td><input name="q" type="number" step="any" min="0" value="'+r.q+'"></td><td><input name="r" type="number" step="any" min="0" value="'+r.r+'"></td><td class="n" data-amt>'+inr(r.q*r.r)+'</td><td><button class="link danger" data-act="boqdel" data-i="'+i+'">Remove</button></td></tr>'}).join('')+
   '</tbody></table></div><div class="row"><button class="btn sec" data-act="boqadd">Add item</button></div>'+
   '<div class="grid" id="boqP"><label>Overhead <em>(%)</em><input name="oh" type="number" step="any" min="0" value="'+boqP.oh+'"></label><label>Profit <em>(%)</em><input name="pr" type="number" step="any" min="0" value="'+boqP.pr+'"></label><label>GST <em>(%)</em><input name="gst" type="number" step="any" min="0" value="'+boqP.gst+'"></label></div><div class="scroll" id="boqOut"></div>';
  boqOut();
}
function boqOut(){
  syncBoq();
  $$('#boqRows tr').forEach(function(tr,i){var c=tr.querySelector('[data-amt]');if(c)c.textContent=inr(boq[i].q*boq[i].r)});
  var bt=C.boqTotals(boq,boqP),sub=bt.sub,oh=bt.oh,pr=bt.pr,tx=bt.taxable,g=bt.gst;
  $('#boqOut').innerHTML='<table><tbody><tr><td>Work value</td><td class="n">'+inr2(sub)+'</td></tr><tr><td>Overhead</td><td class="n">'+inr2(oh)+'</td></tr><tr><td>Profit</td><td class="n">'+inr2(pr)+'</td></tr><tr class="tot"><td>Taxable amount</td><td class="n">'+inr2(tx)+'</td></tr><tr><td>GST</td><td class="n">'+inr2(g)+'</td></tr><tr class="big"><td>Total quote</td><td class="n">'+inr2(tx+g)+'</td></tr></tbody></table>';
}

/* Manpower estimator */
var mp=[{t:'mason',n:2,d:26,ot:0},{t:'helper',n:4,d:26,ot:0}];
var mpP={ot:2,svc:10,gst:18};
function trades(){return DB.labour.map(function(x){return [x.id,x.name]})}
function syncMp(){
  if($('#mpRows')){mp=$$('#mpRows tr').map(function(tr){var g=function(n){return tr.querySelector('[name="'+n+'"]').value};return {t:g('t'),n:C.n(g('n')),d:C.n(g('d')),ot:C.n(g('ot'))}})}
  ['ot','svc','gst'].forEach(function(k){var el=$('#mpP [name="'+k+'"]');if(el)mpP[k]=C.n(el.value)});
}
function drawMp(){
  mp.forEach(function(r){if(!DB.labour.some(function(x){return x.id===r.t})&&DB.labour[0])r.t=DB.labour[0].id});
  $('#mpBox').innerHTML='<div class="scroll"><table><thead><tr><th>Trade</th><th class="n">Workers</th><th class="n">Days</th><th class="n">OT hours each</th></tr></thead><tbody id="mpRows">'+
   mp.map(function(r,i){return '<tr><td><select name="t">'+trades().map(function(o){return '<option value="'+esc(o[0])+'"'+(o[0]===r.t?' selected':'')+'>'+esc(o[1])+'</option>'}).join('')+'</select></td><td><input name="n" type="number" min="0" step="1" value="'+r.n+'"></td><td><input name="d" type="number" min="0" step="any" value="'+r.d+'"></td><td><input name="ot" type="number" min="0" step="any" value="'+r.ot+'"></td><td><button class="link danger" data-act="mpdel" data-i="'+i+'">Remove</button></td></tr>'}).join('')+
   '</tbody></table></div><div class="row"><button class="btn sec" data-act="mpadd">Add trade</button></div>'+
   '<div class="grid" id="mpP"><label>Overtime multiple <em>(× hourly rate)</em><input name="ot" type="number" step="any" min="0" value="'+mpP.ot+'"></label><label>Service charge <em>(%)</em><input name="svc" type="number" step="any" min="0" value="'+mpP.svc+'"></label><label>GST <em>(%)</em><input name="gst" type="number" step="any" min="0" value="'+mpP.gst+'"></label></div><div class="scroll" id="mpOut"></div>';
  mpOut();
}
function mpOut(){
  syncMp();
  var m=C.mpTotals(mp,DB.labour,mpP),wages=m.wages,ot=m.ot,md=m.manDays,sv=m.svc,g=m.gst,tot=m.total;
  $('#mpOut').innerHTML='<table><tbody><tr><td>Wages</td><td class="n">'+inr2(wages)+'</td></tr><tr><td>Overtime</td><td class="n">'+inr2(ot)+'</td></tr><tr><td>Service charge</td><td class="n">'+inr2(sv)+'</td></tr><tr><td>GST</td><td class="n">'+inr2(g)+'</td></tr><tr class="big"><td>Total for the period</td><td class="n">'+inr2(tot)+'</td></tr><tr><td>Per man-day, all in ('+nf(md,1)+' man-days)</td><td class="n">'+(md?inr2(tot/md):'–')+'</td></tr></tbody></table>';
}

/* ---------- public views ---------- */
var V={},B={},FORMS={},ACTS={},LIVE={};
function head(t,hi,sub){return '<div style="display:grid;gap:8px"><h2>'+esc(t)+(hi?'<span class="hi">'+esc(hi)+'</span>':'')+'</h2>'+(sub?'<p class="mu">'+sub+'</p>':'')+'</div>'}
function contactCell(){var s=DB.settings;return (s.phone||s.email)?esc([s.phone,s.email].filter(Boolean).join(' · ')):'Add in Admin → Account'}

V.home=function(){
  return '<section class="hero"><div style="display:grid;gap:14px"><h1>Civil work and manpower, priced before the first brick.</h1>'+
  '<p>सिविल कार्य और मैनपावर सप्लाई। पहले हिसाब, फिर काम। Estimate your quantities, check labour rates and see our terms before you call us.</p>'+
  '<div class="row"><a class="btn" href="#calculators">Estimate your work</a><a class="btn sec" href="#contact">Request a quote</a></div></div>'+
  '<div class="tb"><div><small>Firm</small>A2Z Build Tech</div><div><small>Business</small>All type manpower supplier and civil works</div><div><small>Address</small>Vivek Nagar, Ward No. 19, Maihar, MP – 485771</div><div><small>Contact</small>'+contactCell()+'</div></div></section>'+
  '<section>'+head('What we do','हमारे कार्य')+'<div class="cards">'+METHODS.map(function(m){return '<a class="card" href="#methods" style="text-decoration:none;color:inherit"><h3>'+esc(m.t)+'</h3><span class="mu">'+esc(m.hi)+'</span><span class="lbl">Measured in '+esc(m.u)+'</span></a>'}).join('')+'</div></section>'+
  '<section>'+head('How an order runs','काम कैसे चलता है')+'<div class="cards"><div class="card"><span class="lbl">Step 1</span><h3>Measure and estimate</h3><p>Use the calculators for quantities and cost, or send us drawings.</p></div><div class="card"><span class="lbl">Step 2</span><h3>Agree the terms</h3><p>Rates, payment cycle, retention and safety are written into one agreement.</p></div><div class="card"><span class="lbl">Step 3</span><h3>Crew on site</h3><p>Trained workers report with attendance sheets signed daily.</p></div><div class="card"><span class="lbl">Step 4</span><h3>Bill and pay</h3><p>Running bills on measurement or man-days, with GST and TDS shown line by line.</p></div></div></section>';
};
V.methods=function(){
  return '<section>'+head('Services and methods','कार्य विधि','The standard method we follow for each type of civil work, and how it is measured for billing.')+
  METHODS.map(function(m,i){return '<details'+(i===0?' open':'')+'><summary><span>'+esc(m.t)+'<span class="hi">'+esc(m.hi)+'</span></span><span class="pill">'+esc(m.u)+'</span></summary><div class="in"><ol>'+m.s.map(function(s){return '<li>'+esc(s)+'</li>'}).join('')+'</ol><div class="note">'+esc(m.r)+'</div></div></details>'}).join('')+'</section>';
};
V.calculators=function(){
  return '<section>'+head('Quantity and cost calculators','कैलकुलेटर','Pick the work, enter sizes in metres. Rates come from our rate list and can differ by market and time.')+
  '<div class="chips" id="calcTabs">'+CALCS.map(function(c){return '<button class="chip" data-act="calc" data-id="'+c.id+'" aria-pressed="'+(c.id===calcId)+'">'+esc(c.n)+'</button>'}).join('')+'</div>'+
  '<div class="sheet" id="calcBox" data-live="calc"></div></section>'+
  '<section>'+head('Estimate a quote (BOQ)','बिल ऑफ क्वांटिटी','List each item with quantity and rate. We add overhead, profit and GST.')+'<div class="sheet" id="boqBox" data-live="boq"></div></section>';
};
B.calculators=function(){drawCalc();drawBoq()};
V.manpower=function(){
  return '<section>'+head('Manpower rates','मैनपावर रेट','Daily rate for each trade. Monthly is shown for 26 working days.')+
  '<div class="scroll"><table><thead><tr><th>Trade</th><th class="n">Per day</th><th class="n">Per month (26 days)</th></tr></thead><tbody>'+
  DB.labour.map(function(x){return '<tr><td>'+esc(x.name)+'</td><td class="n">'+inr(x.rate)+'</td><td class="n">'+inr(x.rate*26)+'</td></tr>'}).join('')+'</tbody></table></div>'+
  '<div class="note">These are working rates and may change with the site and season. The final rate is fixed in the agreement.</div></section>'+
  '<section>'+head('Manpower cost estimator','खर्च का हिसाब')+'<div class="sheet" id="mpBox" data-live="mp"></div></section>';
};
B.manpower=drawMp;
V.formulas=function(){
  return '<section>'+head('Standard formulas','सूत्र','The factors used by our calculators, so you can check any number yourself.')+
  '<div class="scroll"><table><thead><tr><th>What</th><th>Formula</th><th>Note</th></tr></thead><tbody>'+
  FORMULAS.map(function(f){return '<tr><td>'+esc(f[0])+'</td><td style="font-family:var(--fm);font-size:13px">'+esc(f[1])+'</td><td class="mu">'+esc(f[2])+'</td></tr>'}).join('')+'</tbody></table></div></section>';
};
V.terms=function(){
  return '<section>'+head('Our standard terms','शर्तें','What we normally propose when we work with a company. Every point can be changed in the signed agreement.')+
  '<div class="cards">'+TERMS.map(function(t){return '<div class="card"><h3>'+esc(t[0])+'</h3><p>'+esc(t[1])+'</p></div>'}).join('')+'</div></section>';
};
V.contact=function(){
  return '<section>'+head('Contact and quote request','संपर्क')+
  '<div class="tb"><div><small>Address</small>Vivek Nagar, Ward No. 19, Maihar, MP – 485771</div><div><small>Phone and email</small>'+contactCell()+'</div></div>'+
  '<form class="sheet" data-form="quote"><div class="grid">'+
  fld({k:'name',l:'Your name',t:'text',r:1})+fld({k:'phone',l:'Phone',t:'tel',r:1})+
  fld({k:'work',l:'Work needed',o:METHODS.map(function(m){return m.t}).concat(['Other'])})+
  '</div><div class="grid">'+fld({k:'msg',l:'Site location and details',t:'area'})+'</div>'+
  '<div class="row"><button class="btn" type="submit">Prepare request</button></div><div id="quoteOut"></div></form></section>';
};
FORMS.quote=function(f,fd){
  var q={id:uid(),date:new Date().toISOString().slice(0,10),name:fd.get('name'),phone:fd.get('phone'),work:fd.get('work'),msg:fd.get('msg')};
  DB.enquiries.unshift(q);save();
  var text='Quote request for A2Z Build Tech\nName: '+q.name+'\nPhone: '+q.phone+'\nWork: '+q.work+'\nDetails: '+q.msg;
  $('#quoteOut').innerHTML='<div class="note">Your request is saved on this device. To send it, copy the text below and share it with us by phone or message.</div><pre class="doc" id="quoteText">'+esc(text)+'</pre><div class="row"><button class="btn sec" type="button" data-act="copy" data-t="#quoteText">Copy request</button></div>';
  f.reset();
};

/* ---------- admin ---------- */
var AUTH=false,tab='dash',idleT;
var FIELDS={
  workers:[{k:'name',l:'Name',t:'text',r:1},{k:'trade',l:'Trade',o:null},{k:'phone',l:'Phone',t:'tel'},{k:'wage',l:'Day wage (₹)',t:'number',m:1},{k:'site',l:'Current site',t:'text'},{k:'status',l:'Status',o:['Active','Off']}],
  projects:[{k:'name',l:'Project',t:'text',r:1},{k:'client',l:'Company / client',t:'text'},{k:'site',l:'Location',t:'text'},{k:'value',l:'Contract value (₹)',t:'number',m:1},{k:'start',l:'Start date',t:'date'},{k:'status',l:'Status',o:['Planned','Running','Completed','On hold']}],
  ledger:[{k:'date',l:'Date',t:'date',r:1},{k:'type',l:'Type',o:['Received','Paid']},{k:'party',l:'From / to',t:'text',r:1},{k:'project',l:'Project',t:'text'},{k:'amount',l:'Amount (₹)',t:'number',m:1,r:1},{k:'mode',l:'Mode',o:['Cash','UPI','Bank transfer','Cheque']},{k:'note',l:'Note',t:'text'}]
};
function fieldsFor(key){return FIELDS[key].map(function(f){if(f.k==='trade'){return {k:'trade',l:'Trade',o:DB.labour.map(function(x){return x.name})}}return f})}
function crud(key,title){
  var fs=fieldsFor(key);
  return '<h3>'+title+'</h3><form class="grid" data-form="add" data-k="'+key+'">'+fs.map(function(f){return fld(f)}).join('')+'<div><button class="btn" type="submit">Add</button></div></form>'+
  '<div class="scroll"><table><thead><tr>'+fs.map(function(f){return '<th>'+esc(f.l)+'</th>'}).join('')+'<th></th></tr></thead><tbody>'+
  (DB[key].map(function(r){return '<tr>'+fs.map(function(f){return '<td'+(f.m?' class="n"':'')+'>'+(f.m?inr(r[f.k]):esc(r[f.k]))+'</td>'}).join('')+'<td><button class="link danger" data-act="del" data-k="'+key+'" data-id="'+r.id+'">Delete</button></td></tr>'}).join('')||'<tr><td colspan="'+(fs.length+1)+'" class="mu">Nothing added yet.</td></tr>')+'</tbody></table></div>';
}
function sha(s){
  if(!window.crypto||!crypto.subtle)return Promise.reject(new Error('nocrypto'));
  return crypto.subtle.digest('SHA-256',new TextEncoder().encode('a2z|'+s)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return x.toString(16).padStart(2,'0')}).join('')});
}
function loginView(){
  var s=DB.settings,setup=!s.hash;
  return '<section style="max-width:460px">'+head(setup?'Create admin account':'Admin login','एडमिन')+
  '<form class="sheet" data-form="'+(setup?'setup':'login')+'">'+
  (setup?'<div class="note">No account exists on this device yet. Choose a username and a password of at least 8 characters.</div>':'')+
  '<label>Username<input name="u" type="text" autocomplete="username" required></label>'+
  '<label>Password<input name="p" type="password" autocomplete="'+(setup?'new-password':'current-password')+'" required></label>'+
  (setup?'<label>Confirm password<input name="p2" type="password" autocomplete="new-password" required></label>':'')+
  '<div class="msg" id="loginMsg" role="alert"></div><div><button class="btn" type="submit">'+(setup?'Create account':'Log in')+'</button></div></form></section>';
}
FORMS.setup=function(f,fd){
  var u=String(fd.get('u')).trim(),p=String(fd.get('p')),p2=String(fd.get('p2')),m=$('#loginMsg');
  if(p.length<8){m.textContent='Password needs at least 8 characters.';return}
  if(p!==p2){m.textContent='The two passwords do not match.';return}
  sha(u.toLowerCase()+p).then(function(h){DB.settings.user=u;DB.settings.hash=h;save();AUTH=true;tab='dash';startIdle();render();toast('Admin account created')}).catch(function(){m.textContent='This browser cannot create a login (secure context needed).'});
};
FORMS.login=function(f,fd){
  var s=DB.settings,m=$('#loginMsg'),now=Date.now();
  if(s.lockUntil>now){m.textContent='Too many attempts. Try again in '+Math.ceil((s.lockUntil-now)/1000)+' seconds.';return}
  var u=String(fd.get('u')).trim(),p=String(fd.get('p'));
  sha(u.toLowerCase()+p).then(function(h){
    if(u.toLowerCase()===String(s.user).toLowerCase()&&h===s.hash){s.fails=0;s.lockUntil=0;save();AUTH=true;tab='dash';startIdle();render()}
    else{s.fails=(s.fails||0)+1;if(s.fails>=5){s.lockUntil=Date.now()+60000;s.fails=0}save();m.textContent='Wrong username or password.'}
  }).catch(function(){m.textContent='This browser cannot check logins (secure context needed).'});
};
function startIdle(){clearTimeout(idleT);if(!AUTH)return;idleT=setTimeout(function(){doLogout(true)},15*60*1000)}
function doLogout(auto){AUTH=false;clearTimeout(idleT);render();toast(auto?'Logged out after 15 minutes idle':'Logged out')}
['click','keydown','input'].forEach(function(ev){document.addEventListener(ev,function(){if(AUTH)startIdle()})});

var TABS=[['dash','Overview'],['rates','Rates'],['workers','Workers'],['projects','Projects'],['payments','Payments'],['agreement','Agreement'],['enquiries','Enquiries'],['account','Account and security']];
var AD={},BA={};
V.admin=function(){
  if(!AUTH)return loginView();
  return '<section><div class="row between"><h2>Admin panel<span class="hi">एडमिन पैनल</span></h2><button class="btn sec" data-act="logout">Log out</button></div>'+
  '<div class="chips">'+TABS.map(function(t){return '<button class="chip" data-act="tab" data-id="'+t[0]+'" aria-pressed="'+(t[0]===tab)+'">'+t[1]+'</button>'}).join('')+'</div>'+
  '<div class="sheet" id="adBody">'+AD[tab]()+'</div></section>';
};
B.admin=function(){if(AUTH&&BA[tab])BA[tab]()};

AD.dash=function(){
  var act=DB.workers.filter(function(w){return w.status==='Active'}).length,run=DB.projects.filter(function(p){return p.status==='Running'}).length;
  var inn=0,out=0;DB.ledger.forEach(function(l){if(l.type==='Received')inn+=+l.amount||0;else out+=+l.amount||0});
  function k(l,v){return '<div class="card"><span class="lbl">'+l+'</span><span class="kpi">'+v+'</span></div>'}
  return '<h3>Overview</h3><div class="cards">'+k('Active workers',act)+k('Running projects',run)+k('Received',inr(inn))+k('Paid out',inr(out))+k('Balance',inr(inn-out))+k('Enquiries',DB.enquiries.length)+'</div>'+
  '<div class="note">All figures come from what you enter in this panel. Data is kept in this browser only, so make a backup from Account and security.</div>';
};
AD.rates=function(){
  function rows(list,withUnit){return DB[list].map(function(r,i){return '<tr><td><input data-l="'+list+'" data-i="'+i+'" data-k="name" type="text" value="'+esc(r.name)+'"></td>'+(withUnit?'<td><input data-l="'+list+'" data-i="'+i+'" data-k="unit" type="text" value="'+esc(r.unit)+'" style="min-width:60px;width:80px"></td>':'')+'<td><input data-l="'+list+'" data-i="'+i+'" data-k="rate" type="number" step="any" min="0" value="'+r.rate+'"></td><td>'+(list==='mats'&&D.CORE.indexOf(r.id)>=0?'<span class="pill">Used in calculators</span>':'<button class="link danger" data-act="del" data-k="'+list+'" data-id="'+r.id+'">Delete</button>')+'</td></tr>'}).join('')}
  return '<div data-live="rates"><h3>Material rates</h3><div class="scroll"><table><thead><tr><th>Material</th><th>Unit</th><th>Rate (₹)</th><th></th></tr></thead><tbody>'+rows('mats',true)+'</tbody></table></div>'+
  '<div class="row"><button class="btn sec" data-act="addrate" data-l="mats">Add material</button></div>'+
  '<h3>Labour rates per day</h3><div class="scroll"><table><thead><tr><th>Trade</th><th>Rate (₹)</th><th></th></tr></thead><tbody>'+rows('labour',false)+'</tbody></table></div>'+
  '<div class="row"><button class="btn sec" data-act="addrate" data-l="labour">Add trade</button></div>'+
  '<div class="note">Changes save as you type and update the calculators on the public pages. Rows marked "Used in calculators" can be edited but not deleted.</div></div>';
};
LIVE.rates=function(w,t){
  var l=t.dataset.l,i=+t.dataset.i,k=t.dataset.k;if(!l||!DB[l][i])return;
  DB[l][i][k]=(k==='rate')?(parseFloat(t.value)||0):t.value;save();
};
AD.workers=function(){return crud('workers','Worker register')};
AD.projects=function(){return crud('projects','Projects and company contracts')};
AD.payments=function(){
  var inn=0,out=0;DB.ledger.forEach(function(l){if(l.type==='Received')inn+=+l.amount||0;else out+=+l.amount||0});
  return '<h3>Bill calculator</h3><div data-live="bill"><div class="grid">'+
  fld({k:'g',l:'Gross work value',u:'₹',d:500000})+fld({k:'gst',l:'GST',u:'%',d:18})+fld({k:'tds',l:'TDS',u:'%',d:2})+fld({k:'ret',l:'Retention',u:'%',d:5})+fld({k:'adv',l:'Advance to recover',u:'₹',d:0})+fld({k:'oth',l:'Other deductions',u:'₹',d:0})+
  '</div><div class="scroll" id="billOut"></div></div>'+
  '<h3>Payment ledger</h3><div class="cards"><div class="card"><span class="lbl">Received</span><span class="kpi">'+inr(inn)+'</span></div><div class="card"><span class="lbl">Paid</span><span class="kpi">'+inr(out)+'</span></div><div class="card"><span class="lbl">Balance</span><span class="kpi">'+inr(inn-out)+'</span></div></div>'+crud('ledger','Entries');
};
BA.payments=function(){billOut()};
function billOut(){
  var r=$('#adBody [data-live="bill"]');if(!r)return;
  var g=function(n){return r.querySelector('[name="'+n+'"]').value};
  var bn=C.billNet({g:g('g'),gst:g('gst'),tds:g('tds'),ret:g('ret'),adv:g('adv'),oth:g('oth')});
  var gross=bn.gross,gst=bn.gst,tds=bn.tds,ret=bn.ret,net=bn.net;
  $('#billOut').innerHTML='<table><tbody><tr><td>Gross work value</td><td class="n">'+inr2(gross)+'</td></tr><tr><td>Add GST</td><td class="n">'+inr2(gst)+'</td></tr><tr><td>Less TDS</td><td class="n">− '+inr2(tds)+'</td></tr><tr><td>Less retention</td><td class="n">− '+inr2(ret)+'</td></tr><tr><td>Less advance recovery</td><td class="n">− '+inr2(bn.adv)+'</td></tr><tr><td>Less other deductions</td><td class="n">− '+inr2(bn.oth)+'</td></tr><tr class="big"><td>Net payable</td><td class="n">'+inr2(net)+'</td></tr></tbody></table>'+(bn.short?'<div class="note warn">Deductions are more than the bill. Check the advance and other deductions.</div>':'');
}
LIVE.bill=billOut;

var agrVals=null;
function agrDefaults(){
  return {type:'manpower',party:'',addr:'',gstin:'',site:'',start:new Date().toISOString().slice(0,10),months:6,cycle:15,adv:0,ret:5,gst:18,tds:2,otm:2,notice:15,court:'Maihar, Madhya Pradesh',
    rates:DB.labour.map(function(x){return x.name+': '+inr(x.rate)+' per day'}).join('\n')};
}
AD.agreement=function(){
  if(!agrVals)agrVals=agrDefaults();var a=agrVals;
  return '<h3>Agreement generator</h3><div data-live="agr"><div class="grid">'+
  fld({k:'type',l:'Agreement type',o:[['manpower','Manpower supply'],['works','Civil works contract'],['sub','Sub-contract']]},a.type)+
  fld({k:'party',l:'Company name',t:'text'},a.party)+fld({k:'gstin',l:'Company GSTIN',t:'text'},a.gstin)+fld({k:'addr',l:'Company address',t:'text'},a.addr)+
  fld({k:'site',l:'Site location',t:'text'},a.site)+fld({k:'start',l:'Start date',t:'date'},a.start)+fld({k:'months',l:'Duration',u:'months',d:6},a.months)+
  fld({k:'cycle',l:'Payment within',u:'days',d:15},a.cycle)+fld({k:'adv',l:'Advance',u:'%',d:0},a.adv)+fld({k:'ret',l:'Retention',u:'%',d:5},a.ret)+
  fld({k:'gst',l:'GST',u:'%',d:18},a.gst)+fld({k:'tds',l:'TDS',u:'%',d:2},a.tds)+fld({k:'otm',l:'Overtime multiple',u:'× hourly',d:2},a.otm)+fld({k:'notice',l:'Termination notice',u:'days',d:15},a.notice)+
  fld({k:'court',l:'Jurisdiction',t:'text'},a.court)+fld({k:'rates',l:'Rate schedule (one per line)',t:'area'},a.rates)+
  '</div><div class="row"><button class="btn" type="button" data-act="copy" data-t="#agrOut">Copy agreement</button></div><pre class="doc" id="agrOut"></pre>'+
  '<div class="note warn">This is a standard draft for discussion. Have it checked by a lawyer before both sides sign.</div></div>';
};
BA.agreement=function(){agrOut()};
function agrOut(){
  var r=$('#adBody [data-live="agr"]');if(!r)return;
  var v={};['type','party','addr','gstin','site','start','months','cycle','adv','ret','gst','tds','otm','notice','court','rates'].forEach(function(k){v[k]=r.querySelector('[name="'+k+'"]').value});
  agrVals=v;
  $('#agrOut').textContent=C.agreementText(v);
}
LIVE.agr=agrOut;

AD.enquiries=function(){
  return '<h3>Enquiries</h3>'+(DB.enquiries.map(function(q){return '<div class="card"><div class="row between"><b>'+esc(q.name)+' · '+esc(q.phone)+'</b><span class="pill">'+esc(q.date)+'</span></div><span class="lbl">'+esc(q.work)+'</span><p>'+esc(q.msg)+'</p><div><button class="link danger" data-act="del" data-k="enquiries" data-id="'+q.id+'">Delete</button></div></div>'}).join('')||'<p class="mu">No enquiries on this device yet. Requests made from the Contact page on this browser appear here.</p>');
};
AD.account=function(){
  var s=DB.settings;
  return '<h3>Account and security</h3>'+
  '<div class="note warn">This login protects the admin screens in this browser. Data is stored in this browser only and is not sent to any server. For several devices or staff, a server with its own login and database is needed.</div>'+
  '<form data-form="contact"><div class="grid">'+fld({k:'phone',l:'Public phone',t:'tel'},s.phone)+fld({k:'email',l:'Public email',t:'email'},s.email)+'<div><button class="btn" type="submit">Save contact</button></div></div></form>'+
  '<form data-form="pw"><div class="grid"><label>Current password<input name="cur" type="password" autocomplete="current-password" required></label><label>New password<input name="np" type="password" autocomplete="new-password" required></label><div><button class="btn" type="submit">Change password</button></div></div><div class="msg" id="pwMsg" role="alert"></div></form>'+
  '<h3>Backup and restore</h3><p class="mu">Copy this text and keep it safe. To restore on another browser, paste it below.</p><textarea id="bk" readonly>'+esc(JSON.stringify({mats:DB.mats,labour:DB.labour,workers:DB.workers,projects:DB.projects,ledger:DB.ledger,enquiries:DB.enquiries}))+'</textarea>'+
  '<div class="row"><button class="btn sec" data-act="copy" data-t="#bk">Copy backup</button></div>'+
  '<form data-form="restore"><label>Paste backup here<textarea name="b" required></textarea></label><div class="row" style="margin-top:10px"><button class="btn sec" type="submit">Restore backup</button></div></form>'+
  '<h3>Security in place</h3><ul><li>Password stored as a salted SHA-256 hash, never as plain text.</li><li>Five wrong attempts lock login for one minute.</li><li>Auto logout after 15 minutes without activity.</li><li>Login is needed again after every page reload.</li><li>All entered text is escaped before display.</li></ul>';
};
FORMS.contact=function(f,fd){DB.settings.phone=String(fd.get('phone')).trim();DB.settings.email=String(fd.get('email')).trim();save();toast('Contact saved')};
FORMS.pw=function(f,fd){
  var s=DB.settings,m=$('#pwMsg'),np=String(fd.get('np'));
  if(np.length<8){m.textContent='New password needs at least 8 characters.';return}
  sha(s.user.toLowerCase()+String(fd.get('cur'))).then(function(h){
    if(h!==s.hash){m.textContent='Current password is wrong.';return}
    return sha(s.user.toLowerCase()+np).then(function(n){s.hash=n;save();f.reset();m.textContent='';toast('Password changed')});
  }).catch(function(){m.textContent='This browser cannot change the password.'});
};
FORMS.restore=function(f,fd){
  try{
    var o=JSON.parse(String(fd.get('b')));
    if(!o||typeof o!=='object'||!Array.isArray(o.mats)||!Array.isArray(o.labour))throw new Error('bad');
    var clean=D.sanitize(o);
    ['mats','labour','workers','projects','ledger','enquiries'].forEach(function(k){DB[k]=clean[k]});
    save();render();toast('Backup restored');
  }catch(e){toast('That text is not a valid backup')}
};
FORMS.add=function(f,fd){
  var key=f.dataset.k,o={id:uid()};
  fieldsFor(key).forEach(function(x){var v=fd.get(x.k);o[x.k]=x.t==='number'?D.num(v):String(v==null?'':v).slice(0,300)});
  DB[key].unshift(o);save();render();
};

LIVE.calc=function(){calcOut()};
LIVE.boq=function(){boqOut()};
LIVE.mp=function(){mpOut()};

/* ---------- actions ---------- */
ACTS.calc=function(b){calcId=b.dataset.id;$$('#calcTabs .chip').forEach(function(c){c.setAttribute('aria-pressed',c.dataset.id===calcId)});drawCalc()};
ACTS.boqadd=function(){syncBoq();boq.push({d:'',u:'',q:0,r:0});drawBoq()};
ACTS.boqdel=function(b){syncBoq();boq.splice(+b.dataset.i,1);drawBoq()};
ACTS.mpadd=function(){syncMp();mp.push({t:DB.labour[0]?DB.labour[0].id:'',n:1,d:26,ot:0});drawMp()};
ACTS.mpdel=function(b){syncMp();mp.splice(+b.dataset.i,1);drawMp()};
ACTS.logout=function(){doLogout(false)};
ACTS.tab=function(b){tab=b.dataset.id;render()};
ACTS.addrate=function(b){var l=b.dataset.l;DB[l].push(l==='mats'?{id:uid(),name:'New material',unit:'nos',rate:0}:{id:uid(),name:'New trade',rate:0});save();render()};
var armed=null,armT;
ACTS.del=function(b){
  if(armed!==b){if(armed){armed.textContent='Delete'}armed=b;b.textContent='Sure?';clearTimeout(armT);armT=setTimeout(function(){if(armed===b){b.textContent='Delete';armed=null}},3000);return}
  var k=b.dataset.k,id=b.dataset.id;DB[k]=DB[k].filter(function(r){return r.id!==id});save();armed=null;render();
};
ACTS.copy=function(b){
  var el=$(b.dataset.t),text=el.value!=null&&el.tagName==='TEXTAREA'?el.value:el.textContent;
  function fallback(){var r=document.createRange();r.selectNodeContents(el);var s=window.getSelection();s.removeAllRanges();s.addRange(r);toast('Text selected, now use your device Copy option')}
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){toast('Copied')},fallback)}else fallback();
};

document.addEventListener('submit',function(e){var f=e.target.closest('form[data-form]');if(!f)return;e.preventDefault();var fn=FORMS[f.dataset.form];if(fn)fn(f,new FormData(f))});
document.addEventListener('click',function(e){var b=e.target.closest('[data-act]');if(!b)return;var fn=ACTS[b.dataset.act];if(fn)fn(b,e)});
document.addEventListener('input',function(e){var w=e.target.closest('[data-live]');if(w&&LIVE[w.dataset.live])LIVE[w.dataset.live](w,e.target)});

/* ---------- router ---------- */
var ROUTES=[['home','Home'],['methods','Services and methods'],['calculators','Calculators'],['manpower','Manpower'],['formulas','Formulas'],['terms','Terms'],['contact','Contact'],['admin','Admin']];
function current(){var r=(location.hash||'#home').slice(1);return V[r]?r:'home'}
function render(){
  var r=current();
  $('#nav').innerHTML=ROUTES.map(function(x){return '<a href="#'+x[0]+'"'+(x[0]===r?' aria-current="page"':'')+'>'+(x[0]==='admin'&&!AUTH?'Admin login':x[1])+'</a>'}).join('');
  $('#app').innerHTML=V[r]();
  (B[r]||noop)();
  document.title='A2Z Build Tech';
}
window.addEventListener('hashchange',function(){render();window.scrollTo(0,0)});
$('#themeBtn').addEventListener('click',function(){
  var root=document.documentElement,dark=root.getAttribute('data-theme')==='dark'||(!root.getAttribute('data-theme')&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme',dark?'light':'dark');
});
render();
})();
