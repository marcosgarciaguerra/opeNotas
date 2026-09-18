// js/editor/textTool.js - Herramienta para crear y editar cajas de texto sobre el lienzo
export class TextTool {
  constructor(canvasEngine, containerEl) {
    this.engine = canvasEngine;
    this.canvas = canvasEngine.canvas;
    this.container = containerEl;

    this.fontSize = 20;
    this.fontFamily = 'Arial, sans-serif';
    this.color = '#1e293b';

    this.activeInput = null;
    this.bindEvents();
  }

  setFontSize(size) {
    this.fontSize = Number(size);
  }

  setFontFamily(family) {
    this.fontFamily = family;
  }

  setColor(color) {
    this.color = color;
  }

  bindEvents() {
    this._clickHandler = (e) => {
      if (this.engine.tool !== 'text') return;
      if (this.activeInput) return; // Si ya hay uno abierto, dejar que se complete

      const pt = this.engine.getCanvasCoordinates(e);
      this.spawnInput(pt.x, pt.y);
    };
    this.canvas.addEventListener('click', this._clickHandler);
  }

  setHost(canvasEl, hostContainer) {
    if (this.canvas && this._clickHandler) {
      this.canvas.removeEventListener('click', this._clickHandler);
    }
    this.canvas = canvasEl;
    this.container = hostContainer;
    this._clickHandler = (e) => {
      if (this.engine.tool !== 'text') return;
      if (this.activeInput) return;

      const pt = this.engine.getCanvasCoordinates(e);
      this.spawnInput(pt.x, pt.y);
    };
    this.canvas.addEventListener('click', this._clickHandler);
  }

  spawnInput(canvasX, canvasY) {
    const textarea = document.createElement('textarea');
    textarea.className = 'canvas-text-editor';
    textarea.style.position = 'absolute';
    textarea.style.left = `${canvasX}px`;
    textarea.style.top = `${canvasY}px`;
    textarea.style.fontSize = `${this.fontSize}px`;
    textarea.style.fontFamily = this.fontFamily;
    textarea.style.color = this.color;
    textarea.placeholder = 'Escribe aquí...';
    textarea.rows = 1;

    this.container.appendChild(textarea);
    this.activeInput = textarea;

    setTimeout(() => {
      textarea.focus();
    }, 50);

    const commit = () => {
      if (!this.activeInput) return;
      const text = textarea.value.trim();
      this.container.removeChild(textarea);
      this.activeInput = null;

      if (text) {
        this.engine.addText({
          x: canvasX,
          y: canvasY,
          text: text,
          fontSize: this.fontSize,
          fontFamily: this.fontFamily,
          color: this.color
        });
      }
    };

    textarea.addEventListener('blur', commit);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.container.removeChild(textarea);
        this.activeInput = null;
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        commit();
      }
    });
  }
}

