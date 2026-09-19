// js/editor/ruler.js - Regla interactiva con marcas métricas (cm/mm), rotación con ángulo y snapping de trazo
import { Icons } from '../icons.js';

export class Ruler {
  constructor(canvasWrapper, canvasEngine, options = {}) {
    this.wrapper = canvasWrapper;
    this.engine = canvasEngine;
    this.onClose = options.onClose || (() => {});

    this.active = false;
    this.x = 200; // Posición central en px dentro de wrapper
    this.y = 300;
    this.width = 540; // Longitud en px (aprox 20-25 cm)
    this.height = 76; // Ancho de la regla
    this.angle = 0; // Ángulo en grados

    this.isDragging = false;
    this.isRotating = false;
    this.dragOffset = { x: 0, y: 0 };
    this.startAngle = 0;
    this.startPointerAngle = 0;

    this.element = null;
    this.createElement();
    this.bindEvents();
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'interactive-ruler hidden';
    this.element.id = 'interactiveRuler';

    // Generar marcas métricas (mm y cm)
    const cmCount = Math.floor(this.width / 24); // ~24px por cm
    let ticksHtml = '';
    for (let cm = 0; cm <= cmCount; cm++) {
      const cmX = cm * 24;
      ticksHtml += `
        <div class="ruler-tick cm-tick" style="left: ${cmX}px;">
          <span class="cm-label">${cm}</span>
        </div>
      `;
      if (cm < cmCount) {
        for (let mm = 1; mm < 10; mm++) {
          const mmX = cmX + (mm * 2.4);
          const isHalf = mm === 5;
          ticksHtml += `<div class="ruler-tick mm-tick ${isHalf ? 'half-tick' : ''}" style="left: ${mmX}px;"></div>`;
        }
      }
    }

    this.element.innerHTML = `
      <div class="ruler-scale top-scale">${ticksHtml}</div>
      <div class="ruler-body">
        <div class="ruler-drag-handle" title="Arrastrar regla">
          <span class="ruler-handle-icon">⠿</span>
          <span class="ruler-title">REGLA 30cm</span>
        </div>
        <div class="ruler-controls">
          <div class="ruler-angle-badge" id="rulerAngleBadge">0°</div>
          <button type="button" class="ruler-rotate-btn" id="btnRulerRotate" title="Girar regla">
            ↻
          </button>
          <button type="button" class="ruler-close-btn" id="btnRulerClose" title="Cerrar regla">
            ${Icons.close || '✕'}
          </button>
        </div>
      </div>
      <div class="ruler-scale bottom-scale">${ticksHtml}</div>
    `;

    this.wrapper.appendChild(this.element);
    this.updateTransform();
  }

  setActive(active) {
    this.active = Boolean(active);
    if (this.element) {
      this.element.classList.toggle('hidden', !this.active);
      if (this.active) {
        this.centerOnScreen();
        this.updateTransform();
      }
    }
  }

  toggle() {
    this.setActive(!this.active);
    return this.active;
  }

  centerOnScreen() {
    const rect = this.wrapper.getBoundingClientRect();
    this.x = rect.width / 2;
    this.y = rect.height / 2;
    this.updateTransform();
  }

  updateTransform() {
    if (!this.element) return;
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;
    this.element.style.transform = `translate(${this.x - this.width / 2}px, ${this.y - this.height / 2}px) rotate(${this.angle}deg)`;

    const badge = this.element.querySelector('#rulerAngleBadge');
    if (badge) {
      // Normalizar ángulo entre -180° y 180° o 0° y 360°
      let normAngle = Math.round(this.angle % 360);
      if (normAngle < 0) normAngle += 360;
      badge.textContent = `${normAngle}°`;
    }
  }

  bindEvents() {
    // Cerrar regla
    const btnClose = this.element.querySelector('#btnRulerClose');
    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setActive(false);
        this.onClose();
      });
    }

    // Arrastre (Move handle)
    const handle = this.element.querySelector('.ruler-drag-handle');
    if (handle) {
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.isDragging = true;
        this.dragOffset = {
          x: e.clientX - this.x,
          y: e.clientY - this.y
        };
        handle.setPointerCapture(e.pointerId);
      });
    }

    // Rotación (Rotate button)
    const btnRotate = this.element.querySelector('#btnRulerRotate');
    if (btnRotate) {
      btnRotate.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.isRotating = true;
        const rect = this.element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        this.startPointerAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
        this.startAngle = this.angle;
        btnRotate.setPointerCapture(e.pointerId);
      });
    }

    // Movimiento y rotación global
    window.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        this.x = e.clientX - this.dragOffset.x;
        this.y = e.clientY - this.dragOffset.y;
        this.updateTransform();
      } else if (this.isRotating) {
        const rect = this.element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const currentPointerAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
        let delta = currentPointerAngle - this.startPointerAngle;
        let newAngle = this.startAngle + delta;

        // Snapping a múltiplos de 15° y 45° si está cerca (±2°)
        const snapStep = 15;
        const nearestSnap = Math.round(newAngle / snapStep) * snapStep;
        if (Math.abs(newAngle - nearestSnap) < 2.5) {
          newAngle = nearestSnap;
        }

        this.angle = newAngle;
        this.updateTransform();
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
      this.isRotating = false;
    });

    // Rueda del ratón sobre la regla para rotar con precisión
    this.element.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      e.stopPropagation();
      const step = e.shiftKey ? 1 : (e.altKey ? 15 : 5);
      this.angle += (e.deltaY > 0 ? step : -step);
      this.updateTransform();
    }, { passive: false });
  }

  // Snapping de coordenadas sobre el borde de la regla en el espacio del canvas
  snapPoint(canvasX, canvasY, threshold = 28) {
    if (!this.active || !this.element || !this.engine || !this.engine.canvas) {
      return { snapped: false, x: canvasX, y: canvasY };
    }

    const mainCanvas = this.engine.canvas;
    const canvasRect = mainCanvas.getBoundingClientRect();
    const rulerRect = this.element.getBoundingClientRect();

    // Convertir centro de la regla al espacio del canvas
    const scaleX = mainCanvas.width / canvasRect.width;
    const scaleY = mainCanvas.height / canvasRect.height;

    const rulerCenterX = (rulerRect.left + rulerRect.width / 2 - canvasRect.left) * scaleX;
    const rulerCenterY = (rulerRect.top + rulerRect.height / 2 - canvasRect.top) * scaleY;

    const rad = (this.angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const halfLength = (this.width / 2) * scaleX;
    const halfThickness = (this.height / 2) * scaleY;

    // Vector unitario a lo largo de la regla
    const ux = cos;
    const uy = sin;
    // Vector unitario perpendicular (normal)
    const nx = -sin;
    const ny = cos;

    // Borde superior
    const topEdgeCenter = {
      x: rulerCenterX + nx * (-halfThickness),
      y: rulerCenterY + ny * (-halfThickness)
    };
    const topA = { x: topEdgeCenter.x - ux * halfLength, y: topEdgeCenter.y - uy * halfLength };
    const topB = { x: topEdgeCenter.x + ux * halfLength, y: topEdgeCenter.y + uy * halfLength };

    // Borde inferior
    const bottomEdgeCenter = {
      x: rulerCenterX + nx * halfThickness,
      y: rulerCenterY + ny * halfThickness
    };
    const bottomA = { x: bottomEdgeCenter.x - ux * halfLength, y: bottomEdgeCenter.y - uy * halfLength };
    const bottomB = { x: bottomEdgeCenter.x + ux * halfLength, y: bottomEdgeCenter.y + uy * halfLength };

    // Proyección sobre borde superior
    const projTop = this.projectOnSegment({ x: canvasX, y: canvasY }, topA, topB);
    const distTop = Math.hypot(canvasX - projTop.x, canvasY - projTop.y);

    // Proyección sobre borde inferior
    const projBottom = this.projectOnSegment({ x: canvasX, y: canvasY }, bottomA, bottomB);
    const distBottom = Math.hypot(canvasX - projBottom.x, canvasY - projBottom.y);

    const scaledThreshold = threshold * scaleX;

    if (distTop <= scaledThreshold && distTop <= distBottom) {
      return { snapped: true, x: projTop.x, y: projTop.y, edge: 'top' };
    } else if (distBottom <= scaledThreshold) {
      return { snapped: true, x: projBottom.x, y: projBottom.y, edge: 'bottom' };
    }

    return { snapped: false, x: canvasX, y: canvasY };
  }

  projectOnSegment(p, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;

    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) return { x: a.x, y: a.y };

    let t = (apx * abx + apy * aby) / abLenSq;
    t = Math.max(0, Math.min(1, t)); // Clamped al segmento de la regla

    return {
      x: a.x + t * abx,
      y: a.y + t * aby
    };
  }

  destroy() {
    this.setActive(false);
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

