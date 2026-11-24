/* FILE: hints.js - har entry-field ke neeche chhoti jankari (kya bharna hai, kahan se milega). Admin aur staff dono panel use karte hain. */
(function () {
  'use strict';
  var H = {
    name: 'Aadhaar / ID par jaisa naam likha hai wahi likhein.',
    phone: '10 ank ka mobile number (bina +91, bina space). Isi se login / pehchan hoti hai.',
    mobile: '10 ank ka mobile number. Candidate ki pehchan aur duplicate rokne ke kaam aata hai.',
    mobile2: 'Dusra number (optional). Pehla band ho to isse sampark hoga.',
    email: 'Optional. Registration approve hone par yahin email aati hai.',
    father: 'Pita ya pati ka naam, jaisa ID par hai.',
    dob: 'Janm tithi ID / Aadhaar ke anusar. 18 saal se kam umr ka candidate nahi jud sakta.',
    address: 'Ghar ka pura pata: gaon / mohalla, post, jila.',
    aadhaar: '12 ank. Sirf pehchan ke liye; kisi aur ko na bataiye. (Optional)',
    bank: 'Bank khata number passbook ya cheque par milta hai. Wage / commission isi me bheja jata hai.',
    ifsc: 'Bank branch ka 11 akshar ka code (passbook / cheque par), jaise SBIN0001234.',
    upi: 'UPI ID jaise naam@bank (optional).',
    emergency: 'Emergency me jise phone karna hai uska naam / rishta.',
    emergencyPhone: 'Emergency wale vyakti ka mobile number.',
    experience: 'Kitne saal aur kis kaam ka anubhav, jaise "3 saal, shuttering".',
    trade: 'Kaam ka prakar / grade (Mason, Helper, Fitter, Welder...). Party ke rate card me jo naam hai wahi likhein, tabhi rate apne-aap lagta hai.',
    joinDate: 'Candidate ne kaam kis tareekh se shuru kiya.',
    payRate: 'Candidate ko din ka kitna dena hai (₹). Khali chhodne par party ke rate card wala "Pay" rate lagta hai.',
    billRate: 'Party se din ka kitna lena hai (₹). Khali chhodne par party ke rate card wala "Bill" rate lagta hai.',
    commissionPct: 'Sirf "Percent" tareeke me. Pool ka kitna % (jaise 40). Khali = Settings wala default %.',
    fixedPay: 'Company staff ka tay vetan, har mahine. Manpower supplier ke liye 0 (unhe sirf commission milta hai).',
    fixedFrom: 'Tay vetan kis tareekh se shuru hoga.',
    basisDays: 'Mahine ke kitne din maan kar "per month" rate ko "per din" me badalna hai (aam taur par 26).',
    payDays: 'Kul kitne din ki hazri maani gayi.',
    billPct: 'Party se bill par jo extra % milta hai (bonus). Agreement ke anusar.',
    gstPct: 'Commission par GST ka % (aam taur par 18).',
    gstFirmPct: 'Firm ke bill par GST ka %.',
    gstin: 'Party ka 15 akshar ka GST number (optional).',
    share: 'Is partner ka hissa, % me. Sab partners ka jod 100 hona chahiye.',
    amount: 'Rakam rupaye me, bina comma ke.',
    date: 'Tareekh chuniye.',
    note: 'Yaad ke liye chhoti tippani (optional).',
    label: 'Kharche / entry ka chhota naam, jaise "Cement" ya "Truck bhada".',
    contact: 'Is party me baat karne wale vyakti ka naam / number.',
    role: 'Partner ka kaam / bhumika (optional).',
    days: 'Kitne din (poora ank, ya aadha din 0.5).',
    pass: 'Kam se kam 10 akshar, jisme akshar aur ank dono hon. Aankh wale button se dekh sakte hain.',
    pass2: 'Wahi password dobara likhein.',
    code: '6 ank ka code jo email / SMS me aaya.'
  };
  window.A2ZHints = {
    map: H,
    html: function (key) { return H[key] ? '<small class="hint">' + H[key].replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</small>' : ''; }
  };
}());
/* END OF FILE: hints.js */
var A2Z_END_hints = true;
