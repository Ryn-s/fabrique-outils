/* Commun à toutes les pages : mesure anonyme, boîte à demandes, aides (impression, copie, téléchargement, formats). */
(function () {
  var S = window.S || {}, C = window.CONFIG || {};

  // ---- Mesure : un compteur anonyme (nom d'événement + page), jamais de contenu saisi.
  // Si CONFIG.mesure_url est vide (pas encore d'hébergement), on compte seulement dans ce navigateur.
  window.mesurer = function (nom, detail) {
    try {
      var cle = 'fabrique.mesure';
      var m = JSON.parse(localStorage.getItem(cle) || '{}');
      var k = nom + '|' + location.pathname;
      m[k] = (m[k] || 0) + 1;
      localStorage.setItem(cle, JSON.stringify(m));
    } catch (e) {}
    if (C.mesure_url) {
      try {
        var corps = JSON.stringify({ e: nom, p: location.pathname, l: window.LANG, d: detail || null, t: Date.now() });
        if (navigator.sendBeacon) navigator.sendBeacon(C.mesure_url, corps);
        else fetch(C.mesure_url, { method: 'POST', body: corps, keepalive: true }).catch(function () {});
      } catch (e) {}
    }
  };
  mesurer('vue');

  // ---- Demandes d'outils.
  window.envoyerDemande = function (ev) {
    ev.preventDefault();
    var texte = (document.getElementById('demande-texte').value || '').trim();
    var email = (document.getElementById('demande-email').value || '').trim();
    var retour = document.getElementById('demande-retour');
    if (!texte) { retour.textContent = S.demande_vide; retour.className = 'retour alerte'; return false; }
    var demande = { texte: texte, email: email, page: location.pathname, lang: window.LANG, date: new Date().toISOString() };
    mesurer('demande', email ? 'avec-email' : 'sans-email');
    var fini = function (ok) {
      retour.className = 'retour' + (ok ? '' : ' alerte');
      retour.textContent = ok ? S.demande_merci : S.demande_hors_ligne;
      if (ok) { document.getElementById('demande-texte').value = ''; document.getElementById('demande-email').value = ''; }
    };
    if (C.demande_url) {
      fetch(C.demande_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(demande) })
        .then(function (r) { fini(r.ok); if (!r.ok) garder(demande); })
        .catch(function () { garder(demande); fini(false); });
    } else if (C.email_demandes) {
      var sujet = (window.LANG === 'fr' ? 'Demande d\'outil' : 'Tool request');
      location.href = 'mailto:' + C.email_demandes + '?subject=' + encodeURIComponent(sujet) + '&body=' + encodeURIComponent(texte + (email ? '\n\n' + email : ''));
      fini(true);
    } else {
      garder(demande); fini(false);
    }
    return false;
  };
  function garder(d) {
    try {
      var cle = 'fabrique.demandes';
      var l = JSON.parse(localStorage.getItem(cle) || '[]');
      l.push(d); localStorage.setItem(cle, JSON.stringify(l));
    } catch (e) {}
  }

  // ---- Aides communes aux outils.
  window.imprimer = function () { mesurer('outil_termine', 'impression'); window.print(); };
  window.copier = function (texte, bouton) {
    var ok = function () {
      mesurer('outil_termine', 'copie');
      if (bouton) { var avant = bouton.textContent; bouton.textContent = S.copie; setTimeout(function () { bouton.textContent = avant; }, 1500); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(ok, function () { secours(texte); ok(); });
    else { secours(texte); ok(); }
    function secours(t) { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
  };
  window.telecharger = function (nom, contenu, type) {
    mesurer('outil_termine', 'telechargement');
    var blob = contenu instanceof Blob ? contenu : new Blob([contenu], { type: type || 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  window.svgVersPng = function (svgEl, nom, echelle) {
    var xml = new XMLSerializer().serializeToString(svgEl);
    var img = new Image();
    var url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = function () {
      var c = document.createElement('canvas'); var k = echelle || 3;
      c.width = img.width * k; c.height = img.height * k;
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (b) { telecharger(nom, b, 'image/png'); URL.revokeObjectURL(url); }, 'image/png');
    };
    img.src = url;
  };
  // Formats : nombres et dates selon la langue de la page.
  window.fmtNombre = function (n, dec) { return Number(n).toLocaleString(window.LANG === 'fr' ? 'fr-FR' : 'en-US', { minimumFractionDigits: dec == null ? 2 : dec, maximumFractionDigits: dec == null ? 2 : dec }); };
  window.fmtArgent = function (n, devise) {
    var d = devise || (window.LANG === 'fr' ? 'EUR' : 'USD');
    try { return Number(n).toLocaleString(window.LANG === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: d }); } catch (e) { return fmtNombre(n) + ' ' + d; }
  };
  window.fmtDate = function (iso) {
    if (!iso) return '';
    var d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    return d.toLocaleDateString(window.LANG === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  window.echapper = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  window.nl2br = function (s) { return echapper(s).replace(/\n/g, '<br>'); };
  window.aujourdhui = function () { var d = new Date(); return d.toISOString().slice(0, 10); };
  // Mémoire légère des saisies (pour ne pas tout retaper), par outil, dans ce navigateur seulement.
  window.memoriser = function (cle, obj) { try { localStorage.setItem('fabrique.' + cle, JSON.stringify(obj)); } catch (e) {} };
  window.rappeler = function (cle) { try { return JSON.parse(localStorage.getItem('fabrique.' + cle) || 'null'); } catch (e) { return null; } };
  window.aleatoire = function (n) { // entier dans [0, n)
    if (window.crypto && crypto.getRandomValues) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
    return Math.floor(Math.random() * n);
  };
  window.melanger = function (t) { for (var i = t.length - 1; i > 0; i--) { var j = aleatoire(i + 1); var x = t[i]; t[i] = t[j]; t[j] = x; } return t; };
})();
