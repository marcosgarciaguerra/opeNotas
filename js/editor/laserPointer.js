// js/editor/laserPointer.js - Puntero Láser temporal con efecto neón y desvanecimiento continuo
export class LaserPointer {
  constructor(canvasWrapper, mainCanvas) {
    this.wrapper = canvasWrapper;
    this.mainCanvas = mainCanvas;
    this.active = false;
    this.isPointerDown = false;

    this.points = []; // Array de { x, y, time, pressure }
    this.FADE_DURATION_MS = 1000; // Desvanecimiento en ~1 segundo
    this.animFrameId = null;

    this.laserColor = '#ef4444'; // Rojo láser
    this.laserGlow = '#ff0055';
    this.laserCore = '#ffffff';

    this.currentPointerPos = null;

    this.createCanvas();
    this.bindEvents();
  }

  createCanvas() {
    if (!this.wrapper) return;
    let existing = this.wrapper.querySelector('#laserCanvas');
    if (!existing) {
      this.laserCanvas = document.createElement('canvas');
      this.laserCanvas.id = 'laserCanvas';
      this.laserCanvas.className = 'laser-canvas-overlay';
      this.wrapper.appendChild(this.laserCanvas);
    } else {
      this.laserCanvas = existing;
    }

    this.ctx = this.laserCanvas.getContext('2d');
    this.syncDimensions();
  }

  syncDimensions() {
    if (!this.laserCanvas || !this.mainCanvas) return;
    if (this.laserCanvas.width !== this.mainCanvas.width || this.laserCanvas.height !== this.mainCanvas.height) {
      this.laserCanvas.width = this.mainCanvas.width;
      this.laserCanvas.height = this.mainCanvas.height;
    }
  }

  setHost(mainCanvas, hostWrapper) {
    if (this.mainCanvas && this._onPointerDown) {
      this.mainCanvas.removeEventListener('pointerdown', this._onPointerDown);
    }
    this.mainCanvas = mainCanvas;
    this.wrapper = hostWrapper;

    if (!this.laserCanvas) {
      this.createCanvas();
    } else if (hostWrapper && this.laserCanvas.parentNode !== hostWrapper) {
      if (this.laserCanvas.parentNode) {
        this.laserCanvas.parentNode.removeChild(this.laserCanvas);
      }
      hostWrapper.appendChild(this.laserCanvas);
    }

    if (this.laserCanvas) {
      this.ctx = this.laserCanvas.getContext('2d');
      this.syncDimensions();
    }

    if (this.mainCanvas && this._onPointerDown) {
      this.mainCanvas.addEventListener('pointerdown', this._onPointerDown);
    }
  }

  setColor(color) {
    this.laserColor = color;
    if (color === '#ef4444') {
      this.laserGlow = '#ff0055';
    } else if (color === '#10b981') {
      this.laserGlow = '#00ff88';
    } else if (color === '#3b82f6') {
      this.laserGlow = '#0088ff';
    } else if (color === '#f59e0b') {
      this.laserGlow = '#ffaa00';
    } else if (color === '#8b5cf6') {
      this.laserGlow = '#c084fc';
    } else if (color === '#ec4899') {
      this.laserGlow = '#f472b6';
    } else {
      this.laserGlow = color;
    }
  }

  setActive(active) {
    this.active = Boolean(active);
    if (this.active) {
      if (this.wrapper && this.laserCanvas && this.laserCanvas.parentNode !== this.wrapper) {
        this.wrapper.appendChild(this.laserCanvas);
      }
      this.syncDimensions();
    } else {
      this.isPointerDown = false;
      this.currentPointerPos = null;
      this.points = [];
      this.clearCanvas();
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }
  }

  bindEvents() {
    this._onPointerDown = (e) => {
      if (!this.active) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.isPointerDown = true;
      if (this.mainCanvas && e.pointerId) {
        try { this.mainCanvas.setPointerCapture(e.pointerId); } catch (_) {}
      }
      const pt = this.getCoordinates(e);
      this.currentPointerPos = pt;
      this.addPoint(pt.x, pt.y, pt.pressure);
      this.startAnimationLoop();
    };

    this._onPointerMove = (e) => {
      if (!this.active || !this.mainCanvas) return;
      const rect = this.mainCanvas.getBoundingClientRect();
      const inBounds = e.clientX >= rect.left && e.clientX <= rect.right &&
                       e.clientY >= rect.top && e.clientY <= rect.bottom;
      
      const pt = this.getCoordinates(e);

      if (inBounds || this.isPointerDown) {
        this.currentPointerPos = pt;
        if (this.isPointerDown) {
          this.addPoint(pt.x, pt.y, pt.pressure);
        }
        this.startAnimationLoop();
      } else {
        this.currentPointerPos = null;
      }
    };

    this._onPointerUp = (e) => {
      if (!this.active) return;
      this.isPointerDown = false;
      if (this.mainCanvas && e && e.pointerId) {
        try { this.mainCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    };

    if (this.mainCanvas) {
      this.mainCanvas.addEventListener('pointerdown', this._onPointerDown);
    }
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
  }

  getCoordinates(e) {
    if (!this.mainCanvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = this.mainCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0, pressure: 0.5 };
    const scaleX = this.mainCanvas.width / rect.width;
    const scaleY = this.mainCanvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure > 0 ? e.pressure : 0.5
    };
  }

  addPoint(x, y, pressure) {
    this.points.push({
      x,
      y,
      pressure: pressure || 0.5,
      time: performance.now()
    });
  }

  startAnimationLoop() {
    if (!this.animFrameId) {
      this.animFrameId = requestAnimationFrame(() => this.renderFrame());
    }
  }

  clearCanvas() {
    if (this.ctx && this.laserCanvas) {
      this.ctx.clearRect(0, 0, this.laserCanvas.width, this.laserCanvas.height);
    }
  }

  renderFrame() {
    this.animFrameId = null;
    if (!this.active || !this.ctx) {
      this.clearCanvas();
      return;
    }

    const now = performance.now();
    this.syncDimensions();
    this.clearCanvas();

    // 1. Filtrar puntos activos que no hayan caducado (> 1000ms)
    this.points = this.points.filter(p => (now - p.time) < this.FADE_DURATION_MS);

    // 2. Renderizar segmentos de estela láser
    if (this.points.length > 1) {
      for (let i = 1; i < this.points.length; i++) {
        const p0 = this.points[i - 1];
        const p1 = this.points[i];
        const age = now - p1.time;
        const progress = Math.max(0, Math.min(1, age / this.FADE_DURATION_MS));
        const alpha = 1 - progress;

        if (alpha <= 0.01) continue;

        const baseWidth = 6 * (0.8 + (p1.pressure || 0.5) * 0.4);

        // Capa externa brillante (Glow)
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(p0.x, p0.y);
        this.ctx.lineTo(p1.x, p1.y);
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.globalAlpha = alpha * 0.7;
        this.ctx.strokeStyle = this.laserColor;
        this.ctx.lineWidth = baseWidth * 2.2;
        this.ctx.shadowColor = this.laserGlow;
        this.ctx.shadowBlur = 16 * alpha;
        this.ctx.stroke();

        // Capa media intensa
        this.ctx.globalAlpha = alpha * 0.9;
        this.ctx.strokeStyle = this.laserGlow;
        this.ctx.lineWidth = baseWidth * 1.3;
        this.ctx.stroke();

        // Núcleo blanco brillante central
        this.ctx.globalAlpha = alpha;
        this.ctx.strokeStyle = this.laserCore;
        this.ctx.lineWidth = Math.max(2, baseWidth * 0.5);
        this.ctx.shadowBlur = 4;
        this.ctx.shadowColor = '#ffffff';
        this.ctx.stroke();

        this.ctx.restore();
      }
    }

    // 3. Renderizar el punto puntero láser principal si el puntero está sobre el lienzo
    if (this.currentPointerPos && this.active) {
      const { x, y } = this.currentPointerPos;
      this.ctx.save();
      
      // Halo exterior
      this.ctx.beginPath();
      this.ctx.arc(x, y, 9, 0, Math.PI * 2);
      this.ctx.fillStyle = this.laserColor;
      this.ctx.globalAlpha = 0.4;
      this.ctx.shadowColor = this.laserColor;
      this.ctx.shadowBlur = 18;
      this.ctx.fill();

      // Disco intermedio
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, Math.PI * 2);
      this.ctx.fillStyle = this.laserColor;
      this.ctx.globalAlpha = 0.9;
      this.ctx.shadowColor = this.laserGlow;
      this.ctx.shadowBlur = 10;
      this.ctx.fill();

      // Punto central blanco
      this.ctx.beginPath();
      this.ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.globalAlpha = 1.0;
      this.ctx.fill();

      this.ctx.restore();
    }

    // Si aún hay puntos o el usuario está dibujando o el láser está activo, continuar el loop
    if (this.points.length > 0 || this.isPointerDown || (this.active && this.currentPointerPos)) {
      this.animFrameId = requestAnimationFrame(() => this.renderFrame());
    }
  }

  destroy() {
    this.setActive(false);
    if (this.laserCanvas && this.laserCanvas.parentNode) {
      this.laserCanvas.parentNode.removeChild(this.laserCanvas);
    }
  }
}
