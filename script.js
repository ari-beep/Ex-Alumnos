(function(){
  "use strict";

  /* =========================================================
     SOBRE VIRTUAL DE INTRODUCCIÓN
     ---------------------------------------------------------
     1. Solapa se abre (rotateX) → 2. la tarjeta sale deslizándose
     hacia arriba → 3. todo el sobre se desvanece y libera el scroll.
     ========================================================= */
  (function initEnvelopeIntro(){
    const intro = document.getElementById('envelopeIntro');
    if(!intro) return;

    const stage = document.getElementById('envelopeStage');
    const seal = document.getElementById('envelopeSeal');
    const hint = document.getElementById('envelopeHint');
    const flap = document.getElementById('envelopeFlap');
    const card = document.getElementById('envelopeCard');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let opened = false;

    document.body.classList.add('intro-lock');

    function finalizar(){
      intro.hidden = true;
      document.body.classList.remove('intro-lock');
    }

    function abrirSobre(){
      if(opened) return;
      opened = true;
      intro.classList.add('opening'); // oculta el texto de ayuda

      if(reduceMotion){
        finalizar();
        return;
      }

      flap.classList.add('flap-open');           // 1. abre la solapa
      setTimeout(()=> card.classList.add('card-open'), 550);   // 2. sale la tarjeta
      setTimeout(()=> intro.classList.add('fade-out'), 550 + 750); // 3. se desvanece
      setTimeout(finalizar, 550 + 750 + 550);     // 4. libera el scroll
    }

    // El sello de lacre es el "botón" principal; el sobre y el texto
    // de abajo también abren, para que el gesto sea fácil en cualquier punto.
    seal.addEventListener('click', (e)=>{ e.stopPropagation(); abrirSobre(); });
    stage.addEventListener('click', abrirSobre);
    hint.addEventListener('click', abrirSobre);
    stage.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); abrirSobre(); }
    });
  })();

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
  const DRIVE_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbyEP6l6-O2u6UO2JZxDfXMqTMZ-4G2cb08_iGj60AY-jJ0HRC0d6__QbeCR49g_2i_i/exec';

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

  // Captions genéricas de respaldo, con alturas variadas para simular el
  // efecto masonry mientras no haya fotos reales subidas a Drive.
  const COLLAGE_PLACEHOLDERS = [
    { text:'Foto grupal<br>graduación', h:'lg' },
    { text:'Kermés', h:'sm' },
    { text:'Viaje de<br>promoción', h:'md' },
    { text:'Última<br>campanada', h:'sm' },
    { text:'Equipo de<br>fútbol', h:'lg' },
    { text:'Fiesta de<br>graduación', h:'md' },
    { text:'Patio del<br>colegio', h:'sm' }
  ];

  function renderPlaceholderCollage_(label){
    collageGrid.innerHTML = '';
    COLLAGE_PLACEHOLDERS.forEach(item=>{
      const cell = document.createElement('div');
      cell.className = 'collage-item placeholder h-' + item.h;
      const span = document.createElement('span');
      span.innerHTML = item.text + '<br>' + label;
      cell.appendChild(span);
      collageGrid.appendChild(cell);
    });
  }

  // Convierte cualquier link de Google Drive (visor, "uc?export=view", etc.)
  // en el enlace de miniatura, que es el que Google sirve de forma confiable
  // dentro de una etiqueta <img>. Si no reconoce el formato, lo deja igual.
  function driveIdDesdeUrl_(url){
    if(!url) return null;
    const patrones = [
      /\/file\/d\/([a-zA-Z0-9_-]{10,})/,  // .../file/d/ID/view
      /[?&]id=([a-zA-Z0-9_-]{10,})/,       // .../uc?export=view&id=ID  ó  thumbnail?id=ID
      /\/d\/([a-zA-Z0-9_-]{10,})/          // https://lh3.googleusercontent.com/d/ID
    ];
    for(const re of patrones){
      const m = url.match(re);
      if(m && m[1]) return m[1];
    }
    return null;
  }
  function toDriveThumbnailUrl_(url){
    const id = driveIdDesdeUrl_(url);
    return id ? ('https://drive.google.com/thumbnail?id=' + id + '&sz=w1000') : url;
  }
  // Versión en alta resolución para el lightbox (más grande que la miniatura del grid).
  function toDriveFullUrl_(url){
    const id = driveIdDesdeUrl_(url);
    return id ? ('https://drive.google.com/thumbnail?id=' + id + '&sz=w1600') : url;
  }
  function toDriveUcUrl_(url){
    const id = driveIdDesdeUrl_(url);
    return id ? ('https://drive.google.com/uc?export=view&id=' + id) : url;
  }

  // Cuadrícula tipo Pinterest: cada imagen conserva su proporción original
  // (nada de object-fit:cover que recorte) y se acomoda con CSS columns.
  function renderRealCollage_(files){
    collageGrid.innerHTML = '';
    files.forEach((file)=>{
      const cell = document.createElement('div');
      const isVideo = /video/i.test(file.mimeType || '') || /\.(mp4|mov|webm)$/i.test(file.name || '');

      if(isVideo){
        cell.className = 'collage-item is-video';
        const span = document.createElement('span');
        span.innerHTML = '🎬<br>' + (file.name || 'Video');
        cell.appendChild(span);
      } else {
        cell.className = 'collage-item has-photo';
        const img = document.createElement('img');
        img.src = toDriveThumbnailUrl_(file.url); // formato confiable para <img>
        img.alt = file.name || 'Recuerdo';
        img.loading = 'lazy';
        // Si el thumbnail falla, probamos con "uc?export=view"; si también
        // falla, mostramos un aviso en vez del ícono roto con el nombre del archivo.
        img.addEventListener('error', function onErr(){
          if(!img.dataset.fallback){
            img.dataset.fallback = '1';
            img.src = toDriveUcUrl_(file.url);
          } else {
            img.removeEventListener('error', onErr);
            cell.classList.remove('has-photo');
            cell.classList.add('placeholder');
            img.remove();
            const span = document.createElement('span');
            span.innerHTML = '🖼️<br>No se pudo cargar<br>' + (file.name || '');
            cell.appendChild(span);
          }
        });
        // Vista de cerca: al tocar la foto se abre el lightbox en grande.
        cell.addEventListener('click', ()=> openLightbox(toDriveFullUrl_(file.url), img.alt));
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

  /* =========================================================
     2c. LIGHTBOX - vista de cerca a pantalla completa
     ========================================================= */
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxClose = document.getElementById('lightboxClose');
  let lightboxLastFocused = null;

  function openLightbox(url, alt){
    lightboxImg.src = url;
    lightboxImg.alt = alt || 'Foto en grande';
    lightboxLastFocused = document.activeElement;
    lightboxModal.hidden = false;
    lightboxClose.focus();
  }
  function closeLightbox(){
    lightboxModal.hidden = true;
    lightboxImg.src = '';
    if(lightboxLastFocused) lightboxLastFocused.focus();
  }

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxModal.addEventListener('click', (e)=>{
    if(e.target === lightboxModal) closeLightbox();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !lightboxModal.hidden) closeLightbox();
  });


  // Conecta cualquier mosaico existente (tarjeta destacada + cuadrícula) al modal.
  function activarMosaico(el){
    if(!el || el.dataset.collageBound) return;
    el.dataset.collageBound = '1';
    el.addEventListener('click', ()=>{
      openCollageModal({ code: el.getAttribute('data-code'), label: el.getAttribute('data-label') });
    });
  }

  // Busca la primera foto real disponible en Drive para esa promo y la usa
  // como fondo de portada, reemplazando el patrón de rayas diagonales.
  async function aplicarPortadaAutomatica_(el){
    const code = el && el.getAttribute('data-code');
    if(!code || el.dataset.portadaCargada) return;
    el.dataset.portadaCargada = '1';

    const visualEl = el.classList.contains('featured-card')
      ? el.querySelector('.featured-photo')
      : el;
    if(!visualEl) return;

    const files = await fetchDrivePhotos_(code);
    const foto = (files || []).find(f =>
      !/video/i.test(f.mimeType || '') && !/\.(mp4|mov|webm)$/i.test(f.name || '')
    );
    if(!foto) return;

    const url = toDriveThumbnailUrl_(foto.url);
    visualEl.style.backgroundImage =
      "linear-gradient(180deg, rgba(5,5,16,.15), rgba(5,5,16,.82)), url('" + url.replace(/'/g, '%27') + "')";
    visualEl.classList.add('has-cover');
  }

  document.querySelectorAll('[data-code]').forEach(el=>{
    activarMosaico(el);
    aplicarPortadaAutomatica_(el);
  });

  /* =========================================================
     MURO DE RECUERDOS: subir foto/video, eligiendo la carpeta
     ========================================================= */
  const btnSubirRecuerdo = document.getElementById('btnSubirRecuerdo');
  const promosGrid = document.getElementById('promosGrid');

  const uploadModal = document.getElementById('uploadModal');
  const uploadModalClose = document.getElementById('uploadModalClose');
  const uploadForm = document.getElementById('uploadForm');
  const uploadPromoSelect = document.getElementById('uploadPromoSelect');
  const btnElegirArchivoSubida = document.getElementById('btnElegirArchivoSubida');
  const inputArchivoSubida = document.getElementById('inputArchivoSubida');
  const previewArchivoSubida = document.getElementById('previewArchivoSubida');
  const previewArchivoSubidaImg = document.getElementById('previewArchivoSubidaImg');
  const previewArchivoSubidaName = document.getElementById('previewArchivoSubidaName');
  let archivoSeleccionadoSubida = null;
  let uploadModalLastFocused = null;

  // Rellena el <select> con "General" + todas las promociones que ya existen
  // en el muro (incluida la anfitriona), para que el usuario elija la carpeta exacta.
  function poblarSelectPromos_(){
    uploadPromoSelect.innerHTML = '';
    const general = document.createElement('option');
    general.value = 'General';
    general.textContent = 'General (no pertenece a una promo)';
    uploadPromoSelect.appendChild(general);

    document.querySelectorAll('[data-code]').forEach(el=>{
      const code = el.getAttribute('data-code');
      const label = el.getAttribute('data-label') || ('Promo ' + code);
      if(!code || code === 'General') return;
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = label;
      uploadPromoSelect.appendChild(opt);
    });
  }

  function openUploadModal(){
    poblarSelectPromos_();
    uploadModalLastFocused = document.activeElement;
    uploadModal.hidden = false;
    document.body.style.overflow = 'hidden';
    uploadPromoSelect.focus();
  }
  function closeUploadModal(){
    uploadModal.hidden = true;
    document.body.style.overflow = '';
    if(uploadModalLastFocused) uploadModalLastFocused.focus();
  }

  btnSubirRecuerdo.addEventListener('click', openUploadModal);
  uploadModalClose.addEventListener('click', closeUploadModal);
  uploadModal.addEventListener('click', (e)=>{
    if(e.target === uploadModal) closeUploadModal();
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !uploadModal.hidden) closeUploadModal();
  });

  btnElegirArchivoSubida.addEventListener('click', ()=> inputArchivoSubida.click());
  inputArchivoSubida.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    archivoSeleccionadoSubida = file;
    if(file.type.startsWith('image/')){
      previewArchivoSubidaImg.src = URL.createObjectURL(file);
      previewArchivoSubidaImg.hidden = false;
    } else {
      previewArchivoSubidaImg.hidden = true;
    }
    previewArchivoSubidaName.textContent = file.name;
    previewArchivoSubida.classList.add('show');
  });

  uploadForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!archivoSeleccionadoSubida) return;

    const file = archivoSeleccionadoSubida;
    const code = uploadPromoSelect.value || 'General';

    // Vista previa local inmediata (mientras se sube a Drive en segundo plano).
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
    const labelTag = document.createElement('div');
    labelTag.className = 'upload-label';
    labelTag.textContent = 'Nuevo';
    tile.appendChild(labelTag);
    promosGrid.appendChild(tile);

    closeUploadModal();
    uploadForm.reset();
    previewArchivoSubida.classList.remove('show');
    archivoSeleccionadoSubida = null;

    // Persistencia en Drive, dentro de la carpeta elegida.
    await uploadToDrive_(file, code);

    // Refresca la portada de esa promo con la foto recién subida.
    const destino = document.querySelector('[data-code="' + CSS.escape(code) + '"]');
    if(destino){
      delete destino.dataset.portadaCargada;
      aplicarPortadaAutomatica_(destino);
    }
  });

  /* =========================================================
     2b. NUEVA PROMOCIÓN ("+ ¿Tu promo no está?")
     ========================================================= */
  const addPromoTile = document.getElementById('addPromoTile');
  const addPromoModal = document.getElementById('addPromoModal');
  const addPromoClose = document.getElementById('addPromoClose');
  const addPromoForm = document.getElementById('addPromoForm');
  const newPromoInput = document.getElementById('newPromoInput');
  const addPromoWarning = document.getElementById('addPromoWarning');
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
    aplicarPortadaAutomatica_(tile);
    promosGrid.insertBefore(tile, addPromoTile);
    return tile;
  }

  function openAddPromoModal(){
    addPromoLastFocused = document.activeElement;
    addPromoWarning.classList.remove('show');
    addPromoModal.hidden = false;
    document.body.style.overflow = 'hidden';
    newPromoInput.focus();
  }
  function closeAddPromoModal(){
    addPromoModal.hidden = true;
    document.body.style.overflow = '';
    if(addPromoLastFocused) addPromoLastFocused.focus();
  }

  newPromoInput.addEventListener('input', ()=> addPromoWarning.classList.remove('show'));

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

    // Este botón es EXCLUSIVO para promociones que todavía no existen.
    // Si ya existe, no se sube nada aquí: se guía al usuario al botón principal.
    const yaExiste = document.querySelector('[data-code="' + CSS.escape(code) + '"]');
    if(yaExiste){
      addPromoWarning.textContent = 'Esa promoción ya existe en el muro. Usa el botón rosa "Sube recuerdos de tu promo" y selecciónala en la lista.';
      addPromoWarning.classList.add('show');
      return;
    }

    const tile = crearTilePromo_(code, label);

    if(newPromoFileSeleccionado){
      await uploadToDrive_(newPromoFileSeleccionado, code);
      delete tile.dataset.portadaCargada;
      aplicarPortadaAutomatica_(tile);
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
     3. CROQUIS DE 51 MESAS - salón La Riviera
     ========================================================= */

  // Mesas reservadas: código de mesa -> { promo } o { org:true } / { docentes:true }
  // cuando la reserva no corresponde a una promo puntual sino a la organización o al plantel docente.
  const reservedMap = {
    'ORG': { org: true },
    '1':   { org: true },
    '2':   { org: true },
    '3':   { org: true },
    '4':   { org: true },
    '5':   { org: true },
    '6':   { promo: 'P94' },
    '7':   { promo: 'P85' },
    '8':   { promo: 'P87' },
    '9':   { promo: 'P91' },
    '10':  { promo: 'P99' },
    '11':  { promo: 'P76' },
    '12':  { promo: 'P98' },
    '13':  { promo: 'P99' },
    '14':  { promo: 'P97' },
    '17':  { promo: 'P87' },
    '18':  { promo: 'P91' },
    '19':  { promo: 'P02' },
    '20':  { promo: 'P92' },
    '21':  { promo: 'P92' },
    '22':  { promo: 'P01' },
    '23':  { promo: 'P97' },
    '26':  { promo: 'P80' },
    'PROF': { docentes: true }
  };

  // Geometría de las 51 mesas dentro del viewBox 0 0 1600 1400, calcada del
  // plano oficial del salón. Cada mesa define su forma:
  //  - 'rect-v' : rectángulo vertical alargado (x,y = esquina sup-izq, w, h)
  //  - 'rect-h' : rectángulo horizontal alargado (x,y = esquina sup-izq, w, h)
  //  - 'circle' : mesa redonda (x,y = centro, r = radio)
  const tableGeometry = {
    // fila de Área Verde (arriba), dentro del recuadro verde
    32:{x:328,y:160,w:110,h:170,shape:'rect-v'},
    33:{x:494,y:160,w:110,h:170,shape:'rect-v'},
    34:{x:660,y:160,w:110,h:170,shape:'rect-v'},
    35:{x:826,y:160,w:110,h:170,shape:'rect-v'},
    36:{x:992,y:160,w:110,h:170,shape:'rect-v'},

    // fila bajo Baño Varones, por encima de la pista
    31:{x:307,y:370,w:90,h:120,shape:'rect-v'},
    30:{x:411,y:370,w:90,h:120,shape:'rect-v'},
    29:{x:514,y:370,w:90,h:120,shape:'rect-v'},
    28:{x:618,y:370,w:90,h:120,shape:'rect-v'},
    27:{x:722,y:370,w:90,h:120,shape:'rect-v'},
    26:{x:825,y:370,w:90,h:120,shape:'rect-v'},
    25:{x:929,y:370,w:90,h:120,shape:'rect-v'},
    PROF:{x:1033,y:370,w:90,h:120,shape:'rect-v'},

    // columna pegada a la pista, #14 arriba -> #6 abajo (rectángulos horizontales)
    14:{x:810,y:515,w:140,h:58,shape:'rect-h'},
    13:{x:810,y:584,w:140,h:58,shape:'rect-h'},
    12:{x:810,y:653,w:140,h:58,shape:'rect-h'},
    11:{x:810,y:722,w:140,h:58,shape:'rect-h'},
    10:{x:810,y:791,w:140,h:58,shape:'rect-h'},
    9:{x:810,y:860,w:140,h:58,shape:'rect-h'},
    8:{x:810,y:928,w:140,h:58,shape:'rect-h'},
    7:{x:810,y:997,w:140,h:58,shape:'rect-h'},
    6:{x:810,y:1066,w:140,h:58,shape:'rect-h'},

    // columna paralela, #23 arriba -> #15 abajo (rectángulos horizontales; #16 y #15 libres)
    23:{x:970,y:515,w:150,h:58,shape:'rect-h'},
    22:{x:970,y:584,w:150,h:58,shape:'rect-h'},
    21:{x:970,y:653,w:150,h:58,shape:'rect-h'},
    20:{x:970,y:722,w:150,h:58,shape:'rect-h'},
    19:{x:970,y:791,w:150,h:58,shape:'rect-h'},
    18:{x:970,y:860,w:150,h:58,shape:'rect-h'},
    17:{x:970,y:928,w:150,h:58,shape:'rect-h'},
    16:{x:970,y:997,w:150,h:58,shape:'rect-h'},
    15:{x:970,y:1066,w:150,h:58,shape:'rect-h'},

    // mesas redondas junto a la cocina, dos columnas
    37:{x:1250,y:211,r:42,shape:'circle'},
    38:{x:1250,y:352,r:42,shape:'circle'},
    39:{x:1250,y:494,r:42,shape:'circle'},
    40:{x:1250,y:635,r:42,shape:'circle'},
    41:{x:1250,y:777,r:42,shape:'circle'},
    42:{x:1250,y:918,r:42,shape:'circle'},
    43:{x:1250,y:1059,r:42,shape:'circle'},
    50:{x:1450,y:211,r:42,shape:'circle'},
    49:{x:1450,y:352,r:42,shape:'circle'},
    48:{x:1450,y:494,r:42,shape:'circle'},
    47:{x:1450,y:635,r:42,shape:'circle'},
    46:{x:1450,y:777,r:42,shape:'circle'},
    45:{x:1450,y:918,r:42,shape:'circle'},
    44:{x:1450,y:1059,r:42,shape:'circle'},

    // fila inferior, encima del arco de la Entrada
    ORG:{x:500,y:1150,w:80,h:110,shape:'rect-v'},
    1:{x:600,y:1150,w:80,h:110,shape:'rect-v'},
    2:{x:700,y:1150,w:80,h:110,shape:'rect-v'},
    3:{x:800,y:1150,w:80,h:110,shape:'rect-v'},
    4:{x:900,y:1150,w:80,h:110,shape:'rect-v'},
    5:{x:1000,y:1150,w:80,h:110,shape:'rect-v'}
  };

  const tablesLayer = document.getElementById('tablesLayer');
  const mesaInput = document.getElementById('mesaSeleccionada');
  const mesaInfoMsg = document.getElementById('mesaInfoMsg');
  let selectedTable = null;
  let mesaInfoTimeout = null;

  const SVG_NS = 'http://www.w3.org/2000/svg';

  // "P80" -> "Promo 80" (respeta el código tal cual, sin inventar el año completo)
  function promoDisplay_(codigo){
    return 'Promo ' + codigo.replace(/^P/i, '');
  }

  function mostrarInfoMesa_(texto){
    if(mesaInfoTimeout) clearTimeout(mesaInfoTimeout);
    mesaInfoMsg.textContent = texto;
    mesaInfoMsg.classList.add('show');
    mesaInfoTimeout = setTimeout(()=> mesaInfoMsg.classList.remove('show'), 4000);
  }

  Object.keys(tableGeometry).forEach((key)=>{
    const geo = tableGeometry[key];
    const info = reservedMap[key];
    const isReserved = !!info;
    const isCircle = geo.shape === 'circle';
    const cx = isCircle ? geo.x : geo.x + geo.w / 2;
    const cy = isCircle ? geo.y : geo.y + geo.h / 2;

    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'table-seat ' + geo.shape + (isReserved ? ' reserved' : ''));
    g.setAttribute('data-table', key);
    g.setAttribute('role', 'button');
    g.setAttribute('tabindex', '0');
    g.setAttribute('aria-disabled', isReserved ? 'true' : 'false');

    // Líneas de texto mostradas dentro de la mesa y mensaje al tocarla.
    let lines, infoTexto, ariaLabel, rotate = false;
    if(!isReserved){
      lines = [String(key)];
      ariaLabel = 'Mesa ' + key + ', libre';
    } else if(info.org){
      if(key === 'ORG'){
        lines = ['ORGANIZACIÓN'];
        rotate = true;
        infoTexto = 'Mesa de Organización — reservada para el equipo organizador.';
      } else {
        lines = [String(key)];
        infoTexto = 'Mesa ' + key + ' reservada para la Organización.';
      }
      ariaLabel = infoTexto;
    } else if(info.docentes){
      lines = ['PROFESORES'];
      rotate = true;
      infoTexto = 'Mesa de Profesores — reservada para el Plantel Docente.';
      ariaLabel = infoTexto;
    } else {
      // Rectángulo horizontal: cabe en una sola línea. Vertical: dos líneas.
      lines = geo.shape === 'rect-h' ? ['#' + key + '-' + info.promo] : ['#' + key, info.promo];
      infoTexto = 'Mesa #' + key + ' reservada por ' + promoDisplay_(info.promo) + '.';
      ariaLabel = infoTexto;
    }
    g.setAttribute('aria-label', ariaLabel);
    if(info && info.promo) g.setAttribute('data-promo', info.promo);

    if(isCircle){
      const circle = document.createElementNS(SVG_NS, 'circle');
      circle.setAttribute('class', 'seat-fill');
      circle.setAttribute('cx', cx);
      circle.setAttribute('cy', cy);
      circle.setAttribute('r', geo.r);
      g.appendChild(circle);
    } else {
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('class', 'seat-fill');
      rect.setAttribute('x', geo.x);
      rect.setAttribute('y', geo.y);
      rect.setAttribute('width', geo.w);
      rect.setAttribute('height', geo.h);
      rect.setAttribute('rx', 10);
      g.appendChild(rect);
    }

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', 'seat-num');
    text.setAttribute('x', cx);
    if(rotate){
      text.setAttribute('transform', 'rotate(-90 ' + cx + ' ' + cy + ')');
      text.style.fontSize = '14px';
    }
    if(lines.length === 1){
      text.setAttribute('y', cy + 4);
      text.textContent = lines[0];
    } else {
      lines.forEach((line, i)=>{
        const tspan = document.createElementNS(SVG_NS, 'tspan');
        tspan.setAttribute('x', cx);
        tspan.setAttribute('dy', i === 0 ? '-0.15em' : '1.15em');
        tspan.textContent = line;
        text.appendChild(tspan);
      });
      // Centrar el bloque de 2 líneas verticalmente respecto a cy
      text.setAttribute('y', cy);
    }
    g.appendChild(text);

    if(!isReserved){
      // Mesa libre: seleccionable, llena el campo del formulario.
      function selectTable(){
        if(selectedTable) selectedTable.classList.remove('selected');
        g.classList.add('selected');
        selectedTable = g;
        mesaInput.value = 'Mesa ' + key;
      }
      g.addEventListener('click', selectTable);
      g.addEventListener('keydown', (ev)=>{
        if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); selectTable(); }
      });
    } else {
      // Mesa reservada: no se puede elegir, solo muestra quién la reservó.
      g.addEventListener('click', ()=> mostrarInfoMesa_(infoTexto));
      g.addEventListener('keydown', (ev)=>{
        if(ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); mostrarInfoMesa_(infoTexto); }
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