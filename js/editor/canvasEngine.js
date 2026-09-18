// js/editor/canvasEngine.js - Motor de lienzo vectorial multicapa con soporte de figuras, texto, imágenes y patrones
import { CoverDesigner } from './coverDesigner.js';

export class CanvasEngine {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');

    this.format = options.format || 'a4'; // 'a4' o 'board'
    this.backgroundPattern = this.format === 'a4' ? 'ruled' : 'dots'; // 'blank' | 'ruled' | 'grid' | 'dots'
    this.paperColor = options.paperColor || '#ffffff';

    // Colecciones de elementos por capa
    this.strokes = [];
    this.shapes = [];
    this.texts = [];
    this.images = [];

    this.undoStack = [];
    this.redoStack = [];

    // Estado del puntero y herramienta activa
    this.tool = 'pen'; // 'pen' | 'pencil' | 'marker' | 'brush' | 'highlighter' | 'eraser' | 'lasso' | 'hand' | 'shape' | 'text' | 'image'
    this.strokeColor = '#1e293b';
    this.strokeWidth = 3;
    this.strokeOpacity = 1;
    this.strokeStabilization = 0.5; // Estabilidad / Suavizado de 0 (directo) a 1 (máxima suavidad)
    this.strokeConcentration = 1.0; // Concentración / Densidad de tinta de 0.1 a 1.0 (100% sólido)
    this._stabilizedPoint = null;

    // Configuración de borrador
    this.eraserMode = 'stroke'; // 'stroke' (trazo completo) | 'area' (circular)
    this.eraseHighlighterOnly = false;
    this.eraserRadius = 16;

    // Estado de trazo activo
    this.isDrawing = false;
    this.currentStroke = null;
    this.lastPointerX = 0;
    this.lastPointerY = 0;

    // Hold-to-Straighten
    this.holdTimer = null;
    this.HOLD_DELAY_MS = 450;
    this.holdStartPoint = null;

    // Palm Rejection & Input Mode (Modo stylus con rechazo de palma por defecto)
    this.inputMode = options.inputMode || 'stylus-first'; // 'stylus-first' | 'finger-drawing'

    // Callbacks
    this.onStrokeEnd = options.onStrokeEnd || null;

    this._pointerDownHandler = null;
    this._pointerMoveHandler = null;
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    this.attachCanvas(this.canvas);
    this.initDimensions();
  }

  attachCanvas(canvasElement, pageData = null) {
    if (this.canvas && this._pointerDownHandler) {
      this.canvas.removeEventListener('pointerdown', this._pointerDownHandler);
      this.canvas.removeEventListener('pointermove', this._pointerMoveHandler);
    }

    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');

    this._pointerDownHandler = (e) => this.onPointerDown(e);
    this._pointerMoveHandler = (e) => this.onPointerMove(e);
    this.canvas.addEventListener('pointerdown', this._pointerDownHandler);
    this.canvas.addEventListener('pointermove', this._pointerMoveHandler);

    if (pageData) {
      this.loadPage(pageData);
    } else {
      this.render();
    }
  }

  initDimensions() {
    const FORMATS = {
      a4: { width: 794, height: 1123 },
      board: { width: 1800, height: 1200 }
    };
    const { width, height } = FORMATS[this.format] || FORMATS.a4;
    this.canvas.width = width;
    this.canvas.height = height;
    this.render();
  }

  setFormat(formatKey) {
    this.format = formatKey;
    if (this.format === 'a4' && this.backgroundPattern === 'dots') {
      this.backgroundPattern = 'ruled';
    } else if (this.format === 'board' && this.backgroundPattern === 'ruled') {
      this.backgroundPattern = 'dots';
    }
    this.initDimensions();
  }

  setBackgroundPattern(pattern) {
    this.backgroundPattern = pattern;
    this.render();
    if (this.onStrokeEnd) this.onStrokeEnd();
  }

  setPaperColor(color) {
    this.paperColor = color;
    this.render();
    if (this.onStrokeEnd) this.onStrokeEnd();
  }

  setTool(tool) {
    this.tool = tool;
  }

  setColor(color) {
    this.strokeColor = color;
  }

  setWidth(width) {
    this.strokeWidth = Math.max(1, Number(width) || 1);
  }

  setStabilization(stabilization) {
    this.strokeStabilization = Math.max(0, Math.min(1, Number(stabilization) || 0));
  }

  setConcentration(concentration) {
    this.strokeConcentration = Math.max(0.1, Math.min(1, Number(concentration) || 0.1));
  }

  setOpacity(opacity) {
    this.strokeOpacity = Number(opacity);
  }

  setEraserMode(mode) {
    this.eraserMode = mode;
  }

  setEraseHighlighterOnly(val) {
    this.eraseHighlighterOnly = Boolean(val);
  }

  setInputMode(mode) {
    this.inputMode = mode; // 'stylus-first' | 'finger-drawing'
  }

  loadPage(page) {
    if (!page) return;
    this.isCover = Boolean(page.isCover || page.template);
    this.coverData = this.isCover ? (page.coverData || page) : null;
    this.backgroundPattern = page.backgroundPattern || (this.format === 'a4' ? 'ruled' : 'dots');
    this.paperColor = page.paperColor || '#ffffff';
    this.strokes = JSON.parse(JSON.stringify(page.strokes || []));
    this.shapes = JSON.parse(JSON.stringify(page.shapes || []));
    this.texts = JSON.parse(JSON.stringify(page.texts || []));
    this.images = JSON.parse(JSON.stringify(page.images || []));

    // Precargar elementos Image nativos para renderizado fluido
    for (const imgItem of this.images) {
      if (!imgItem._element && imgItem.dataUrl) {
        const img = new Image();
        img.src = imgItem.dataUrl;
        img.onload = () => this.render();
        imgItem._element = img;
      }
    }

    this.undoStack = [];
    this.redoStack = [];
    this.render();
  }

  getPageData() {
    // Sanitizar elementos de imagen para serialización limpia
    const cleanImages = this.images.map(img => ({
      id: img.id,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      dataUrl: img.dataUrl,
      rotation: img.rotation || 0
    }));

    const data = {
      backgroundPattern: this.backgroundPattern,
      paperColor: this.paperColor || '#ffffff',
      strokes: this.strokes,
      shapes: this.shapes,
      texts: this.texts,
      images: cleanImages
    };

    if (this.isCover && this.coverData) {
      data.isCover = true;
      data.template = this.coverData.template;
      data.title = this.coverData.title;
      data.subtitle = this.coverData.subtitle;
      data.date = this.coverData.date;
      data.color = this.coverData.color;
      data.customImage = this.coverData.customImage;
    }

    return data;
  }

  loadStrokes(strokes) {
    this.loadPage({ strokes: strokes, shapes: [], texts: [], images: [] });
  }

  getStrokes() {
    return this.strokes;
  }

  // Conversión precisa de coordenadas de puntero al espacio del canvas
  getCanvasCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure > 0 ? e.pressure : 0.5
    };
  }

  onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Rechazo de palma activo: Si está en modo Stylus y el evento es un toque táctil, ignorar para dibujo
    if (this.inputMode === 'stylus-first' && e.pointerType === 'touch') {
      return;
    }

    // Si la herramienta activa es navegación o externa, delegar
    if (this.tool === 'lasso' || this.tool === 'hand' || this.tool === 'shape' || this.tool === 'text' || this.tool === 'image') {
      return;
    }

    this.canvas.setPointerCapture(e.pointerId);

    const pt = this.getCanvasCoordinates(e);
    this.isDrawing = true;
    this.lastPointerX = pt.x;
    this.lastPointerY = pt.y;

    if (this.tool === 'eraser') {
      this.handleEraser(pt);
      return;
    }

    // Inicializar nuevo trazo vectorial
    const isHighlighter = this.tool === 'highlighter';
    const isPencil = this.tool === 'pencil';
    const isBrush = this.tool === 'brush';
    const isMarker = this.tool === 'marker';
    
    // Modulación de grosor por presión si procede
    let initialWidth = this.strokeWidth;
    if (isHighlighter) {
      initialWidth = Math.max(16, this.strokeWidth * 3.2);
    } else if (isPencil) {
      initialWidth = Math.max(1.5, this.strokeWidth * (0.6 + pt.pressure * 0.7));
    } else if (isBrush) {
      initialWidth = Math.max(1.5, this.strokeWidth * (0.4 + pt.pressure * 1.2));
    } else {
      initialWidth = Math.max(1, this.strokeWidth * (0.7 + pt.pressure * 0.6));
    }

    this._stabilizedPoint = { x: pt.x, y: pt.y, pressure: pt.pressure };

    this.currentStroke = {
      id: 'stroke_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      tool: this.tool,
      color: this.strokeColor,
      width: initialWidth,
      baseWidth: this.strokeWidth,
      opacity: isHighlighter ? 0.45 : (isPencil ? 0.85 : this.strokeOpacity),
      concentration: this.strokeConcentration !== undefined ? this.strokeConcentration : 1.0,
      stabilization: this.strokeStabilization !== undefined ? this.strokeStabilization : 0.5,
      isHighlighter: isHighlighter,
      isStraight: false,
      points: [{ ...pt }],
      roughBox: { minX: pt.x, minY: pt.y, maxX: pt.x, maxY: pt.y }
    };

    this.startHoldToStraightenTimer(pt);
    this.render();
  }

  onPointerMove(e) {
    if (!this.isDrawing) return;
    const pt = this.getCanvasCoordinates(e);

    if (this.tool === 'eraser') {
      this.handleEraser(pt);
      return;
    }

    if (!this.currentStroke) return;

    // Filtro de Estabilización en tiempo real (Streamline smoothing)
    let targetPt;
    const stab = this.strokeStabilization !== undefined ? this.strokeStabilization : 0.5;
    if (stab > 0.02 && this._stabilizedPoint) {
      const alpha = Math.max(0.10, 1 - (stab * 0.84));
      const smoothX = this._stabilizedPoint.x + (pt.x - this._stabilizedPoint.x) * alpha;
      const smoothY = this._stabilizedPoint.y + (pt.y - this._stabilizedPoint.y) * alpha;
      const smoothPressure = this._stabilizedPoint.pressure + (pt.pressure - this._stabilizedPoint.pressure) * alpha;
      this._stabilizedPoint = { x: smoothX, y: smoothY, pressure: smoothPressure };
      targetPt = { x: smoothX, y: smoothY, pressure: smoothPressure };
    } else {
      this._stabilizedPoint = { x: pt.x, y: pt.y, pressure: pt.pressure };
      targetPt = pt;
    }

    this.currentStroke.points.push(targetPt);
    const rb = this.currentStroke.roughBox;
    rb.minX = Math.min(rb.minX, targetPt.x);
    rb.minY = Math.min(rb.minY, targetPt.y);
    rb.maxX = Math.max(rb.maxX, targetPt.x);
    rb.maxY = Math.max(rb.maxY, targetPt.y);

    const distFromLast = Math.hypot(pt.x - this.lastPointerX, pt.y - this.lastPointerY);
    if (distFromLast > 4) {
      this.startHoldToStraightenTimer(pt);
    }

    this.lastPointerX = pt.x;
    this.lastPointerY = pt.y;
    this.render();
  }

  onPointerUp(e) {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    this.clearHoldTimer();

    if (this.currentStroke) {
      if (this.currentStroke.points.length > 0) {
        if (this.strokeStabilization > 0.05 && this.lastPointerX && this.lastPointerY) {
          const lastPt = this.currentStroke.points[this.currentStroke.points.length - 1];
          const dist = Math.hypot(this.lastPointerX - lastPt.x, this.lastPointerY - lastPt.y);
          if (dist > 2) {
            this.currentStroke.points.push({
              x: this.lastPointerX,
              y: this.lastPointerY,
              pressure: lastPt.pressure || 0.5
            });
          }
        }
        this.pushAction({
          type: 'add_stroke',
          stroke: this.currentStroke
        });
        this.strokes.push(this.currentStroke);
      }
      this.currentStroke = null;
      this._stabilizedPoint = null;
      this.render();
      if (this.onStrokeEnd) this.onStrokeEnd();
    }
  }

  startHoldToStraightenTimer(point) {
    this.clearHoldTimer();
    this.holdStartPoint = point;

    this.holdTimer = setTimeout(() => {
      if (this.isDrawing && this.currentStroke && this.currentStroke.points.length >= 2) {
        const pStart = this.currentStroke.points[0];
        const pEnd = this.currentStroke.points[this.currentStroke.points.length - 1];
        
        this.currentStroke.isStraight = true;
        this.currentStroke.points = [pStart, pEnd];
        this.render();
      }
    }, this.HOLD_DELAY_MS);
  }

  clearHoldTimer() {
    if (this.holdTimer) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  handleEraser(pt) {
    this.eraseStrokesIntersecting(pt, this.eraserRadius);
  }

  eraseStrokesIntersecting(point, radius) {
    const remainingStrokes = [];
    const deletedStrokes = [];

    for (let i = 0; i < this.strokes.length; i++) {
      const stroke = this.strokes[i];

      if (this.eraseHighlighterOnly && !stroke.isHighlighter) {
        remainingStrokes.push(stroke);
        continue;
      }

      const rb = stroke.roughBox;
      const margin = stroke.width / 2 + radius;
      if (
        point.x < rb.minX - margin ||
        point.x > rb.maxX + margin ||
        point.y < rb.minY - margin ||
        point.y > rb.maxY + margin
      ) {
        remainingStrokes.push(stroke);
        continue;
      }

      let intersects = false;
      const pts = stroke.points;
      for (let j = 0; j < pts.length - 1; j++) {
        const dSq = this.distToSegmentSquared(point, pts[j], pts[j + 1]);
        if (dSq <= margin * margin) {
          intersects = true;
          break;
        }
      }

      if (intersects) {
        deletedStrokes.push({ stroke, index: i });
      } else {
        remainingStrokes.push(stroke);
      }
    }

    if (deletedStrokes.length > 0) {
      this.pushAction({
        type: 'delete_multiple_strokes',
        strokes: deletedStrokes
      });
      this.strokes = remainingStrokes;
      this.render();
      if (this.onStrokeEnd) this.onStrokeEnd();
    }
  }

  distToSegmentSquared(p, v, w) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return (p.x - v.x) ** 2 + (p.y - v.y) ** 2;
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2;
  }

  // --- Adición y Manipulación de Figuras, Texto e Imágenes ---

  addShape(shape) {
    shape.id = shape.id || 'shape_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    this.shapes.push(shape);
    this.pushAction({ type: 'add_shape', shape });
    this.render();
    if (this.onStrokeEnd) this.onStrokeEnd();
    return shape;
  }

  addText(textObj) {
    textObj.id = textObj.id || 'text_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    this.texts.push(textObj);
    this.pushAction({ type: 'add_text', text: textObj });
    this.render();
    if (this.onStrokeEnd) this.onStrokeEnd();
    return textObj;
  }

  addImage(imageObj) {
    imageObj.id = imageObj.id || 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    
    if (!imageObj._element && imageObj.dataUrl) {
      const img = new Image();
      img.src = imageObj.dataUrl;
      img.onload = () => this.render();
      imageObj._element = img;
    }

    this.images.push(imageObj);
    this.pushAction({ type: 'add_image', image: imageObj });
    this.render();
    if (this.onStrokeEnd) this.onStrokeEnd();
    return imageObj;
  }

  // --- Deshacer / Rehacer ---
  pushAction(action) {
    this.undoStack.push(action);
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return false;
    const action = this.undoStack.pop();

    if (action.type === 'add_stroke') {
      const idx = this.strokes.findIndex(s => s.id === action.stroke.id);
      if (idx !== -1) this.strokes.splice(idx, 1);
      this.redoStack.push(action);
    } else if (action.type === 'delete_multiple_strokes') {
      for (const item of action.strokes) {
        this.strokes.splice(item.index, 0, item.stroke);
      }
      this.redoStack.push(action);
    } else if (action.type === 'add_shape') {
      const idx = this.shapes.findIndex(sh => sh.id === action.shape.id);
      if (idx !== -1) this.shapes.splice(idx, 1);
      this.redoStack.push(action);
    } else if (action.type === 'add_text') {
      const idx = this.texts.findIndex(t => t.id === action.text.id);
      if (idx !== -1) this.texts.splice(idx, 1);
      this.redoStack.push(action);
    } else if (action.type === 'add_image') {
      const idx = this.images.findIndex(im => im.id === action.image.id);
      if (idx !== -1) this.images.splice(idx, 1);
      this.redoStack.push(action);
    }

    this.render();
    if (this.onStrokeEnd) this.onStrokeEnd();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const action = this.redoStack.pop();

    if (action.type === 'add_stroke') {
      this.strokes.push(action.stroke);
      this.undoStack.push(action);
    } else if (action.type === 'delete_multiple_strokes') {
      const idsToDelete = new Set(action.strokes.map(s => s.stroke.id));
      this.strokes = this.strokes.filter(s => !idsToDelete.has(s.id));
      this.undoStack.push(action);
    } else if (action.type === 'add_shape') {
      this.shapes.push(action.shape);
      this.undoStack.push(action);
    } else if (action.type === 'add_text') {
      this.texts.push(action.text);
      this.undoStack.push(action);
    } else if (action.type === 'add_image') {
      this.images.push(action.image);
      this.undoStack.push(action);
    }

    this.render();
    if (this.onStrokeEnd) this.onStrokeEnd();
    return true;
  }

  clearAll() {
    if (this.strokes.length === 0 && this.shapes.length === 0 && this.texts.length === 0 && this.images.length === 0) return;
    this.strokes = [];
    this.shapes = [];
    this.texts = [];
    this.images = [];
    this.render();
    if (this.onStrokeEnd) this.onStrokeEnd();
  }

  // --- Renderizado Multicapa ---
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Capa 0: Fondo de Hoja (Blanco, Rayado, Cuadrícula 5mm, Puntos)
    this.renderBackground(ctx);

    // 2. Capa 1: Imágenes incrustadas
    this.renderImages(ctx);

    // 3. Capa 2: Subrayadores (con modo de fusión multiply, por debajo de la tinta)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (const stroke of this.strokes) {
      if (stroke.isHighlighter) {
        this.drawStroke(ctx, stroke);
      }
    }
    if (this.currentStroke && this.currentStroke.isHighlighter) {
      this.drawStroke(ctx, this.currentStroke);
    }
    ctx.restore();

    // 4. Capa 3: Figuras Geométricas y Tinta (Lápiz, Rotulador, Pincel)
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Renderizar figuras
    for (const shape of this.shapes) {
      this.drawShape(ctx, shape);
    }

    // Renderizar trazos de tinta
    for (const stroke of this.strokes) {
      if (!stroke.isHighlighter) {
        this.drawStroke(ctx, stroke);
      }
    }
    if (this.currentStroke && !this.currentStroke.isHighlighter) {
      this.drawStroke(ctx, this.currentStroke);
    }
    ctx.restore();

    // 5. Capa 4: Cajas de Texto
    ctx.save();
    for (const textObj of this.texts) {
      this.drawText(ctx, textObj);
    }
    ctx.restore();
  }

  renderBackground(ctx) {
    ctx.save();
    if (this.isCover && this.coverData) {
      CoverDesigner.renderCover(ctx, this.canvas.width, this.canvas.height, this.coverData);
      ctx.restore();
      return;
    }

    const bgColor = this.paperColor || '#ffffff';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const pattern = this.backgroundPattern || (this.format === 'a4' ? 'ruled' : 'dots');
    const isDarkPaper = bgColor === '#1e293b' || bgColor === '#0f172a';

    if (pattern === 'ruled') {
      // Pauta rayada horizontal continua
      ctx.strokeStyle = isDarkPaper ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1';
      ctx.lineWidth = 1;
      const lineGap = 32;
      const topMargin = 75;

      for (let y = topMargin; y < this.canvas.height; y += lineGap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.canvas.width, y);
        ctx.stroke();
      }

      // Margen izquierdo rojo estilo cuaderno escolar
      ctx.strokeStyle = isDarkPaper ? 'rgba(248, 113, 113, 0.45)' : '#fca5a5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(68, 0);
      ctx.lineTo(68, this.canvas.height);
      ctx.stroke();

    } else if (pattern === 'grid') {
      // Cuadrícula técnica de 5 mm (~20 px) que cubre el 100% de la superficie
      ctx.strokeStyle = isDarkPaper ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0';
      ctx.lineWidth = 1;
      const gap = 20;

      for (let x = 0; x <= this.canvas.width; x += gap) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvas.height);
        ctx.stroke();
      }

      for (let y = 0; y <= this.canvas.height; y += gap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.canvas.width, y);
        ctx.stroke();
      }

    } else if (pattern === 'dots') {
      // Trama de puntos (Bullet journal / Pizarra)
      ctx.fillStyle = isDarkPaper ? 'rgba(255, 255, 255, 0.25)' : '#94a3b8';
      const gap = 24;
      for (let x = gap; x < this.canvas.width; x += gap) {
        for (let y = gap; y < this.canvas.height; y += gap) {
          ctx.beginPath();
          ctx.arc(x, y, 1.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // pattern === 'blank': liso sin marcas
    ctx.restore();
  }

  renderImages(ctx) {
    for (const imgItem of this.images) {
      if (imgItem._element && imgItem._element.complete) {
        ctx.save();
        ctx.translate(imgItem.x + imgItem.width / 2, imgItem.y + imgItem.height / 2);
        if (imgItem.rotation) ctx.rotate(imgItem.rotation);
        ctx.drawImage(imgItem._element, -imgItem.width / 2, -imgItem.height / 2, imgItem.width, imgItem.height);
        ctx.restore();
      }
    }
  }

  drawShape(ctx, shape) {
    ctx.save();
    ctx.strokeStyle = shape.strokeColor || '#1e293b';
    ctx.lineWidth = shape.strokeWidth || 2;
    ctx.fillStyle = shape.fillColor || 'transparent';

    if (shape.type === 'rectangle') {
      ctx.beginPath();
      ctx.rect(shape.x, shape.y, shape.width, shape.height);
      if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fill();
      ctx.stroke();

    } else if (shape.type === 'circle') {
      ctx.beginPath();
      const radiusX = Math.abs(shape.width) / 2;
      const radiusY = Math.abs(shape.height) / 2;
      const centerX = shape.x + shape.width / 2;
      const centerY = shape.y + shape.height / 2;
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      if (shape.fillColor && shape.fillColor !== 'transparent') ctx.fill();
      ctx.stroke();

    } else if (shape.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(shape.x, shape.y);
      ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
      ctx.stroke();

    } else if (shape.type === 'arrow') {
      const fromX = shape.x;
      const fromY = shape.y;
      const toX = shape.x + shape.width;
      const toY = shape.y + shape.height;

      const headLen = Math.min(24, Math.max(12, shape.strokeWidth * 4));
      const angle = Math.atan2(toY - fromY, toX - fromX);

      // Línea principal
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();

      // Punta de flecha
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    }

    ctx.restore();
  }

  drawText(ctx, textObj) {
    ctx.save();
    ctx.font = `${textObj.fontSize || 16}px ${textObj.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = textObj.color || '#1e293b';
    ctx.textBaseline = 'top';

    const lines = String(textObj.text || '').split('\n');
    const lineHeight = (textObj.fontSize || 16) * 1.35;

    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textObj.x, textObj.y + i * lineHeight);
    }
    ctx.restore();
  }

  drawStroke(ctx, stroke) {
    const pts = stroke.points;
    if (!pts || pts.length === 0) return;

    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    
    const concentration = stroke.concentration !== undefined ? stroke.concentration : 1.0;
    const baseOpacity = stroke.opacity !== undefined ? stroke.opacity : 1.0;
    ctx.globalAlpha = Math.max(0.05, Math.min(1.0, baseOpacity * concentration));
    
    ctx.lineCap = stroke.isHighlighter ? 'square' : 'round';
    ctx.lineJoin = 'round';

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.color;
      ctx.fill();
      ctx.restore();
      return;
    }

    if (stroke.isStraight || pts.length === 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Curvas Bézier continuas suavizadas
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }

    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
    ctx.restore();
  }

  // Cálculo del Bounding Box exacto para exportación recortada en Pizarras
  getBoundingBox() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasContent = false;

    // 1. Trazos
    for (const stroke of this.strokes) {
      if (stroke.roughBox) {
        hasContent = true;
        minX = Math.min(minX, stroke.roughBox.minX - stroke.width);
        minY = Math.min(minY, stroke.roughBox.minY - stroke.width);
        maxX = Math.max(maxX, stroke.roughBox.maxX + stroke.width);
        maxY = Math.max(maxY, stroke.roughBox.maxY + stroke.width);
      }
    }

    // 2. Figuras
    for (const sh of this.shapes) {
      hasContent = true;
      const x2 = sh.x + sh.width;
      const y2 = sh.y + sh.height;
      minX = Math.min(minX, Math.min(sh.x, x2));
      minY = Math.min(minY, Math.min(sh.y, y2));
      maxX = Math.max(maxX, Math.max(sh.x, x2));
      maxY = Math.max(maxY, Math.max(sh.y, y2));
    }

    // 3. Textos
    for (const tx of this.texts) {
      hasContent = true;
      minX = Math.min(minX, tx.x);
      minY = Math.min(minY, tx.y);
      maxX = Math.max(maxX, tx.x + (tx.width || 200));
      maxY = Math.max(maxY, tx.y + (tx.fontSize || 20) * 2);
    }

    // 4. Imágenes
    for (const img of this.images) {
      hasContent = true;
      minX = Math.min(minX, img.x);
      minY = Math.min(minY, img.y);
      maxX = Math.max(maxX, img.x + img.width);
      maxY = Math.max(maxY, img.y + img.height);
    }

    if (!hasContent) {
      return { minX: 0, minY: 0, maxX: this.canvas.width, maxY: this.canvas.height, width: this.canvas.width, height: this.canvas.height };
    }

    // Margen de cortesía de 40 px
    const padding = 40;
    const cropMinX = Math.max(0, Math.floor(minX - padding));
    const cropMinY = Math.max(0, Math.floor(minY - padding));
    const cropMaxX = Math.min(this.canvas.width, Math.ceil(maxX + padding));
    const cropMaxY = Math.min(this.canvas.height, Math.ceil(maxY + padding));

    return {
      minX: cropMinX,
      minY: cropMinY,
      maxX: cropMaxX,
      maxY: cropMaxY,
      width: Math.max(100, cropMaxX - cropMinX),
      height: Math.max(100, cropMaxY - cropMinY)
    };
  }

  // Miniatura visual para tarjetas y carrusel de páginas
  generateThumbnail(thumbWidth = 280, thumbHeight = 190) {
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = thumbHeight;
    const tCtx = thumbCanvas.getContext('2d');

    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, thumbWidth, thumbHeight);

    const scale = Math.min(thumbWidth / this.canvas.width, thumbHeight / this.canvas.height);
    const offsetX = (thumbWidth - this.canvas.width * scale) / 2;
    const offsetY = (thumbHeight - this.canvas.height * scale) / 2;

    tCtx.save();
    tCtx.translate(offsetX, offsetY);
    tCtx.scale(scale, scale);

    this.renderBackground(tCtx);
    this.renderImages(tCtx);

    tCtx.globalCompositeOperation = 'multiply';
    for (const stroke of this.strokes) {
      if (stroke.isHighlighter) this.drawStroke(tCtx, stroke);
    }

    tCtx.globalCompositeOperation = 'source-over';
    for (const shape of this.shapes) this.drawShape(tCtx, shape);
    for (const stroke of this.strokes) {
      if (!stroke.isHighlighter) this.drawStroke(tCtx, stroke);
    }
    for (const text of this.texts) this.drawText(tCtx, text);

    tCtx.restore();
    return thumbCanvas.toDataURL('image/jpeg', 0.85);
  }

  // Renderizar los datos de una página específica en cualquier elemento canvas
  renderPageToCanvas(canvasEl, pageData) {
    if (!canvasEl || !pageData) return;
    const ctx = canvasEl.getContext('2d');
    ctx.save();

    // 1. Fondo (Portada o Patrón de Hoja)
    if (pageData.isCover || pageData.template) {
      CoverDesigner.renderCover(ctx, canvasEl.width, canvasEl.height, pageData.coverData || pageData);
    } else {
      const bgColor = pageData.paperColor || '#ffffff';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

      const pattern = pageData.backgroundPattern || (this.format === 'a4' ? 'ruled' : 'dots');
      const isDarkPaper = bgColor === '#1e293b' || bgColor === '#0f172a';

      if (pattern === 'ruled') {
        ctx.strokeStyle = isDarkPaper ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1';
        ctx.lineWidth = 1;
        const lineGap = 32;
        const topMargin = 75;
        for (let y = topMargin; y < canvasEl.height; y += lineGap) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvasEl.width, y);
          ctx.stroke();
        }
        ctx.strokeStyle = isDarkPaper ? 'rgba(248, 113, 113, 0.45)' : '#fca5a5';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(68, 0);
        ctx.lineTo(68, canvasEl.height);
        ctx.stroke();
      } else if (pattern === 'grid') {
        ctx.strokeStyle = isDarkPaper ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0';
        ctx.lineWidth = 1;
        const gap = 20;
        for (let x = 0; x <= canvasEl.width; x += gap) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvasEl.height);
          ctx.stroke();
        }
        for (let y = 0; y <= canvasEl.height; y += gap) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvasEl.width, y);
          ctx.stroke();
        }
      } else if (pattern === 'dots') {
        ctx.fillStyle = isDarkPaper ? 'rgba(255, 255, 255, 0.25)' : '#94a3b8';
        const gap = 24;
        for (let x = gap; x < canvasEl.width; x += gap) {
          for (let y = 0; y < canvasEl.height; y += gap) {
            ctx.beginPath();
            ctx.arc(x, y, 1.25, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }

    // 2. Imágenes
    for (const imgItem of (pageData.images || [])) {
      if (imgItem._element && imgItem._element.complete) {
        ctx.save();
        ctx.translate(imgItem.x + imgItem.width / 2, imgItem.y + imgItem.height / 2);
        if (imgItem.rotation) ctx.rotate(imgItem.rotation);
        ctx.drawImage(imgItem._element, -imgItem.width / 2, -imgItem.height / 2, imgItem.width, imgItem.height);
        ctx.restore();
      }
    }

    // 3. Subrayadores
    ctx.globalCompositeOperation = 'multiply';
    for (const stroke of (pageData.strokes || [])) {
      if (stroke.isHighlighter) this.drawStroke(ctx, stroke);
    }

    // 4. Figuras y Trazos normales
    ctx.globalCompositeOperation = 'source-over';
    for (const shape of (pageData.shapes || [])) {
      this.drawShape(ctx, shape);
    }
    for (const stroke of (pageData.strokes || [])) {
      if (!stroke.isHighlighter) this.drawStroke(ctx, stroke);
    }

    // 5. Textos
    for (const text of (pageData.texts || [])) {
      this.drawText(ctx, text);
    }

    ctx.restore();
  }
}
