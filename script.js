(function(){
  "use strict";

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

  // Autoplay queda explícitamente desactivado: el audio solo suena si el usuario toca el botón.
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

  /* =========================================================
     2. MODAL COLLAGE - Muro de Recuerdos (Promo 2000)
     ========================================================= */
  const mosaicMain = document.getElementById('mosaicMain');
  const collageModal = document.getElementById('collageModal');
  const collageClose = document.getElementById('collageClose');
  let lastFocusedEl = null;

  function openCollageModal(){
    lastFocusedEl = document.activeElement;
    collageModal.hidden = false;
    document.body.style.overflow = 'hidden';
    collageClose.focus();
  }
  function closeCollageModal(){
    collageModal.hidden = true;
    document.body.style.overflow = '';
    if(lastFocusedEl) lastFocusedEl.focus();
  }

  mosaicMain.addEventListener('click', openCollageModal);
  collageClose.addEventListener('click', closeCollageModal);

  // cerrar al hacer click fuera del panel (en el overlay)
  collageModal.addEventListener('click', (e)=>{
    if(e.target === collageModal) closeCollageModal();
  });
  // cerrar con tecla Escape
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape' && !collageModal.hidden) closeCollageModal();
  });

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
  });

  /* =========================================================
     3. CROQUIS DE 47 MESAS - salón La Riviera
     ========================================================= */

  // Mesas reservadas según el croquis oficial: número -> promo asignada
  const reservedMap = {
    6:  'P94',
    8:  'P87',
    17: 'P87',
    9:  'P91',
    10: 'P99',
    12: 'P99',
    13: 'P99',
    11: 'P76',
    14: 'P97',
    23: 'P97',
    24: 'P00',
    25: 'P00',
    26: 'P00',
    27: 'P00'
  };

  // Posiciones (x,y) de las 47 mesas dentro del viewBox 0 0 480 460,
  // distribuidas alrededor de la pista de baile y el escenario, igual que el croquis oficial.
  const tablePositions = {
    // fila superior junto a Área Verde
    28:[97,80], 29:[131,80], 30:[183,80], 31:[217,80], 32:[282,80], 33:[316,80],
    // fila reservada junto a Baño Varones (Promo 2000)
    27:[129,132], 26:[163,132], 25:[197,132], 24:[231,132],
    // columna izquierda junto a la pista (14 arriba -> 6 abajo)
    14:[261,176], 13:[261,199], 12:[261,222], 11:[261,245], 10:[261,268], 9:[261,291], 8:[261,314], 7:[261,337], 6:[261,360],
    // columna derecha junto a la pista (23 arriba -> 15 abajo)
    23:[309,176], 22:[309,199], 21:[309,222], 20:[309,245], 19:[309,268], 18:[309,291], 17:[309,314], 16:[309,337], 15:[309,360],
    // bloque circular junto a la cocina, dos columnas
    34:[390,130], 35:[390,165], 36:[390,200], 37:[390,235], 38:[390,270], 39:[390,305], 40:[390,340],
    41:[440,130], 42:[440,165], 43:[440,200], 44:[440,235], 45:[440,270], 46:[440,305], 47:[440,340],
    // fila inferior junto a Baño Mujeres / entrada
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
    g.setAttribute('aria-label', isReserved
      ? ('Mesa ' + num + ', reservada por ' + reservedMap[num])
      : ('Mesa ' + num + ', libre'));

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
     COMPROBANTE DE PAGO (QR)
     ========================================================= */
  const btnComprobante = document.getElementById('btnSubirComprobante');
  const inputComprobante = document.getElementById('inputComprobante');
  const previewComprobante = document.getElementById('previewComprobante');
  const previewComprobanteImg = document.getElementById('previewComprobanteImg');
  const previewComprobanteName = document.getElementById('previewComprobanteName');

  btnComprobante.addEventListener('click', ()=> inputComprobante.click());
  inputComprobante.addEventListener('change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    previewComprobanteImg.src = url;
    previewComprobanteName.textContent = file.name;
    previewComprobante.classList.add('show');
  });

  /* =========================================================
     FORMULARIO DE RESERVA
     ========================================================= */
  const reservaForm = document.getElementById('reservaForm');
  const confirmMsg = document.getElementById('confirmMsg');

  reservaForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    if(!mesaInput.value){
      mesaInput.focus();
      mesaInput.placeholder = 'Selecciona una mesa libre en el croquis';
      return;
    }
    confirmMsg.classList.add('show');
    confirmMsg.scrollIntoView({behavior:'smooth', block:'center'});
  });

  /* =========================================================
     SLAM DEL SAN RAFAEL (firmas dinámicas)
     ========================================================= */
  const slamForm = document.getElementById('slamForm');
  const signaturesList = document.getElementById('signaturesList');
  const fontClasses = ['font-a','font-b','font-c'];

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

})();
