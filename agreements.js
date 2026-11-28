/* FILE: agreements.js  (GitHub par isi naam se upload karein; PDF / Word files "agreements" folder me jaati hain) */
/* Agreement ke form: kaun si file kis page par dikhe wo yahan tay hai.
 * pub = public website (company / customer ke liye), staff = staff panel, admin = admin panel.
 * Ye sab blank namoone (draft) hain; signed copy aap khud rakhein. Chhapne se pehle vakeel se jaanch karwa lein. */
(function () {
  'use strict';
  var LIST = [
    { f: '1_Company_Manpower_Supply_Agreement', t: 'Company ke saath Manpower Supply Agreement', d: 'Company / party ke saath manpower supply ka agreement (rate, payment cycle, safety, retention, dono ki zimmedari).', who: ['pub', 'staff', 'admin'] },
    { f: '4_Vehicle_Equipment_Rent_Agreement', t: 'Gaadi / Equipment Kiraya Agreement', d: 'Gaadi, machine ya equipment kiraye par dene-lene ka agreement.', who: ['pub', 'staff', 'admin'] },
    { f: '2_Staff_Supplier_Commission_Agreement', t: 'Staff / Supplier Commission Agreement', d: 'Staff ya supplier ke saath commission ki shartein (kaun si party par kitna commission, kab milega).', who: ['staff', 'admin'] },
    { f: '3_Labour_Joining_Form_and_Agreement', t: 'Labour Joining Form aur Agreement', d: 'Naye labour / candidate ke joining ka form aur shartein. Labour ke sign / angootha ke saath bharein.', who: ['staff', 'admin'] }
  ];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function html(aud) {
    var rows = LIST.filter(function (x) { return x.who.indexOf(aud) >= 0; });
    return '<div class="cards">' + rows.map(function (x) {
      return '<div class="card"><h3>' + esc(x.t) + '</h3><p>' + esc(x.d) + '</p><p><a class="btn sm" href="agreements/' + x.f + '.pdf" target="_blank" rel="noopener">PDF kholein / print</a> <a class="btn sm sec" href="agreements/' + x.f + '.docx" download>Word (badalne ke liye)</a></p></div>';
    }).join('') + '</div><p class="note">Ye namoone hain: apne naam, rate aur shartein bharkar, vakeel se jaanch karwakar stamp paper par chhapwayein. Signed copy surakshit rakhein.</p>';
  }
  window.A2ZAgr = { list: LIST, html: html };
})();
