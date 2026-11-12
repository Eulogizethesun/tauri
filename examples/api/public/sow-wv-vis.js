// sow-wv-vis.js — child-webview hide/show judgment page (S2-035, C4 batch)
// Count + uptime: hide → show must preserve both (page not reloaded, JS state kept).
// External file because the app CSP (default-src 'self', no 'unsafe-inline' for
// scripts) blocks inline handlers — the round-5 "count never increments" root cause.
(function () {
  var n = 0;
  var t0 = Date.now();
  var btn = document.getElementById('countBtn');
  var up = document.getElementById('up');
  btn.addEventListener('click', function () {
    n += 1;
    btn.textContent = 'count: ' + n;
  });
  setInterval(function () {
    up.textContent = 'uptime: ' + Math.floor((Date.now() - t0) / 1000) + 's（重载会归零）';
  }, 1000);
})();
