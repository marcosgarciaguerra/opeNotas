// js/editor/shapeTool.js - Herramienta para trazar figuras geométricas interactivas
export class ShapeTool {
  constructor(canvasEngine, containerEl) {
    this.engine = canvasEngine;
    this.canvas = canvasEngine.canvas;
    this.container = containerEl;

    this.shapeType = 'rectangle'; // 'rectangle' | 'circle' | 'line' | 'arrow'
    this.strokeColor = '#1e293b';
    this.strokeWidth = 3;
    this.fillColor = 'transparent'; // 'transparent' | hex | rgba

    this.isDrawingShape = false;
    this.startX = 0;
    this.startY = 0;

    this.overlayCanvas = null;
    this.overlayCtx = null;

    this.initOverlay();
    this.bindEvents();
  }

  initOverlay() {
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.className = 'shape-overlay-canvas';
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.top = '0';
    this.overlayCanvas.style.left = '0';
    this.overlayCanvas.style.width = '100%';
    this.overlayCanvas.style.height = '100%';
    this.overlayCanvas.style.pointerEvents = 'none';
    this.overlayCanvas.style.zIndex = '8';
    this.overlayCanvas.width = this.canvas.width;
    this.overlayCanvas.height = this.canvas.height;
    this.overlayCtx = this.overlayCanvas.getContext('2d');

    this.container.appendChild(this.overlayCanvas);
  }

  syncDimensions() {
    if (this.overlayCanvas) {
      this.overlayCanvas.width = this.canvas.width;
      this.overlayCanvas.height = this.canvas.height;
    }
  }

  setHost(canvasEl, hostContainer) {
    if (this.canvas && this._pointerDownHandler) {
      this.canvas.removeEventListener('pointerdown', this._pointerDownHandler);
    }
    this.canvas = canvasEl;
    this.container = hostContainer;
    if (this.overlayCanvas) {
      hostContainer.appendChild(this.overlayCanvas);
      this.syncDimensions();
    }
    this._pointerDownHandler = (e) => {
      if (this.engine.tool !== 'shape') return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (this.engine.inputMode === 'stylus-first' && e.pointerType === 'touch') return;

      const pt = this.engine.getCanvasCoordinates(e);
      this.isDrawingShape = true;
      this.startX = pt.x;
      this.startY = pt.y;
    };
    this.canvas.addEventListener('pointerdown', this._pointerDownHandler);
  }

  setShapeType(type) {
    this.shapeType = type;
  }

  setStrokeColor(color) {
    this.strokeColor = color;
  }

  setStrokeWidth(w) {
    this.strokeWidth = Number(w);
  }

  setFillColor(color) {
    this.fillColor = color;
  }

  bindEvents() {
    this._pointerDownHandler = (e) => {
      if (this.engine.tool !== 'shape') return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (this.engine.inputMode === 'stylus-first' && e.pointerType === 'touch') return;

      const pt = this.engine.getCanvasCoordinates(e);
      this.isDrawingShape = true;
      this.startX = pt.x;
      this.startY = pt.y;
    };
    this.canvas.addEventListener('pointerdown', this._pointerDownHandler);

    window.addEventListener('pointermove', (e) => {
      if (!this.isDrawingShape || this.engine.tool !== 'shape') return;
      const pt = this.engine.getCanvasCoordinates(e);
      this.renderPreview(pt.x, pt.y);
    });

    window.addEventListener('pointerup', (e) => {
      if (!this.isDrawingShape || this.engine.tool !== 'shape') return;
      this.isDrawingShape = false;
      const pt = this.engine.getCanvasCoordinates(e);

      // Limpiar previsualización
      this.clearOverlay();

      const width = pt.x - this.startX;
      const height = pt.y - this.startY;

      // Evitar registrar figuras accidentales sin arrastre
      if (Math.hypot(width, height) < 6) return;

      let x = this.startX;
      let y = this.startY;
      let w = width;
      let h = height;

      if (this.shapeType === 'rectangle' || this.shapeType === 'circle') {
        if (w < 0) {
          x += w;
          w = Math.abs(w);
        }
        if (h < 0) {
          y += h;
          h = Math.abs(h);
        }
      }

      this.engine.addShape({
        type: this.shapeType,
        x: x,
        y: y,
        width: w,
        height: h,
        strokeColor: this.strokeColor,
        strokeWidth: this.strokeWidth,
        fillColor: this.fillColor
      });
    });
  }

  renderPreview(currentX, currentY) {
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

    let x = this.startX;
    let y = this.startY;
    let w = currentX - this.startX;
    let h = currentY - this.startY;

    const tempShape = {
      type: this.shapeType,
      x: x,
      y: y,
      width: w,
      height: h,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      fillColor: this.fillColor
    };

    if (this.shapeType === 'rectangle' || this.shapeType === 'circle') {
      if (w < 0) {
        tempShape.x += w;
        tempShape.width = Math.abs(w);
      }
      if (h < 0) {
        tempShape.y += h;
        tempShape.height = Math.abs(h);
      }
    }

    this.engine.drawShape(ctx, tempShape);
  }

  clearOverlay() {
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }
}
