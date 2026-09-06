/** privtr.ee — arranque de la vista de perfil público.
 *  Lo usan u.html y 404.html (esta última hace de router para /@usuario en
 *  hosts estáticos). Resuelve el @usuario desde /@ana, ?u=ana o #@ana.
 */
window.PrivProfileView = (function () {

  function setMeta(sel, value) {
    var el = document.querySelector(sel);
    if (el && value != null) el.setAttribute('content', value);
  }
  function setCanonical(href) {
    var el = document.querySelector('link[rel="canonical"]');
    if (!el) { el = document.createElement('link'); el.rel = 'canonical'; document.head.appendChild(el); }
    el.href = href;
  }
  function jsonLd(obj) {
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }

  function socialLinks(d) {
    var out = [];
    (PrivStore.SOCIAL_DEFS || []).forEach(function (s) {
      var u = PrivStore.safeUrl(d.social && d.social[s.id]);
      if (u && u.indexOf('mailto:') !== 0) out.push(u);
    });
    return out;
  }

  function applySeo(d, canonical) {
    var title = (d.ogTitle || d.name || '@' + d.username) + ' — privtr.ee';
    var desc = d.ogDesc || d.bio || ('Enlaces y contacto de ' + (d.name || '@' + d.username) + ' en privtr.ee.');
    document.title = title;
    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', desc);
    setMeta('meta[property="og:url"]', canonical);
    setMeta('meta[property="og:type"]', 'profile');
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', desc);
    var av = PrivStore.safeImg(d.avatar);
    if (av && /^https?:\/\//i.test(av)) {
      setMeta('meta[property="og:image"]', av);
      setMeta('meta[name="twitter:image"]', av);
      setMeta('meta[name="twitter:card"]', 'summary');
    }
    setCanonical(canonical);
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      'url': canonical,
      'mainEntity': {
        '@type': 'Person',
        'name': d.name || d.username,
        'alternateName': '@' + d.username,
        'description': d.bio || undefined,
        'image': av && /^https?:\/\//i.test(av) ? av : undefined,
        'url': canonical,
        'sameAs': socialLinks(d).length ? socialLinks(d) : undefined,
      },
    });
  }

  function notFoundHtml(username) {
    var e = PrivStore.esc(username);
    var reserved = username && PrivStore.isReservedUsername(username);
    return '' +
      '<div class="py-10 px-4">' +
        '<div class="w-20 h-20 rounded-full mx-auto mb-5 bg-panel border border-white/10 flex items-center justify-center text-2xl text-steel" aria-hidden="true">?</div>' +
        '<h1 class="text-xl font-semibold text-white mb-2">' + (username ? '@' + e : 'Perfil no encontrado') + '</h1>' +
        '<p class="text-sm text-steel mb-7 leading-relaxed">' +
          (reserved
            ? 'Ese nombre está reservado por el sistema y no corresponde a ningún perfil.'
            : (username
                ? 'Todavía no hay ninguna página publicada en esta dirección.'
                : 'No hemos podido identificar qué perfil buscabas.')) +
        '</p>' +
        '<div class="flex flex-col sm:flex-row gap-2.5 justify-center">' +
          (username && !reserved
            ? '<a href="registro.html?username=' + encodeURIComponent(username) + '" class="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-neon text-void text-sm font-semibold hover:bg-neon-glow transition">Reclamar @' + e + '</a>'
            : '<a href="registro.html" class="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-neon text-void text-sm font-semibold hover:bg-neon-glow transition">Crear mi página</a>') +
          '<a href="index.html" class="inline-flex items-center justify-center px-5 py-2.5 rounded-xl border border-white/10 text-sm text-mist hover:border-neon/40 transition">Ir al inicio</a>' +
        '</div>' +
      '</div>';
  }

  function mount(opts) {
    opts = opts || {};
    var container = document.getElementById(opts.containerId || 'page');
    if (!container) return null;
    var username = PrivStore.usernameFromLocation();
    var data = username ? PrivStore.load(username) : null;

    // Demo local: @stark siempre tiene contenido de ejemplo.
    if (!data && username === 'stark') data = PrivStore.starkDemo();

    if (!data) {
      container.innerHTML = notFoundHtml(username);
      document.title = (username ? '@' + username : 'Perfil no encontrado') + ' — privtr.ee';
      setMeta('meta[name="robots"]', 'noindex, follow');
      if (opts.onMissing) opts.onMissing(username);
      return null;
    }

    var canonical = PrivStore.profileUrl(data);
    PrivStore.renderProfile(data, container, { compact: false });
    applySeo(data, canonical);

    // Si estamos en /u.html?u=x pero el host soporta /@x, deja la URL bonita
    // en la barra sin recargar. Sólo cuando la ruta ya es /@x lo omitimos.
    var share = canonical;

    window.sharePage = function () {
      var payload = { title: data.name || data.username, text: data.bio || '', url: share };
      if (navigator.share) { navigator.share(payload).catch(function () {}); return; }
      copyToClipboard(share, 'Enlace copiado');
    };
    window.copyLink = function () { copyToClipboard(share, 'Enlace copiado'); };
    return data;
  }

  function copyToClipboard(text, msg) {
    function done() { if (window.__privToast) window.__privToast(msg || 'Copiado'); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(text); done(); });
    } else { fallback(text); done(); }
  }
  function fallback(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) {}
  }

  return { mount: mount, notFoundHtml: notFoundHtml };
})();
