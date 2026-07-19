(function(){
  "use strict";

  /* =========================================================
     0. GOOGLE DRIVE (Google Apps Script Web App)
     ---------------------------------------------------------
     1. Despliega el archivo Code.gs que te entregamos como
        Aplicación web (Ejecutar como: yo, Acceso: Cualquier usuario).
     2. Pega aquí la URL que te da el despliegue.
        Mientras esta URL no esté configurada, el sitio sigue
        funcionando con vistas previas locales (como antes),
        simplemente no persistirán al recargar la página.
     ========================================================= */
  const DRIVE_WEBAPP_URL = 'PON_AQUI_TU_URL_DE_APPS_SCRIPT';

  function driveConfigurado_(){
    return !!DRIVE_WEBAPP_URL && DRIVE_WEBAPP_URL.indexOf('PON_AQUI') === -1;
  }

  function fileToBase64_(file){
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Sube un archivo a la carpeta de Drive correspondiente a esa promoción.
  async function uploadToDrive_(file, promoCode){
    if(!driveConfigurado_()) return null;
    try{
      const base64 = await fileToBase64_(file);
      const fd = new FormData();
      fd.append('promo', promoCode || 'General');
      fd.append('filename', file.name);
      fd.append('mimeType', file.type || 'application/octet-stream');
      fd.append('base64', base64);
      // Importante: no fijar Content-Type manualmente, el navegador arma
      // el boundary multipart automáticamente y así Apps Script no bloquea por CORS.
      const res = await fetch(DRIVE_WEBAPP_URL, { method:'POST', body: fd });
      const data = await res.json();
      return (data && data.ok && data.url) ? data : null;
    }catch(err){
      console.warn('No se pudo subir a Drive, se mostrará solo localmente:', err);
      return null;
    }
  }

  // Lee las fotos ya guardadas de una promoción específica.
  async function fetchDrivePhotos_(promoCode){
    if(!driveConfigurado_()) return [];
    try{
      const res = await fetch(DRIVE_WEBAPP_URL + '?promo=' + encodeURIComponent(promoCode));
      const data = await res.json();
      return (data && data.ok && Array.isArray(data.files)) ? data.files : [];
    }catch(err){
      console.warn('No se pudieron cargar fotos de Drive:', err);
      return [];
    }
  }

  // Lee la lista de promociones "personalizadas" que la gente ya creó.
  async function fetchCustomPromos_(){
    if(!driveConfigurado_()) return [];
    try{
      const res = await fetch(DRIVE_WEBAPP_URL + '?listAll=1');
      const data = await res.json();
      return (data && data.ok && Array.isArray(data.promos)) ? data.promos : [];
    }catch(err){
      console.warn('No se pudo listar promociones personalizadas:', err);
      return [];
    }
  }

  /* ---------- reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, {threshold:.15});
    revealEls.forEach(el=>io.observe(el));
  } else {
    revealEls.forEach(el=>el.classList.add('visible'));
  }

  /* =========================================================
     1. REPRODUCTOR DE MÚSICA (sticky arriba, play/pause real)
     ========================================================= */
  const audioPlayerContainer = document.getElementById('audioPlayerContainer');
  const audioToggle = document.getElementById('audioToggle');
  const partyAudio = document.getElementById('partyAudio');
  const audioHint = document.getElementById('audioHint');
  const iconPlay = audioToggle.querySelector('.icon-play');
  const iconPause = audioToggle.querySelector('.icon-pause');

  // Autoplay queda explícitamente desactivado
  partyAudio.autoplay = false;

  function setPlayingUI(isPlaying){
    audioToggle.classList.toggle('playing', isPlaying);
    audioToggle.setAttribute('aria-pressed', String(isPlaying));
    audioToggle.setAttribute('aria-label', isPlaying ? 'Pausar música' : 'Reproducir música');
    audioPlayerContainer.classList.toggle('is-playing', isPlaying);
    iconPlay.hidden = isPlaying;
    iconPause.hidden = !isPlaying;
    audioHint.textContent = isPlaying ? 'Sonando ahora' : 'Toca play para escuchar';
  }

  audioToggle.addEventListener('click', ()=>{
    if(partyAudio.paused){
      const playPromise = partyAudio.play();
      if(playPromise && typeof playPromise.then === 'function'){
        playPromise
          .then(()=> setPlayingUI(true))
          .catch(()=>{
            audioHint.textContent = 'Agrega tu archivo de audio en assets/dj-set.mp3';
            setPlayingUI(false);
          });
      } else {
        setPlayingUI(true);
      }
    } else {
      partyAudio.pause();
      setPlayingUI(false);
    }
  });

  partyAudio.addEventListener('ended', ()=> setPlayingUI(false));
  partyAudio.addEventListener('pause', ()=> setPlayingUI(false));
  partyAudio.addEventListener('play', ()=> setPlayingUI(true));

  // ---- Autoplay inteligente ----
  // Intenta reproducir apenas carga la página. Los navegadores casi siempre
  // bloquean esto sin interacción previa del usuario; si falla, queda
  // "armado" para arrancar automáticamente en el primer scroll, clic o toque.
  function intentarAutoplay(){
    if(!partyAudio.paused) return; // ya está sonando, no hacer nada
    const p = partyAudio.play();
    if(p && typeof p.catch === 'function'){
      p.catch(()=>{ /* el navegador lo bloqueó: se reintentará con la interacción */ });
    }
  }

  if(document.readyState === 'complete'){
    intentarAutoplay();
  } else {
    window.addEventListener('load', intentarAutoplay);
  }
  ['scroll', 'click', 'touchstart', 'keydown'].forEach((evt)=>{
    document.addEventListener(evt, intentarAutoplay, { once:true, passive:true });
  });

  /* =========================================================
     2. MODAL COLLAGE - funciona para CUALQUIER promoción
     ========================================================= */
  const collageModal = document.getElementById('collageModal');
  const collageTitle = document.getElementById('collageTitle');
  const collageGrid = document.getElementById('collageGrid');
  const collageClose = document.getElementById('collageClose');
  let lastFocusedEl = null;

  // Captions genéricas de respaldo para armar el collage asimétrico
  // mientras no haya fotos reales subidas a Drive para esa promoción.
  const COLLAGE_PLACEHOLDERS = [
    { text:'Foto grupal<br>graduación', size:'big' },
    { text:'Kermés', size:'' },
    { text:'Viaje de<br>promoción', size:'tall' },
    { text:'Última<br>campanada', size:'' },
    { text:'Equipo de<br>fútbol', size:'' },
    { text:'Fiesta de<br>graduación', size:'wide' },
    { text:'Patio del<br>colegio', size:'' }
  ];

  function renderPlaceholderCollage_(label){
    collageGrid.innerHTML = '';
    COLLAGE_PLACEHOLDERS.forEach(item=>{
      const cell = document.createElement('div');
      cell.className = 'collage-item' + (item.size ? (' ' + item.size) : '');
      const span = document.createElement('span');
      span.innerHTML = item.text + '<br>' + label;
      cell.appendChild(span);
      collageGrid.appendChild(cell);
    });
  }

  function renderRealCollage_(files){
    collageGrid.innerHTML = '';
    files.forEach((file, i)=>{
      const cell = document.createElement('div');
      cell.className = 'collage-item' + (i === 0 ? ' big' : (i === 2 ? ' tall' : (i === 5 ? ' wide' : '')));
      const isVideo = /video/i.test(file.mimeType || '') || /\.(mp4|mov|webm)$/i.test(file.name || '');
      if(isVideo){
        const span = document.createElement('span');
        span.innerHTML = '🎬<br>' + (file.name || 'Video');
        cell.appendChild(span);
      } else {
        const img = document.createElement('img');
        img.src = file.url;
        img.alt = file.name || 'Recuerdo';
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;';
        cell.appendChild(img);
      }
      collageGrid.appendChild(cell);
    });
  }

  async function openCollageModal(promo){
    // promo = { code, label }
    collageTitle.textContent = promo.label + ' · Álbum completo';
    renderPlaceholderCollage_(promo.label); // respuesta inmediata

    lastFocusedEl = document.activeElement;
    collageModal.hidden = false;
    document.body.style.overflow = 'hidden';
    collageClose.focus();

    // si hay backend de Drive configurado, reemplaza por las fotos reales
    const files = await fetchDrivePhotos_(promo.code);
    if(files.length && !collageModal.hidden){
      renderRealCollage_(files);
    }
  }
  function closeCollageModal(){
    collageModal.hidden = true;
    document.body.style.overflow = '';
    if(lastFocusedEl) lastFocusedEl.focus();
  }

  collageClose.addEventListener('click', closeCollageModal);
  collageModal.addEventListener('click', (e)=>{
    if(e.target === collageModal) closeCollageModal();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !collageModal.hidden) closeCollageModal();
  });

  // Conecta cualquier mosaico existente (tarjeta destacada + cuadrícula) al modal.
  function activarMosaico(el){
    if(!el || el.dataset.collageBound) return;
    el.dataset.collageBound = '1';
    el.addEventListener('click', ()=>{
      openCollageModal({ code: el.getAttribute('data-code'), label: el.getAttribute('data-label') });
    });
  }
  document.querySelectorAll('[data-code]').forEach(activarMosaico);

  /* =========================================================
     MURO DE RECUERDOS: subir foto/video (vista previa local)
     ========================================================= */
  const btnSubirRecuerdo = document.getElementById('btnSubirRecuerdo');
  const inputRecuerdo = document.getElementById('inputRecuerdo');
  const promosGrid = document.getElementById('promosGrid');

  btnSubirRecuerdo.addEventListener('click', ()=> inputRecuerdo.click());

  inputRecuerdo.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const tile = document.createElement('div');
    tile.className = 'promo-tile new-upload';

    if(file.type.startsWith('image/')){
      const url = URL.createObjectURL(file);
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Recuerdo subido';
      tile.appendChild(img);
    } else {
      const span = document.createElement('span');
      span.textContent = '🎬';
      span.style.fontSize = '22px';
      tile.appendChild(span);
    }
    const label = document.createElement('div');
    label.className = 'upload-label';
    label.textContent = 'Nuevo';
    tile.appendChild(label);

    promosGrid.appendChild(tile);
    inputRecuerdo.value = '';

    // Persistencia en segundo plano (si Drive está configurado); no bloquea la UI.
    uploadToDrive_(file, 'General');
  });

  /* =========================================================
     2b. NUEVA PROMOCIÓN ("+ ¿Tu promo no está?")
     ========================================================= */
  const addPromoTile = document.getElementById('addPromoTile');
  const addPromoModal = document.getElementById('addPromoModal');
  const addPromoClose = document.getElementById('addPromoClose');
  const addPromoForm = document.getElementById('addPromoForm');
  const newPromoInput = document.getElementById('newPromoInput');
  const btnNewPromoFile = document.getElementById('btnNewPromoFile');
  const inputNewPromoFile = document.getElementById('inputNewPromoFile');
  const previewNewPromoFile = document.getElementById('previewNewPromoFile');
  const previewNewPromoFileImg = document.getElementById('previewNewPromoFileImg');
  const previewNewPromoFileName = document.getElementById('previewNewPromoFileName');
  let newPromoFileSeleccionado = null;
  let addPromoLastFocused = null;

  function codigoDesdeLabel_(label){
    // "Promo 1985" -> "1985" · si no hay número, usa el texto tal cual
    const m = label.match(/\d{2,4}/);
    return m ? m[0] : label.trim();
  }

  function crearTilePromo_(code, label){
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'promo-tile';
    tile.setAttribute('data-code', code);
    tile.setAttribute('data-label', label);
    tile.setAttribute('aria-haspopup', 'dialog');
    tile.innerHTML = '<span>' + code + '</span>';
    activarMosaico(tile);
    promosGrid.insertBefore(tile, addPromoTile);
    return tile;
  }

  function openAddPromoModal(){
    addPromoLastFocused = document.activeElement;
    addPromoModal.hidden = false;
    document.body.style.overflow = 'hidden';
    newPromoInput.focus();
  }
  function closeAddPromoModal(){
    addPromoModal.hidden = true;
    document.body.style.overflow = '';
    if(addPromoLastFocused) addPromoLastFocused.focus();
  }

  addPromoTile.addEventListener('click', openAddPromoModal);
  addPromoClose.addEventListener('click', closeAddPromoModal);
  addPromoModal.addEventListener('click', (e)=>{
    if(e.target === addPromoModal) closeAddPromoModal();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !addPromoModal.hidden) closeAddPromoModal();
  });

  btnNewPromoFile.addEventListener('click', ()=> inputNewPromoFile.click());
  inputNewPromoFile.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    newPromoFileSeleccionado = file;
    if(file.type.startsWith('image/')){
      previewNewPromoFileImg.src = URL.createObjectURL(file);
      previewNewPromoFileImg.hidden = false;
    } else {
      previewNewPromoFileImg.hidden = true;
    }
    previewNewPromoFileName.textContent = file.name;
    previewNewPromoFile.classList.add('show');
  });

  addPromoForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const label = newPromoInput.value.trim();
    if(!label) return;
    const code = codigoDesdeLabel_(label);

    // Evita duplicar una promo que ya existe en la cuadrícula.
    const yaExiste = promosGrid.querySelector('[data-code="' + CSS.escape(code) + '"]');
    const tile = yaExiste || crearTilePromo_(code, label);

    if(newPromoFileSeleccionado){
      await uploadToDrive_(newPromoFileSeleccionado, code);
    }

    closeAddPromoModal();
    addPromoForm.reset();
    previewNewPromoFile.classList.remove('show');
    newPromoFileSeleccionado = null;

    // Abre de una vez el collage de la promo recién creada.
    openCollageModal({ code, label });
  });

  // Carga promociones personalizadas que otros ex-alumnos ya crearon antes (si Drive está configurado).
  fetchCustomPromos_().then(promos=>{
    promos.forEach(p=>{
      if(!promosGrid.querySelector('[data-code="' + CSS.escape(p.code) + '"]')){
        crearTilePromo_(p.code, p.label);
      }
    });
  });

  /* =========================================================
     3. CROQUIS DE 47 MESAS - salón La Riviera
     ========================================================= */
  const reservedMap = {
    6:  'P94', 8:  'P87', 17: 'P87', 9:  'P91', 10: 'P99',
    12: 'P99', 13: 'P99', 11: 'P76', 14: 'P97', 23: 'P97',
    24: 'P00', 25: 'P00', 26: 'P00', 27: 'P00', 19: 'P02',
  };

  const tablePositions = {
    28:[97,80], 29:[131,80], 30:[183,80], 31:[217,80], 32:[282,80], 33:[316,80],
    27:[129,132], 26:[163,132], 25:[197,132], 24:[231,132],
    14:[261,176], 13:[261,199], 12:[261,222], 11:[261,245], 10:[261,268], 9:[261,291], 8:[261,314], 7:[261,337], 6:[261,360],
    23:[309,176], 22:[309,199], 21:[309,222], 20:[309,245], 19:[309,268], 18:[309,291], 17:[309,314], 16:[309,337], 15:[309,360],
    34:[390,130], 35:[390,165], 36:[390,200], 37:[390,235], 38:[390,270], 39:[390,305], 40:[390,340],
    41:[440,130], 42:[440,165], 43:[440,200], 44:[440,235], 45:[440,270], 46:[440,305], 47:[440,340],
    1:[140,400], 2:[175,400], 3:[210,400], 4:[245,400], 5:[280,400]
  };

  const croquis = document.getElementById('croquis');
  const tablesLayer = document.getElementById('tablesLayer');
  const mesaInput = document.getElementById('mesaSeleccionada');
  let selectedTable = null;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  Object.keys(tablePositions).forEach((key)=>{
    const num = parseInt(key, 10);
    const [px, py] = tablePositions[key];
    const isReserved = Object.prototype.hasOwnProperty.call(reservedMap, num);

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'table-seat' + (isReserved ? ' reserved' : ''));
    g.setAttribute('data-table', num);
    if(isReserved) g.setAttribute('data-promo', reservedMap[num]);
    g.setAttribute('tabindex', isReserved ? '-1' : '0');
    g.setAttribute('role', 'button');
    g.setAttribute('aria-disabled', isReserved ? 'true' : 'false');
    g.setAttribute('aria-label', isReserved ? ('Mesa ' + num + ', reservada por ' + reservedMap[num]) : ('Mesa ' + num + ', libre'));

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('class', 'seat-fill');
    circle.setAttribute('cx', px);
    circle.setAttribute('cy', py);
    circle.setAttribute('r', isReserved ? 12 : 11);
    g.appendChild(circle);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', 'seat-num');
    text.setAttribute('x', px);
    text.setAttribute('y', py + 3);
    text.textContent = isReserved ? (num + '·' + reservedMap[num]) : num;
    g.appendChild(text);

    if(!isReserved){
      function selectTable(){
        if(selectedTable) selectedTable.classList.remove('selected');
        g.classList.add('selected');
        selectedTable = g;
        mesaInput.value = 'Mesa ' + num;
      }
      g.addEventListener('click', selectTable);
      g.addEventListener('keydown', (ev)=>{
        if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); selectTable(); }
      });
    }
    tablesLayer.appendChild(g);
  });

  /* =========================================================
     4. COMPROBANTE DE PAGO (QR) - VISTA PREVIA LOCAL
     ========================================================= */
  const btnComprobante = document.getElementById('btnSubirComprobante');
  const inputComprobante = document.getElementById('inputComprobante');
  const previewComprobante = document.getElementById('previewComprobante');
  const previewComprobanteImg = document.getElementById('previewComprobanteImg');
  const previewComprobanteName = document.getElementById('previewComprobanteName');

  if (btnComprobante && inputComprobante) {
    btnComprobante.addEventListener('click', ()=> inputComprobante.click());
    
    inputComprobante.addEventListener('change', (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      previewComprobanteName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (event) => {
        previewComprobanteImg.src = event.target.result;
        previewComprobante.style.display = 'flex'; // Asegura compatibilidad visual
        previewComprobante.classList.add('show');
      };
      reader.readAsDataURL(file);
    });
  }

  /* =========================================================
     5. MANEJO DINÁMICO DE SELECCIÓN DE PROMOCIÓN ("OTRA")
     ========================================================= */
  const selectPromo = document.getElementById('promo');
  const otraPromoContainer = document.getElementById('otraPromoContainer');
  const otraPromoInput = document.getElementById('otraPromoInput');

  if (selectPromo && otraPromoContainer && otraPromoInput) {
    selectPromo.addEventListener('change', (e) => {
      if (e.target.value === "Otra") {
        otraPromoContainer.style.display = 'block';
        otraPromoInput.required = true;
        otraPromoInput.focus();
      } else {
        otraPromoContainer.style.display = 'none';
        otraPromoInput.required = false;
        otraPromoInput.value = "";
      }
    });
  }

  /* =========================================================
     6. FORMULARIO DE RESERVA - ENVÍO ALEATORIO A WHATSAPP
     ========================================================= */
  const reservaForm = document.getElementById('reservaForm');
  const confirmMsg = document.getElementById('confirmMsg');

  if (reservaForm) {
    reservaForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      
      // Validación preventiva por si no marcaron croquis
      if(!mesaInput.value){
        mesaInput.focus();
        mesaInput.placeholder = 'Sel||ecciona una mesa libre en el croquis';
        return;
      }

      // Captura de datos
      const nombre = document.getElementById('nombre').value.trim();
      const whatsappUsuario = document.getElementById('whatsapp').value.trim();
      const mesa = mesaInput.value.trim();

      // Definición de promoción elegida
      let promoSeleccionada = selectPromo.value;
      if (promoSeleccionada === "Otra") {
        promoSeleccionada = otraPromoInput.value.trim();
      }

      // --- SISTEMA DE ROTACIÓN ALEATORIA CON 2 NÚMEROS ---
      const numerosOrganizadores = [
        "59179733732", // Organizador 1
        "59171724563"  // Organizador 2
      ];
      
      // Genera un índice entero estricto: 0 o 1
      const totalNumeros = numerosOrganizadores.length;
      const indiceAleatorio = Math.floor(Math.random() * totalNumeros);
      const TELEFONO_ANFITRION = numerosOrganizadores[indiceAleatorio];
      
      // Control en consola para tus pruebas
      console.log("Índice elegido:", indiceAleatorio, "-> Redirigiendo al número:", TELEFONO_ANFITRION);
      // ----------------------------------------------------

      // Formato estético del texto para enviar
      const textoMensaje = 
`¡Hola! Acabo de realizar mi reserva desde la página web. Aquí tienes mis datos:

👤 *Nombre:* ${nombre}
📱 *Celular:* ${whatsappUsuario}
🎓 *Promoción:* ${promoSeleccionada}
🪑 *Mesa seleccionada:* ${mesa}

_(A continuación adjunto mi comprobante de pago de la entrada)_`;

      const mensajeCodificado = encodeURIComponent(textoMensaje);
      const urlWhatsApp = `https://api.whatsapp.com/send?phone=${TELEFONO_ANFITRION}&text=${mensajeCodificado}`;

      // Mostrar mensaje visual de éxito en la interfaz y abrir la pestaña
      confirmMsg.classList.add('show');
      if(confirmMsg.scrollIntoView) {
        confirmMsg.scrollIntoView({behavior:'smooth', block:'center'});
      }
      
      window.open(urlWhatsApp, '_blank');
    });
  }

  /* =========================================================
     7. SLAM DEL SAN RAFAEL (firmas dinámicas)
     ========================================================= */
  const slamForm = document.getElementById('slamForm');
  const signaturesList = document.getElementById('signaturesList');
  const fontClasses = ['font-a','font-b','font-c'];

  if (slamForm) {
    slamForm.addEventListener('submit', (e)=>{
      e.preventDefault();
      const apodo = document.getElementById('apodo').value.trim();
      const recuerdo = document.getElementById('recuerdo').value.trim();
      if(!apodo || !recuerdo) return;

      const card = document.createElement('div');
      card.className = 'signature-card';
      const fa = fontClasses[Math.floor(Math.random()*fontClasses.length)];
      const fb = fontClasses[Math.floor(Math.random()*fontClasses.length)];

      const nick = document.createElement('p');
      nick.className = 'nick ' + fa;
      nick.textContent = '— ' + apodo;

      const memory = document.createElement('p');
      memory.className = 'memory ' + fb;
      memory.textContent = recuerdo;

      card.appendChild(nick);
      card.appendChild(memory);
      signaturesList.insertBefore(card, signaturesList.firstChild);

      slamForm.reset();
    });
  }

})();