let state = PrivStore.defaultPage('stark');
let nid = 20;
let dragId = null;
let socialDragId = null;
let saveTimer = null;
let socialExpanded = false;
let previewDevice = 'phone';
let customAccentOpen = false;

function ensureSocialOrder() {
  if (!Array.isArray(state.socialOrder) || !state.socialOrder.length) {
    state.socialOrder = PrivStore.SOCIAL_DEFS.map(function (s) { return s.id; });
  }
  PrivStore.SOCIAL_DEFS.forEach(function (s) {
    if (state.socialOrder.indexOf(s.id) < 0) state.socialOrder.push(s.id);
  });
}

function captureReorderPositions(root) {
  var map = {};
  if (!root) return map;
  root.querySelectorAll('[data-reorder-id]').forEach(function (el) {
    var id = el.getAttribute('data-reorder-id');
    if (!id) return;
    var r = el.getBoundingClientRect();
    map[id] = { top: r.top, left: r.left, width: r.width, height: r.height };
  });
  return map;
}
function playReorderFLIP(root, firstMap) {
  if (!root || !firstMap) return;
  root.querySelectorAll('[data-reorder-id]').forEach(function (el) {
    var id = el.getAttribute('data-reorder-id');
    var first = firstMap[id];
    if (!first) return;
    var last = el.getBoundingClientRect();
    var dx = first.left - last.left;
    var dy = first.top - last.top;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    el.style.transition = 'none';
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    void el.offsetWidth;
    el.style.transition = 'transform .32s cubic-bezier(.22,.61,.36,1)';
    el.style.transform = '';
    var cleanup = function () {
      el.style.transition = '';
      el.style.transform = '';
      el.removeEventListener('transitionend', cleanup);
    };
    el.addEventListener('transitionend', cleanup);
    setTimeout(cleanup, 400);
  });
}
function flashPreview() {
  document.querySelectorAll('#link-list > div, #social-list > div').forEach(function (el) {
    el.classList.remove('list-settle');
    void el.offsetWidth;
    el.classList.add('list-settle');
  });
}
function refreshWithFLIP() {
  var roots = [document.getElementById('preview'), document.getElementById('preview-desktop')];
  var maps = roots.map(function (r) { return captureReorderPositions(r); });
  refresh();
  roots.forEach(function (r, i) { playReorderFLIP(r, maps[i]); });
}

function init() {
  const wanted = PrivStore.sanitizeUsername(new URLSearchParams(location.search).get('u') || '');
  const loaded = PrivStore.load(wanted || undefined);
  state = loaded
    || (!wanted || wanted === 'stark' ? PrivStore.starkDemo() : PrivStore.defaultPage(wanted));
  ensureSocialOrder();
  nid = Math.max(20, ...(state.links.map(l => l.id || 0)), 0) + 1;
  if (state.profileMode === 'both' || state.profileMode === 'card') {
    if (!state.contact) state.contact = PrivStore.emptyContact();
    state.contact.enabled = true;
  }
  fillForm(); renderSocialForm(); renderLinksForm(); updateChips(); updateIdentityLock(); refresh();
}

function loadStarkDemo() {
  if (!confirm('¿Cargar demo @stark? Sustituye el contenido actual.')) return;
  state = PrivStore.starkDemo();
  ensureSocialOrder();
  nid = 30;
  fillForm(); renderSocialForm(); renderLinksForm(); updateChips(); updateIdentityLock(); refresh(); doSave(true);
}

function fillForm() {
  document.getElementById('name').value = state.name || '';
  document.getElementById('bio').value = state.bio || '';
  document.getElementById('username').value = state.username || '';
  const up = document.getElementById('username-preview');
  if (up) up.textContent = state.username || '…';
  const bg = document.getElementById('btnGlow'); if (bg) bg.checked = !!state.btnGlow;
  const st = document.getElementById('sameTab'); if (st) st.checked = !!state.sameTab;
  const ac = state.accentColor || '#0a84ff';
  const acEl = document.getElementById('accentColor'); if (acEl) acEl.value = ac;
  const hx = document.getElementById('accentHex'); if (hx) hx.value = ac;
  updateAccentSwatches();
  const c = state.contact || PrivStore.emptyContact();
  const ct = document.getElementById('c-title'); if (ct) {
    document.getElementById('c-title').value = c.title || '';
    document.getElementById('c-org').value = c.org || '';
    document.getElementById('c-note').value = c.note || '';
    document.getElementById('c-email').value = c.email || '';
    document.getElementById('c-phone').value = c.phone || '';
    document.getElementById('c-web').value = c.web || '';
    updateVcardChrome();
  }
  updateImageHints(); updateModeChips(); updateIdentityLock();
}

function updateImageHints() {
  const av = document.getElementById('avatar-hint');
  const bg = document.getElementById('bg-hint');
  if (av) av.textContent = state.avatar ? (state.avatar.indexOf('data:') === 0 ? 'Subida' : 'URL') : 'Ninguna';
  if (bg) bg.textContent = state.bgImage ? (state.bgImage.indexOf('data:') === 0 ? 'Subida' : 'URL') : 'Ninguna';
}

function onNameField() {
  state.name = document.getElementById('name').value;
  // El usuario solo se autoderiva del nombre mientras siga siendo un marcador
  // de posición; una vez elegido (registro / import) no se toca al editar el nombre.
  if (!state.username || state.username === 'user' || state.username === 'usuario') {
    const slug = PrivStore.sanitizeUsername(state.name);
    state.username = slug || state.username || 'user';
    document.getElementById('username').value = state.username;
    const up = document.getElementById('username-preview');
    if (up) up.textContent = state.username || '…';
  }
  state.bio = document.getElementById('bio').value;
  refresh(); scheduleSave();
}

function onField() {
  state.bio = document.getElementById('bio').value;
  refresh(); scheduleSave();
}

function setProfileMode(mode) {
  state.profileMode = mode;
  if (!state.contact) state.contact = PrivStore.emptyContact();
  state.contact.enabled = (mode === 'card' || mode === 'both');
  updateModeChips(); updateIdentityLock();
  if (mode === 'links') {
    const idTab = document.getElementById('t-identidad');
    if (idTab && !idTab.classList.contains('hidden')) {
      const perfilBtn = document.querySelector('.tab[data-tab="perfil"]');
      if (perfilBtn) tab(perfilBtn);
    }
  }
  refresh(); scheduleSave();
}

function updateModeChips() {
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('on', b.dataset.v === state.profileMode));
}

function updateIdentityLock() {
  const locked = state.profileMode === 'links';
  const tabBtn = document.getElementById('tab-identidad');
  if (tabBtn) {
    tabBtn.classList.toggle('locked', locked);
    tabBtn.innerHTML = locked
      ? '<i class="fa-solid fa-lock text-[10px] mr-1 opacity-70"></i>Identidad'
      : 'Identidad';
    if (window.PrivIcons) window.PrivIcons.hydrate(tabBtn);
  }
}

function onContactField() {
  if (state.profileMode === 'links') return;
  if (!state.contact) state.contact = PrivStore.emptyContact();
  state.contact.enabled = true;
  state.contact.title = document.getElementById('c-title').value;
  state.contact.org = document.getElementById('c-org').value;
  state.contact.note = document.getElementById('c-note').value;
  state.contact.email = document.getElementById('c-email').value;
  state.contact.phone = document.getElementById('c-phone').value;
  state.contact.web = document.getElementById('c-web').value;
  refresh(); scheduleSave();
}

function setAccentPreset(hex) {
  state.accentColor = hex; customAccentOpen = false;
  const row = document.getElementById('accent-custom-row');
  if (row) row.classList.add('hidden');
  const acEl = document.getElementById('accentColor'); if (acEl) acEl.value = hex;
  const hx = document.getElementById('accentHex'); if (hx) hx.value = hex;
  updateAccentSwatches(); refresh(); scheduleSave();
}

function toggleCustomAccent() {
  customAccentOpen = !customAccentOpen;
  const row = document.getElementById('accent-custom-row');
  if (row) row.classList.toggle('hidden', !customAccentOpen);
  document.querySelectorAll('.accent-swatch').forEach(b => b.classList.remove('on'));
}

function updateAccentSwatches() {
  const ac = (state.accentColor || '#0a84ff').toLowerCase();
  let matched = false;
  document.querySelectorAll('.accent-swatch').forEach(b => {
    const on = (b.dataset.c || '').toLowerCase() === ac;
    b.classList.toggle('on', on); if (on) matched = true;
  });
  if (!matched) {
    customAccentOpen = true;
    const row = document.getElementById('accent-custom-row');
    if (row) row.classList.remove('hidden');
  }
}

function onAccentColor() {
  const v = document.getElementById('accentColor').value;
  state.accentColor = v;
  document.getElementById('accentHex').value = v;
  document.querySelectorAll('.accent-swatch').forEach(b => b.classList.remove('on'));
  refresh(); scheduleSave();
}
function onAccentHex() {
  let v = document.getElementById('accentHex').value.trim();
  if (v && v.charAt(0) !== '#') v = '#' + v;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) {
    state.accentColor = v;
    document.getElementById('accentColor').value = v.length === 4 ? '#' + v[1]+v[1]+v[2]+v[2]+v[3]+v[3] : v;
    document.querySelectorAll('.accent-swatch').forEach(b => b.classList.remove('on'));
    refresh(); scheduleSave();
  }
}

function onAvatarFile(ev) {
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  PrivStore.readImageFile(f, 512, 200000).then(function (data) {
    state.avatar = data; updateImageHints(); refresh(); scheduleSave(); showToast('Avatar listo');
  }).catch(function (e) { alert(e.message); });
  ev.target.value = '';
}
function onBgFile(ev) {
  const f = ev.target.files && ev.target.files[0]; if (!f) return;
  PrivStore.readImageFile(f, 1600, 450000).then(function (data) {
    state.bgImage = data; updateImageHints(); refresh(); scheduleSave(); showToast('Fondo listo');
  }).catch(function (e) { alert(e.message); });
  ev.target.value = '';
}
function clearAvatar() { state.avatar = ''; updateImageHints(); refresh(); scheduleSave(); }
function clearBg() { state.bgImage = ''; updateImageHints(); refresh(); scheduleSave(); }

function setPreviewDevice(dev) {
  previewDevice = dev;
  document.querySelectorAll('.preview-toggle').forEach(b => {
    b.classList.toggle('on', b.dataset.v === dev);
    b.classList.toggle('text-steel', b.dataset.v !== dev);
  });
  var phone = document.getElementById('frame-phone');
  var desk = document.getElementById('frame-desktop');
  if (phone) {
    phone.classList.toggle('is-visible', dev === 'phone');
    phone.classList.toggle('is-hidden', dev !== 'phone');
    phone.classList.remove('hidden');
  }
  if (desk) {
    desk.classList.toggle('is-visible', dev === 'desktop');
    desk.classList.toggle('is-hidden', dev !== 'desktop');
    desk.classList.remove('hidden');
  }
  refresh();
}

function refresh() {
  // Navegación interna: u.html?u=… funciona con y sin reescrituras del servidor.
  document.getElementById('public-link').href = PrivStore.profileHref(state.username);
  const wrap = document.getElementById('av-wrap');
  if (wrap) {
    if (state.avatar) wrap.innerHTML = '<img src="' + PrivStore.esc(state.avatar) + '" class="w-full h-full object-cover">';
    else wrap.textContent = (state.name || '?')[0].toUpperCase();
  }
  renderDomains();
  const du = document.getElementById('desktop-url');
  if (du) du.textContent = 'privtr.ee/@' + (state.username || '…');
  if (previewDevice === 'desktop') {
    PrivStore.renderProfile(state, document.getElementById('preview-desktop'), { compact: false });
  } else {
    PrivStore.renderProfile(state, document.getElementById('preview'), { compact: true });
  }
}

function renderDomains() {
  const el = document.getElementById('domain-list');
  if (!el) return;
  const u = state.username || '…';
  el.innerHTML = PrivStore.DOMAINS.map(function (d) {
    return '<div class="flex items-center gap-2 py-1">' +
      '<span class="flex-1 text-[11px] font-mono text-mist truncate">' + PrivStore.esc(d) + '/@' + PrivStore.esc(u) + '</span>' +
      '<button type="button" onclick="copyDomain()" class="text-[10px] px-2 py-0.5 rounded border border-neon/30 text-neon hover:bg-neon/10 transition">Copiar</button></div>';
  }).join('');
}
function copyDomain() {
  // Siempre la URL canónica del dominio final, que es la que se comparte.
  const url = PrivStore.profileUrl(state);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () { showToast('Enlace copiado'); },
      function () { showToast('No se pudo copiar'); });
  } else {
    showToast('No se pudo copiar');
  }
}

function orderedSocialDefs() {
  ensureSocialOrder();
  const byId = {};
  PrivStore.SOCIAL_DEFS.forEach(function (s) { byId[s.id] = s; });
  const ordered = [];
  state.socialOrder.forEach(function (id) { if (byId[id]) ordered.push(byId[id]); });
  PrivStore.SOCIAL_DEFS.forEach(function (s) { if (ordered.indexOf(s) < 0) ordered.push(s); });
  return ordered;
}

function renderSocialForm() {
  const ordered = orderedSocialDefs();
  const filled = []; const empty = [];
  ordered.forEach(function (s) {
    if ((state.social[s.id] || '').trim()) filled.push(s); else empty.push(s);
  });
  const showAll = !filled.length || socialExpanded;
  const list = showAll ? filled.concat(empty) : filled;
  const el = document.getElementById('social-list');
  if (!el) return;
  el.innerHTML = list.map(function (s) {
    const hasVal = !!(state.social[s.id] || '').trim();
    return '<div class="flex items-center gap-2 p-2.5 rounded-xl bg-panel border border-white/5" ' +
      (hasVal ? 'draggable="true" data-sid="' + s.id + '" ondragstart="socialDragStart(event,\'' + s.id + '\')" ondragover="socialDragOver(event)" ondrop="socialDrop(event,\'' + s.id + '\')" ondragend="socialDragEnd()"' : '') + '>' +
      (hasVal ? '<span class="text-steel cursor-grab text-xs">⠿</span>' : '<span class="w-3"></span>') +
      '<span class="w-8 text-center text-mist"><i class="' + s.icon + '"></i></span>' +
      '<div class="flex-1 min-w-0"><div class="text-[10px] text-steel">' + s.label + '</div>' +
      '<input value="' + PrivStore.esc(state.social[s.id] || '') + '" placeholder="' + s.placeholder + '" ' +
      'class="w-full bg-transparent text-sm text-white focus:outline-none" ' +
      'oninput="onSocialInput(\'' + s.id + '\',this.value)"></div></div>';
  }).join('');
  if (window.PrivIcons) window.PrivIcons.hydrate(el);
  const btn = document.getElementById('social-more-btn');
  if (!btn) return;
  if (!filled.length) { btn.classList.add('hidden'); socialExpanded = true; }
  else if (empty.length) {
    btn.classList.remove('hidden');
    btn.textContent = socialExpanded ? 'Ver menos' : 'Ver más redes (' + empty.length + ')';
  } else btn.classList.add('hidden');
}
function onSocialInput(id, val) {
  state.social[id] = val; ensureSocialOrder();
  refresh(); scheduleSave();
  clearTimeout(window._socRender);
  window._socRender = setTimeout(function () { renderSocialForm(); }, 400);
}
function toggleSocialMore() { socialExpanded = !socialExpanded; renderSocialForm(); }
function socialDragStart(e, id) { socialDragId = id; e.currentTarget.classList.add('opacity-50'); }
function socialDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function socialDragEnd() {
  document.querySelectorAll('#social-list > div').forEach(function (d) { d.classList.remove('drag-over', 'opacity-50'); });
}
function socialDrop(e, targetId) {
  e.preventDefault();
  if (!socialDragId || socialDragId === targetId) return;
  ensureSocialOrder();
  const from = state.socialOrder.indexOf(socialDragId);
  const to = state.socialOrder.indexOf(targetId);
  if (from < 0 || to < 0) return;
  state.socialOrder.splice(from, 1);
  state.socialOrder.splice(to, 0, socialDragId);
  socialDragId = null;
  renderSocialForm(); refreshWithFLIP(); flashPreview(); scheduleSave();
}

function typeLabel(t) {
  return { link: 'Enlace', heading: 'Título', text: 'Texto', spacer: 'Espacio' }[t] || t;
}
function colorOptions(selected) {
  return PrivStore.PRESET_COLORS.map(function (c) {
    return '<option value="' + c.id + '"' + (selected === c.id ? ' selected' : '') + '>' + c.label + '</option>';
  }).join('') +
    '<option value="custom"' + (selected === 'custom' ? ' selected' : '') + '>Personalizado #</option>' +
    '<option value=""' + (!selected ? ' selected' : '') + '>Global</option>';
}
function brandOptions(selected) {
  return PrivStore.BRANDS.map(function (b) {
    return '<option value="' + b.id + '"' + (selected === b.id ? ' selected' : '') + '>' + b.label + '</option>';
  }).join('');
}
function iconModeOptions(selected) {
  return [{ id: 'none', label: 'Sin icono' }, { id: 'favicon', label: 'Inicial del sitio' }, { id: 'preset', label: 'Icono predeterminado' }]
    .map(function (o) { return '<option value="' + o.id + '"' + (selected === o.id ? ' selected' : '') + '>' + o.label + '</option>'; }).join('');
}
function presetIconOptions(selected) {
  return PrivStore.ICON_PRESETS.map(function (p) {
    return '<option value="' + p.icon + '"' + (selected === p.icon ? ' selected' : '') + '>' + p.id + '</option>';
  }).join('');
}

function renderLinksForm() {
  const el = document.getElementById('link-list');
  if (!el) return;
  if (!state.links.length) {
    el.innerHTML = '<p class="text-xs text-steel py-4 text-center border border-dashed border-white/10 rounded-xl">Sin enlaces</p>';
    return;
  }
  el.innerHTML = state.links.map(function (l) {
    const isBlock = l.type === 'heading' || l.type === 'text' || l.type === 'spacer';
    const isSpacer = l.type === 'spacer';
    const showStyle = !isBlock && l.type !== 'text';
    const isCustom = l.color === 'custom' || (l.customColor && l.customColor.charAt(0) === '#');
    let body = isSpacer ? '<p class="text-xs text-steel">Espaciador</p>' :
      '<input value="' + PrivStore.esc(l.title) + '" oninput="updLink(' + l.id + ',\'title\',this.value)" class="w-full bg-transparent text-sm text-white font-medium" placeholder="Título">' +
      ((!isBlock || l.type === 'text') ? '<input value="' + PrivStore.esc(l.url) + '" oninput="updLink(' + l.id + ',\'url\',this.value)" class="w-full bg-transparent text-xs text-steel" placeholder="https://">' : '') +
      (showStyle ? '<div class="flex gap-2 flex-wrap items-center">' +
        '<select onchange="applyBrand(' + l.id + ',this.value)" class="text-[11px] bg-void border border-white/10 rounded-lg px-2 py-1 text-mist">' + brandOptions(l.brand || 'custom') + '</select>' +
        '<select onchange="onLinkColor(' + l.id + ',this.value)" class="text-[11px] bg-void border border-white/10 rounded-lg px-2 py-1 text-mist">' + colorOptions(isCustom ? 'custom' : l.color) + '</select>' +
        (isCustom ? '<input type="color" value="' + PrivStore.esc(l.customColor || '#0a84ff') + '" oninput="updLinkCustomColor(' + l.id + ',this.value)" class="w-7 h-7 rounded border border-white/10 bg-void cursor-pointer">' : '') +
        '</div><div class="flex gap-2 flex-wrap items-center">' +
        '<select onchange="onIconMode(' + l.id + ',this.value)" class="text-[11px] bg-void border border-white/10 rounded-lg px-2 py-1 text-mist">' + iconModeOptions(l.iconMode || 'none') + '</select>' +
        (l.iconMode === 'preset' ? '<select onchange="updLink(' + l.id + ',\'icon\',this.value)" class="text-[11px] bg-void border border-white/10 rounded-lg px-2 py-1 text-mist">' + presetIconOptions(l.icon) + '</select>' : '') +
        '</div>' : '');
    return '<div class="flex gap-2 p-3 rounded-xl bg-panel border border-white/5" draggable="true" data-id="' + l.id + '" ondragstart="dragStart(event,' + l.id + ')" ondragover="dragOver(event)" ondrop="drop(event,' + l.id + ')" ondragend="dragEnd(event)">' +
      '<span class="text-steel cursor-grab self-center">⠿</span><div class="flex-1 space-y-1.5 min-w-0"><div class="text-[10px] text-neon/80">' + typeLabel(l.type) + '</div>' + body + '</div>' +
      '<button type="button" onclick="delLink(' + l.id + ')" class="text-steel hover:text-red-400 self-center">✕</button></div>';
  }).join('');
}

function onLinkColor(id, val) {
  const l = state.links.find(function (x) { return x.id === id; });
  if (!l) return;
  if (val === 'custom') { l.color = 'custom'; if (!l.customColor) l.customColor = '#0a84ff'; }
  else { l.color = val; l.customColor = ''; }
  renderLinksForm(); refresh(); scheduleSave();
}
function updLinkCustomColor(id, val) {
  const l = state.links.find(function (x) { return x.id === id; });
  if (!l) return;
  if (val && val.charAt(0) !== '#') val = '#' + val;
  l.color = 'custom'; l.customColor = val; refresh(); scheduleSave();
}
function onIconMode(id, mode) {
  const l = state.links.find(function (x) { return x.id === id; });
  if (!l) return;
  l.iconMode = mode;
  if (mode === 'preset' && !l.icon) l.icon = 'fa-solid fa-link';
  renderLinksForm(); refresh(); scheduleSave();
}
function applyBrand(id, brandId) {
  const l = state.links.find(function (x) { return x.id === id; });
  const b = PrivStore.BRANDS.find(function (x) { return x.id === brandId; });
  if (!l || !b) return;
  l.brand = brandId; l.icon = b.icon; if (b.color) l.color = b.color;
  if (l.iconMode !== 'favicon') l.iconMode = 'preset';
  renderLinksForm(); refresh(); scheduleSave();
}
function addLink(type) {
  type = type || 'link';
  const defaults = {
    link: { title: '', url: '', color: 'blue', icon: 'fa-solid fa-link', brand: 'custom', iconMode: 'preset' },
    heading: { title: 'Sección', url: '', color: '', icon: '', brand: '', iconMode: 'none' },
    text: { title: 'Texto…', url: '', color: '', icon: '', brand: '', iconMode: 'none' },
    spacer: { title: '', url: '', color: '', icon: '', brand: '', iconMode: 'none' },
  };
  const d = defaults[type] || defaults.link;
  state.links.push({ id: nid++, type: type, title: d.title, url: d.url, color: d.color, icon: d.icon, brand: d.brand, iconMode: d.iconMode, customColor: '' });
  renderLinksForm(); refresh(); scheduleSave();
}
function updLink(id, f, v) {
  const l = state.links.find(function (x) { return x.id === id; });
  if (l) { l[f] = v; refresh(); scheduleSave(); }
}
function delLink(id) {
  state.links = state.links.filter(function (x) { return x.id !== id; });
  renderLinksForm(); refresh(); scheduleSave();
}
function dragStart(e, id) { dragId = id; e.currentTarget.classList.add('opacity-50'); }
function dragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
function dragEnd() { document.querySelectorAll('#link-list > div').forEach(function (d) { d.classList.remove('drag-over', 'opacity-50'); }); }
function drop(e, targetId) {
  e.preventDefault();
  if (dragId == null || dragId === targetId) return;
  const from = state.links.findIndex(function (l) { return l.id === dragId; });
  const to = state.links.findIndex(function (l) { return l.id === targetId; });
  if (from < 0 || to < 0) return;
  const item = state.links.splice(from, 1)[0];
  state.links.splice(to, 0, item);
  dragId = null; renderLinksForm(); refreshWithFLIP(); flashPreview(); scheduleSave();
}
function setOpt(key, val) { state[key] = val; updateChips(); refresh(); scheduleSave(); }
function updateChips() {
  document.querySelectorAll('.shape-btn').forEach(function (b) { b.classList.toggle('on', b.dataset.v === state.shape); });
  document.querySelectorAll('.style-btn').forEach(function (b) { b.classList.toggle('on', b.dataset.v === state.btnStyle); });
  document.querySelectorAll('.size-btn').forEach(function (b) { b.classList.toggle('on', b.dataset.v === state.btnSize); });
}
function tab(btn) {
  if (btn.dataset.tab === 'identidad' && state.profileMode === 'links') {
    showToast('Activa «Tarjeta + enlaces» o «Solo tarjeta» en Perfil');
    return;
  }
  document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); t.classList.add('text-steel'); });
  btn.classList.add('active'); btn.classList.remove('text-steel');
  document.querySelectorAll('[id^=t-]').forEach(function (e) { e.classList.add('hidden'); });
  document.getElementById('t-' + btn.dataset.tab).classList.remove('hidden');
  if (btn.dataset.tab === 'redes') renderSocialForm();
  if (btn.dataset.tab === 'identidad') { updateIdentityLock(); updateVcardChrome(); }
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () { doSave(false); }, 500);
}
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.remove('opacity-0');
  setTimeout(function () { t.classList.add('opacity-0'); }, 1800);
}
window.__privToast = showToast;
function doSave(manual) {
  try { state = PrivStore.save(state); if (manual) showToast('Guardado ✓'); }
  catch (e) { showToast('Almacenamiento lleno'); return; }
}
function exportJSON() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.download = state.username + '-priv.json'; a.click(); showToast('Exportado');
}
function importJSON(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = function () {
    try {
      state = PrivStore.normalize(JSON.parse(r.result));
      ensureSocialOrder();
      fillForm(); renderSocialForm(); renderLinksForm(); updateChips(); updateIdentityLock(); refresh(); doSave(true);
    } catch (e) { alert('JSON inválido'); }
  };
  r.readAsText(f);
}
function deleteAccount() {
  const pw = (document.getElementById('del-pw').value || '').trim();
  if (pw.toUpperCase() !== 'ELIMINAR') { alert('Escribe ELIMINAR para confirmar'); return; }
  if (!confirm('¿Eliminar definitivamente esta página de este navegador?')) return;
  try {
    localStorage.removeItem('priv_page_' + state.username);
    const cur = localStorage.getItem('priv_page');
    if (cur) { try { if (JSON.parse(cur).username === state.username) localStorage.removeItem('priv_page'); } catch (e) {} }
    localStorage.removeItem('priv_session');
  } catch (e) {}
  showToast('Cuenta eliminada');
  setTimeout(function () { location.href = 'index.html'; }, 800);
}
function updateVcardChrome() {
  if (!state.contact) state.contact = PrivStore.emptyContact();
  const border = state.contact.borderColor || state.accentColor || '#0a84ff';
  const bc = document.getElementById('c-border');
  if (bc) bc.value = border;
  document.querySelectorAll('.vcard-border-swatch').forEach(function (b) {
    b.classList.toggle('on', (b.dataset.c || '').toLowerCase() === border.toLowerCase());
  });
  const qs = state.contact.qrStyle === 'themed' ? 'themed' : 'classic';
  const qc = document.getElementById('qr-classic');
  const qt = document.getElementById('qr-themed');
  if (qc) qc.classList.toggle('on', qs === 'classic');
  if (qt) qt.classList.toggle('on', qs === 'themed');
}
function setVcardBorder(hex) {
  if (!state.contact) state.contact = PrivStore.emptyContact();
  state.contact.enabled = true;
  state.contact.borderColor = hex;
  updateVcardChrome();
  refresh(); scheduleSave();
}
function setQrStyle(style) {
  if (!state.contact) state.contact = PrivStore.emptyContact();
  state.contact.enabled = true;
  state.contact.qrStyle = style === 'themed' ? 'themed' : 'classic';
  updateVcardChrome();
  refresh(); scheduleSave();
}
init();
