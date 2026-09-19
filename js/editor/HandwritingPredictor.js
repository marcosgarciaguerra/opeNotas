// js/editor/HandwritingPredictor.js - Gestor de HTR y sugerencias predictivas flotantes

export class HandwritingPredictor {
  constructor(canvasEngine, options = {}) {
    this.engine = canvasEngine;
    this.enabled = options.enabled !== undefined ? options.enabled : true;
    this.DEBOUNCE_DELAY_MS = 700;
    this.WORD_GAP_PX = 55; // Distancia máxima para agrupar trazos en la misma palabra

    this.debounceTimer = null;
    this.worker = null;
    this.activeCluster = {
      strokes: [],
      bbox: null,
      lastTimestamp: 0
    };

    this.currentSuggestions = null;
    this.barElement = null;

    this.onStateChange = options.onStateChange || null;

    this.initWorker();
    this.createSuggestionsBar();
    this.bindEvents();
  }

  initWorker() {
    try {
      // Intentar cargar worker desde archivo
      this.worker = new Worker('js/editor/htr-worker.js');
    } catch (e) {
      // Fallback para entornos file:// o WebView sin acceso a worker externo
      try {
        const workerCode = `
          const SPANISH_DICT = ["hola","nota","notas","apuntes","tarea","examen","resumen","cuaderno","pizarra","libro","tema","clase","estudio","profesor","alumno","estudiante","dibujo","figura","esquema","mapa","texto","linea","color","pagina","ejemplo","conclusion","introduccion","indice","titulo","subtitulo","definicion","formula","teorema","practica","proyecto","entrega","fecha","duda","pregunta","respuesta","importante","atencion","revisar","pendiente","completado","objetivo","metodo","analisis","resultado","matematicas","fisica","quimica","biologia","historia","geografia","lengua","literatura","filosofia","ingles","frances","economia","derecho","arte","musica","tecnologia","informatica","programacion","calculo","algebra","geometria","estadistica","medicina","psicologia","casa","tiempo","año","dia","noche","vida","cosa","mundo","forma","manera","parte","lugar","agua","fuego","tierra","aire","sol","luna","ojo","mano","cabeza","cuerpo","ciudad","pais","pueblo","calle","camino","nombre","palabra","letra","punto","numero","semana","mes","hora","minuto","segundo","amigo","familia","trabajo","escuela","universidad","instituto","idea","verdad","hacer","tener","estar","saber","decir","poder","poner","ver","dar","ir","querer","llegar","pasar","deber","parecer","quedar","creer","hablar","llevar","dejar","seguir","encontrar","llamar","venir","pensar","salir","volver","tomar","conocer","vivir","sentir","tratar","mirar","contar","empezar","esperar","buscar","existir","entrar","trabajar","escribir","perder","producir","ocurrir","entender","pedir","recibir","recordar","terminar","permitir","aparecer","conseguir","comenzar","servir","sacar","necesitar","mantener","resultar","leer","caer","cambiar","presentar","crear","abrir"];
          self.onmessage = function(e) {
            const data = e.data;
            if (!data || data.action !== 'analyze_strokes') return;
            const { wordStrokes, bbox, strokeIds } = data;
            const width = Math.max(1, bbox.maxX - bbox.minX);
            const height = Math.max(1, bbox.maxY - bbox.minY);
            const aspectRatio = width / height;
            const estimatedLen = Math.max(2, Math.min(12, Math.round(aspectRatio * 1.5)));
            const scored = SPANISH_DICT.map(w => {
              const diff = Math.abs(w.length - estimatedLen);
              const ratioDiff = Math.abs(aspectRatio - w.length * 0.5);
              return { word: w, score: 100 - diff * 15 - ratioDiff * 10 };
            }).sort((a, b) => b.score - a.score);
            const top = scored.slice(0, 3).map(s => s.word);
            self.postMessage({
              action: 'htr_result',
              palabraDetectada: top[0] || 'nota',
              sugerencias: top,
              bbox,
              strokeIds
            });
          };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));
      } catch (blobErr) {
        console.warn('Web Worker HTR no disponible en este entorno:', blobErr);
      }
    }

    if (this.worker) {
      this.worker.onmessage = (e) => this.handleWorkerMessage(e);
    }
  }

  createSuggestionsBar() {
    let bar = document.getElementById('htrSuggestionsBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'htrSuggestionsBar';
      bar.className = 'htr-suggestions-bar hidden';
      document.body.appendChild(bar);
    }
    this.barElement = bar;
  }

  bindEvents() {
    if (this.engine.canvas) {
      this.engine.canvas.addEventListener('pointerdown', () => {
        this.hideSuggestions();
      }, { passive: true });
    }
  }

  toggleHTR(forceValue = null) {
    this.enabled = forceValue !== null ? Boolean(forceValue) : !this.enabled;
    if (!this.enabled) {
      this.hideSuggestions();
      this.clearDebounce();
      this.resetCluster();
    }
    if (this.onStateChange) {
      this.onStateChange(this.enabled);
    }
    return this.enabled;
  }

  onStrokeFinished(stroke) {
    if (!this.enabled) return;
    if (!stroke || !stroke.points || stroke.points.length < 2) return;
    if (stroke.tool !== 'pen' && stroke.tool !== 'pencil' && stroke.tool !== 'marker' && stroke.tool !== 'brush') {
      return;
    }

    const sb = stroke.roughBox || { minX: stroke.points[0].x, minY: stroke.points[0].y, maxX: stroke.points[0].x, maxY: stroke.points[0].y };

    if (!this.activeCluster.bbox) {
      // Iniciar nuevo cluster de palabra
      this.activeCluster.strokes = [stroke];
      this.activeCluster.bbox = { ...sb };
    } else {
      const cb = this.activeCluster.bbox;
      // Comprobar proximidad espacial con el cluster en curso
      const isNearbyHoriz = sb.minX <= cb.maxX + this.WORD_GAP_PX && sb.maxX >= cb.minX - this.WORD_GAP_PX;
      const isNearbyVert = sb.minY <= cb.maxY + 40 && sb.maxY >= cb.minY - 40;

      if (isNearbyHoriz && isNearbyVert) {
        this.activeCluster.strokes.push(stroke);
        cb.minX = Math.min(cb.minX, sb.minX);
        cb.minY = Math.min(cb.minY, sb.minY);
        cb.maxX = Math.max(cb.maxX, sb.maxX);
        cb.maxY = Math.max(cb.maxY, sb.maxY);
      } else {
        // Distancia espacial superada: nuevo cluster
        this.activeCluster.strokes = [stroke];
        this.activeCluster.bbox = { ...sb };
      }
    }

    this.activeCluster.lastTimestamp = Date.now();
    this.scheduleAnalysis();
  }

  scheduleAnalysis() {
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => {
      this.runAnalysis();
    }, this.DEBOUNCE_DELAY_MS);
  }

  clearDebounce() {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  resetCluster() {
    this.activeCluster = {
      strokes: [],
      bbox: null,
      lastTimestamp: 0
    };
  }

  runAnalysis() {
    if (!this.enabled || !this.worker || this.activeCluster.strokes.length === 0) return;

    const clusterStrokes = [...this.activeCluster.strokes];
    const bbox = { ...this.activeCluster.bbox };
    const strokeIds = clusterStrokes.map(s => s.id);

    // Enviar datos al worker sin bloquear el hilo principal
    this.worker.postMessage({
      action: 'analyze_strokes',
      wordStrokes: clusterStrokes.map(s => ({
        points: s.points,
        width: s.width,
        color: s.color
      })),
      bbox: bbox,
      strokeIds: strokeIds
    });
  }

  handleWorkerMessage(e) {
    const data = e.data;
    if (!data || data.action !== 'htr_result') return;
    if (!this.enabled) return;

    const { palabraDetectada, sugerencias, bbox, strokeIds } = data;
    if (!sugerencias || sugerencias.length === 0) return;

    // Verificar que los trazos aún existen en el canvas
    const currentIds = new Set(this.engine.strokes.map(s => s.id));
    const stillExist = strokeIds.some(id => currentIds.has(id));
    if (!stillExist) return;

    this.showSuggestions(sugerencias, bbox, strokeIds);
  }

  showSuggestions(sugerencias, bbox, strokeIds) {
    if (!this.barElement) return;

    const rect = this.engine.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.engine.canvas.width;
    const scaleY = rect.height / this.engine.canvas.height;

    // Posición en pantalla por encima de la palabra escrita
    const screenLeft = rect.left + (bbox.minX * scaleX);
    const screenTop = rect.top + (bbox.minY * scaleY) - 44;

    this.barElement.style.left = `${Math.max(10, screenLeft)}px`;
    this.barElement.style.top = `${Math.max(10, screenTop)}px`;

    this.barElement.innerHTML = `
      <div class="htr-suggestions-container">
        <span class="htr-badge-sparkle">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3z"/></svg>
        </span>
        ${sugerencias.map((sug, idx) => `
          <button type="button" class="htr-pill-btn ${idx === 0 ? 'htr-pill-primary' : ''}" data-word="${sug}">
            ${sug}
          </button>
        `).join('')}
        <button type="button" class="htr-close-btn" title="Cerrar sugerencias">×</button>
      </div>
    `;

    // Vincular clics en sugerencias
    const pillButtons = this.barElement.querySelectorAll('.htr-pill-btn');
    pillButtons.forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const chosenWord = btn.getAttribute('data-word');
        this.applyWordReplacement(chosenWord, bbox, strokeIds);
      });
    });

    const closeBtn = this.barElement.querySelector('.htr-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.hideSuggestions();
      });
    }

    this.barElement.classList.remove('hidden');
  }

  applyWordReplacement(chosenWord, bbox, strokeIds) {
    if (!chosenWord || !this.engine) return;

    // 1. Localizar y recopilar los trazos que se van a eliminar
    const idsSet = new Set(strokeIds);
    const deletedStrokes = [];
    const remainingStrokes = [];

    let mainColor = '#1e293b';
    for (let i = 0; i < this.engine.strokes.length; i++) {
      const s = this.engine.strokes[i];
      if (idsSet.has(s.id)) {
        deletedStrokes.push({ stroke: s, index: i });
        if (s.color) mainColor = s.color;
      } else {
        remainingStrokes.push(s);
      }
    }

    this.engine.strokes = remainingStrokes;

    // 2. Calcular tamaño tipográfico adecuado según la altura del trazo manuscrito
    const boxHeight = bbox.maxY - bbox.minY;
    const fontSize = Math.max(16, Math.min(54, Math.round(boxHeight * 0.88)));

    // 3. Crear el elemento de texto digital
    const textObj = {
      id: 'text_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      x: bbox.minX,
      y: bbox.minY,
      text: chosenWord,
      color: mainColor,
      fontSize: fontSize,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    };

    this.engine.texts.push(textObj);

    // 4. Registrar en la pila de Deshacer
    this.engine.pushAction({
      type: 'replace_strokes_with_text',
      deletedStrokes: deletedStrokes,
      text: textObj
    });

    // 5. Renderizar y resetear
    this.hideSuggestions();
    this.resetCluster();
    this.engine.render();
    if (this.engine.onStrokeEnd) this.engine.onStrokeEnd();
  }

  hideSuggestions() {
    if (this.barElement) {
      this.barElement.classList.add('hidden');
    }
  }
}

