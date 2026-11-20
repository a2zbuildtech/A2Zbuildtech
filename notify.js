'use strict';
/*
 * Sends a text message (login OTP, payment reminder).
 *   OTP_PROVIDER=console   prints the message in the server window (testing only)
 *   OTP_PROVIDER=webhook   POSTs {"to":"9XXXXXXXXX","message":"..."} to SMS_WEBHOOK_URL
 *                          (works with any SMS / WhatsApp gateway or an automation tool)
 * In India transactional SMS needs a DLT-registered template; set that up with your SMS provider.
 */
function makeNotifier(env) {
  env = env || process.env;
  const provider = (env.OTP_PROVIDER || 'console').toLowerCase();
  if (provider === 'webhook') {
    const url = env.SMS_WEBHOOK_URL;
    if (!url || !/^https:\/\//.test(url)) throw new Error('OTP_PROVIDER=webhook needs SMS_WEBHOOK_URL starting with https://');
    const fn = async function (to, message) {
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 8000);
      try {
        const r = await fetch(url, {
          method: 'POST', signal: ctl.signal,
          headers: Object.assign({ 'content-type': 'application/json' }, env.SMS_WEBHOOK_TOKEN ? { authorization: 'Bearer ' + env.SMS_WEBHOOK_TOKEN } : {}),
          body: JSON.stringify({ to: to, message: message })
        });
        return r.ok;
      } catch (e) { return false; } finally { clearTimeout(t); }
    };
    fn.provider = 'webhook'; fn.real = true;
    return fn;
  }
  const fn = async function (to, message) {
    console.log('\n[SMS to ' + to + '] ' + message + '\n');
    return true;
  };
  fn.provider = 'console'; fn.real = false;
  return fn;
}
module.exports = { makeNotifier };
