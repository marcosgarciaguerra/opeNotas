// js/editor/viewport.js - Controlador de Zoom, Paneo y Navegación táctil para el Lienzo
import { Icons } from '../icons.js';

export class ViewportController {
  constructor(workspaceEl, wrapperEl, canvasEngine, options = {}) {
    this.workspace = workspaceEl;
    this.wrapper = wrapperEl;
    this.canvas = canvasEngine.canvas;
    this.engine = canvasEngine;

    // Estado del Viewport
    this.zoom = 1.0;
    this.minZoom = 0.25;
    this.maxZoom = 4.0;
    this.panX = 0;
    this.panY = 0;

    // Estados de interacción
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
    this.isSpacePressed = false;

    // Soporte multitáctil (Pellizcar para zoom en tablets / Android)
    this.activeTouches = new Map();
    this.initialPinchDistance = 0;
    this.initialPinchZoom = 1.0;
    this.initialPinchMidpoint = { x: 0, y: 0 };

    this.onZoomChange = options.onZoomChange || (() => {});

    this.widgetEl = null;
    this.createControlsWidget();
    this.bindEvents();
    this.centerContent();
  }

  createControlsWidget() {
    this.widgetEl = document.createElement('div');
    this.widgetEl.className = 'zoom-controls-widget';
    this.widgetEl.innerHTML = `
      <button class="zoom-btn" id="btnZoomOut" title="Reducir zoom (Ctrl + -)">
        ${Icons.zoomOut}
      </button>
      <button class="zoom-btn zoom-percent" id="btnZoomReset" title="Restablecer al 100% (Ctrl + 0)">
        100%
      </button>
      <button class="zoom-btn" id="btnZoomIn" title="Aumentar zoom (Ctrl + +)">
        ${Icons.zoomIn}
      </button>
      <div class="zoom-divider"></div>
      <button class="zoom-btn" id="btnZoomFit" title="Ajustar a la pantalla">
        ${Icons.fitScreen}
      </button>
      <div class="zoom-divider" id="scrollNavDivider"></div>
      <button class="zoom-btn scroll-doc-btn" id="btnScrollDocUp" title="Subir página anterior">
        ${Icons.chevronUp}
      </button>
      <button class="zoom-btn scroll-doc-btn" id="btnScrollDocDown" title="Bajar página siguiente">
        ${Icons.chevronDown}
      </button>
    `;

    this.workspace.appendChild(this.widgetEl);

    // Eventos del widget
    this.widgetEl.querySelector('#btnZoomOut').addEventListener('click', (e) => {
      e.stopPropagation();
      this.zoomOut();
    });

    this.widgetEl.querySelector('#btnZoomIn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.zoomIn();
    });

    this.widgetEl.querySelector('#btnZoomReset').addEventListener('click', (e) => {
      e.stopPropagation();
      if (Math.abs(this.zoom - 1.0) < 0.05) {
        this.fitToScreen();
      } else {
        this.resetZoom();
      }
    });

    this.widgetEl.querySelector('#btnZoomFit').addEventListener('click', (e) => {
      e.stopPropagation();
      this.fitToScreen();
    });

    const btnScrollUp = this.widgetEl.querySelector('#btnScrollDocUp');
    if (btnScrollUp) {
      btnScrollUp.addEventListener('click', (e) => {
        e.stopPropagation();
        this.scrollBy(450);
      });
    }

    const btnScrollDown = this.widgetEl.querySelector('#btnScrollDocDown');
    if (btnScrollDown) {
      btnScrollDown.addEventListener('click', (e) => {
        e.stopPropagation();
        this.scrollBy(-450);
      });
    }
  }

  bindEvents() {
    // 1. Rueda del ratón y trackpad (Zoom con cursor de ancla y desplazamiento)
    this.workspace.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    // 2. Teclado (Barra espaciadora para paneo y atajos de zoom)
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // 3. Eventos de puntero para Paneo y Multitouch
    this.workspace.addEventListener('pointerdown', (e) => this.onPointerDown(e), { capture: true });
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

    // Reajustar si la ventana cambia de tamaño
    window.addEventListener('resize', () => {
      this.clampPan();
      this.applyTransform();
    });
  }

  onWheel(e) {
    e.preventDefault();

    const rect = this.workspace.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    // Si mantiene Ctrl/Cmd o pellizca en trackpad: Zoom enfocado al cursor
    if (e.ctrlKey || e.metaKey) {
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      this.zoomAt(cursorX, cursorY, this.zoom * zoomFactor);
    } else if (e.shiftKey) {
      // Shift + Rueda: Desplazamiento horizontal
      this.panX -= e.deltaY * 0.8;
      this.applyTransform();
    } else {
      // Rueda normal: Desplazamiento vertical y horizontal por el documento
      this.panY -= e.deltaY * 0.9;
      this.panX -= e.deltaX * 0.9;
      this.clampPan();
      this.applyTransform();
    }
  }

  onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Barra espaciadora activa modo mano para mover el lienzo
    if (e.code === 'Space' && !this.isSpacePressed) {
      this.isSpacePressed = true;
      this.workspace.classList.add('panning-mode');
    }

    // Atajos de zoom: Ctrl + / Ctrl - / Ctrl 0
    if (e.ctrlKey || e.metaKey) {
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.zoomIn();
      } else if (e.key === '-') {
        e.preventDefault();
        this.zoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        this.resetZoom();
      }
    }
  }

  onKeyUp(e) {
    if (e.code === 'Space') {
      this.isSpacePressed = false;
      this.workspace.classList.remove('panning-mode');
    }
  }

  onPointerDown(e) {
    // Si es un toque en pantalla, registrar para detección multitáctil
    if (e.pointerType === 'touch') {
      this.activeTouches.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

      if (this.activeTouches.size === 2) {
        // Dos dedos detectados: Iniciar modo pellizco (zoom) y paneo a 2 dedos (scroll)
        this.engine.isDrawing = false;
        this.engine.currentStroke = null;
        this.engine.render();

        const touches = Array.from(this.activeTouches.values());
        this.initialPinchDistance = Math.hypot(
          touches[0].clientX - touches[1].clientX,
          touches[0].clientY - touches[1].clientY
        );
        this.initialPinchZoom = this.zoom;

        const rect = this.workspace.getBoundingClientRect();
        this.initialPinchMidpoint = {
          x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
          y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
        };
        this.lastPinchMidpoint = { ...this.initialPinchMidpoint };
        return;
      }
    }

    // Paneo con botón central del ratón, manteniendo Espacio, con herramienta mano ('hand')
    // O toque táctil si está en modo Stylus (rechazo de palma activo para scroll con dedo)
    const isMiddleClick = e.button === 1;
    const isHandTool = this.engine.tool === 'hand';
    const isStylusTouchPan = e.pointerType === 'touch' && this.engine.inputMode === 'stylus-first';

    if (isMiddleClick || this.isSpacePressed || isHandTool || isStylusTouchPan) {
      e.preventDefault();
      e.stopPropagation();
      this.isPanning = true;
      this.panStartX = e.clientX - this.panX;
      this.panStartY = e.clientY - this.panY;
      this.workspace.classList.add('grabbing');
    }
  }

  onPointerMove(e) {
    // 1. Gestión multitáctil (Pellizco de zoom y paneo a 2 dedos para desplazarse por el documento)
    if (e.pointerType === 'touch' && this.activeTouches.has(e.pointerId)) {
      this.activeTouches.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

      if (this.activeTouches.size === 2) {
        const touches = Array.from(this.activeTouches.values());
        const currentDistance = Math.hypot(
          touches[0].clientX - touches[1].clientX,
          touches[0].clientY - touches[1].clientY
        );

        const rect = this.workspace.getBoundingClientRect();
        const currentMidpoint = {
          x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
          y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
        };

        // Paneo / desplazamiento al mover los 2 dedos
        if (this.lastPinchMidpoint) {
          const deltaX = currentMidpoint.x - this.lastPinchMidpoint.x;
          const deltaY = currentMidpoint.y - this.lastPinchMidpoint.y;
          this.panX += deltaX;
          this.panY += deltaY;
        }
        this.lastPinchMidpoint = currentMidpoint;

        // Zoom por pellizco si la distancia cambia significativamente
        if (this.initialPinchDistance > 0 && Math.abs(currentDistance - this.initialPinchDistance) > 12) {
          const factor = currentDistance / this.initialPinchDistance;
          const targetZoom = this.initialPinchZoom * factor;
          this.zoomAt(currentMidpoint.x, currentMidpoint.y, targetZoom);
        } else {
          this.clampPan();
          this.applyTransform();
        }
        return;
      }
    }

    // 2. Paneo activo con ratón, herramienta mano o toque en modo stylus
    if (this.isPanning) {
      this.panX = e.clientX - this.panStartX;
      this.panY = e.clientY - this.panStartY;
      this.clampPan();
      this.applyTransform();
    }
  }

  onPointerUp(e) {
    if (e.pointerType === 'touch') {
      this.activeTouches.delete(e.pointerId);
      if (this.activeTouches.size < 2) {
        this.initialPinchDistance = 0;
        this.lastPinchMidpoint = null;
      }
    }

    if (this.isPanning) {
      this.isPanning = false;
      this.workspace.classList.remove('grabbing');
    }
  }

  // Zoom enfocado en un punto específico de la pantalla (cursor o centro)
  zoomAt(screenX, screenY, targetZoom) {
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, targetZoom));
    if (Math.abs(newZoom - this.zoom) < 0.001) return;

    // Conservar el punto del lienzo bajo las coordenadas del cursor
    const scale = newZoom / this.zoom;
    this.panX = screenX - (screenX - this.panX) * scale;
    this.panY = screenY - (screenY - this.panY) * scale;
    this.zoom = newZoom;

    this.applyTransform();
  }

  zoomIn() {
    const cx = this.workspace.clientWidth / 2;
    const cy = this.workspace.clientHeight / 2;
    this.zoomAt(cx, cy, this.zoom * 1.25);
  }

  zoomOut() {
    const cx = this.workspace.clientWidth / 2;
    const cy = this.workspace.clientHeight / 2;
    this.zoomAt(cx, cy, this.zoom * 0.8);
  }

  resetZoom() {
    const wsWidth = this.workspace.clientWidth || window.innerWidth;
    const canvasWidth = this.engine.canvas.width;
    this.zoom = 1.0;
    this.panX = (wsWidth - canvasWidth) / 2;
    this.panY = 30;
    this.applyTransform();
  }

  fitWidth(padding = 16) {
    const wsWidth = this.workspace.clientWidth || window.innerWidth;
    const targetWidth = this.engine.format === 'a4' ? 794 : this.engine.canvas.width;
    const fitScale = (wsWidth - padding * 2) / targetWidth;
    this.zoom = Math.max(this.minZoom, Math.min(2.0, fitScale));
    this.panX = (wsWidth - targetWidth * this.zoom) / 2;
    this.panY = 16;
    this.applyTransform();
  }

  fitToScreen() {
    const wsWidth = this.workspace.clientWidth || window.innerWidth;
    const wsHeight = this.workspace.clientHeight || (window.innerHeight - 60);

    if (this.engine.format === 'a4') {
      this.fitWidth(wsWidth <= 768 ? 12 : 32);
      return;
    }

    const canvasWidth = this.engine.canvas.width;
    const canvasHeight = this.engine.canvas.height;
    const padding = wsWidth <= 768 ? 16 : 32;

    const fitScale = Math.min(
      (wsWidth - padding * 2) / canvasWidth,
      (wsHeight - padding * 2) / canvasHeight
    );

    this.zoom = Math.max(this.minZoom, Math.min(2.0, fitScale));
    this.panX = (wsWidth - canvasWidth * this.zoom) / 2;
    this.panY = Math.max(16, (wsHeight - canvasHeight * this.zoom) / 2);

    this.applyTransform();
  }

  centerContent() {
    const wsWidth = this.workspace.clientWidth || window.innerWidth;
    const wsHeight = this.workspace.clientHeight || (window.innerHeight - 60);
    const isMobile = wsWidth <= 768;

    if (this.engine.format === 'a4') {
      if (isMobile || 794 > wsWidth - 48) {
        this.fitWidth(isMobile ? 12 : 32);
      } else {
        this.zoom = 1.0;
        // Centrar con ligero desplazamiento óptico a la derecha (+24px)
        this.panX = Math.round((wsWidth - 794) / 2) + 24;
        this.panY = 24;
        this.applyTransform();
      }
      return;
    }

    const canvasWidth = this.engine.canvas.width;
    const canvasHeight = this.engine.canvas.height;

    if (canvasWidth > wsWidth || canvasHeight > wsHeight) {
      this.fitToScreen();
    } else {
      this.zoom = 1.0;
      this.panX = Math.round((wsWidth - canvasWidth) / 2);
      this.panY = Math.max(24, (wsHeight - canvasHeight) / 2);
      this.applyTransform();
    }
  }

  scrollBy(deltaY) {
    this.panY += deltaY;
    this.clampPan();
    this.applyTransform();
  }

  clampPan() {
    let totalHeight = this.engine.canvas.height;
    let totalWidth = this.engine.canvas.width;

    if (this.engine.format === 'a4') {
      const streamContainer = this.wrapper.querySelector('.notebook-stream-container');
      if (streamContainer && streamContainer.scrollHeight > 0) {
        totalHeight = Math.max(totalHeight, streamContainer.scrollHeight);
      } else {
        const pagesCount = this.wrapper.querySelectorAll('.notebook-page-wrapper').length;
        if (pagesCount > 0) {
          totalHeight = Math.max(totalHeight, pagesCount * 1220 + 200);
        }
      }
      totalWidth = 794;
    } else {
      totalHeight = Math.max(totalHeight, 1400);
    }

    const wsWidth = this.workspace.clientWidth || window.innerWidth;
    const wsHeight = this.workspace.clientHeight || (window.innerHeight - 60);

    const contentWidth = totalWidth * this.zoom;
    const contentHeight = totalHeight * this.zoom;

    const minX = Math.min(-contentWidth + 100, (wsWidth - contentWidth) / 2 - 250);
    const maxX = Math.max(wsWidth - 100, (wsWidth - contentWidth) / 2 + 250);

    // Permite bajar libremente por todo el documento hasta el final
    const maxY = 80;
    const maxScroll = Math.max(200, contentHeight - wsHeight + 350);
    const minY = -maxScroll;

    this.panX = Math.max(minX, Math.min(maxX, this.panX));
    this.panY = Math.min(maxY, Math.max(minY, this.panY));
  }

  applyTransform() {
    this.wrapper.style.transformOrigin = '0 0';
    this.wrapper.style.transform = `translate3d(${this.panX}px, ${this.panY}px, 0) scale(${this.zoom})`;

    // Actualizar indicador del widget
    if (this.widgetEl) {
      const pctBtn = this.widgetEl.querySelector('.zoom-percent');
      if (pctBtn) {
        pctBtn.textContent = `${Math.round(this.zoom * 100)}%`;
      }
    }

    this.onZoomChange(this.zoom);
  }
}

