// js/editor/ruler.js - Regla interactiva con marcas métricas (cm/mm), rotación con ángulo y snapping de trazo
import { Icons } from '../icons.js';

export class Ruler {
  constructor(canvasWrapper, canvasEngine, options = {}) {
    this.wrapper = canvasWrapper;
    this.engine = canvasEngine;
    this.onClose = options.onClose || (() => {});

    this.active = false;
    this.x = 400; // Posición central en px dentro del workspace
    this.y = 300;
    this.width = 576; // Longitud en px (aprox 24 cm @ 24px/cm)
    this.height = 76; // Ancho de la regla
    this.angle = 0; // Ángulo en grados

    this.isDragging = false;
    this.isRotating = false;
    this.startPointerX = 0;
    this.startPointerY = 0;
    this.startRulerX = 0;
    this.startRulerY = 0;
    this.startAngle = 0;
    this.startPointerAngle = 0;

    this.element = null;
    this.createElement();
    this.bindEvents();
  }

  setHost(canvas, wrapper) {
    if (wrapper) this.wrapper = wrapper;
    this.ensureElement();
  }

  getContainer() {
    return document.getElementById('editorWorkspace') || this.wrapper || document.body;
  }

  ensureElement() {
    const container = this.getContainer();
    if (!this.element) {
      this.createElement();
    } else if (container && !container.contains(this.element)) {
      container.appendChild(this.element);
      this.bindElementEvents();
    }
  }

  createElement() {
    let el = document.getElementById('interactiveRuler');
    if (!el) {
      el = document.createElement('div');
      el.className = 'interactive-ruler hidden';
      el.id = 'interactiveRuler';
    }
    this.element = el;

    this.renderTicks();
    const container = this.getContainer();
    if (container && !container.contains(this.element)) {
      container.appendChild(this.element);
    }
    this.updateTransform();
  }

  renderTicks() {
    if (!this.element) return;
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
          <span class="ruler-title">REGLA ${cmCount}cm</span>
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
  }

  setActive(active) {
    this.active = Boolean(active);
    this.ensureElement();
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

  setAngle(degrees) {
    this.angle = Number(degrees) || 0;
    this.updateTransform();
  }

  setLength(cm) {
    const cmVal = Math.max(10, Math.min(50, Number(cm) || 24));
    this.width = cmVal * 24;
    this.renderTicks();
    this.bindElementEvents();
    this.updateTransform();
  }

  centerOnScreen() {
    const ws = document.getElementById('editorWorkspace') || (this.engine && this.engine.viewport && this.engine.viewport.workspace) || window;
    const wsWidth = ws.clientWidth || window.innerWidth || 800;
    const wsHeight = ws.clientHeight || window.innerHeight || 600;

    this.x = wsWidth / 2;
    this.y = wsHeight / 2;
    this.updateTransform();
  }

  updateTransform() {
    if (!this.element) return;
    this.element.style.left = '0px';
    this.element.style.top = '0px';
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;
    this.element.style.transform = `translate3d(${Math.round(this.x - this.width / 2)}px, ${Math.round(this.y - this.height / 2)}px, 0) rotate(${this.angle}deg)`;

    const badge = this.element.querySelector('#rulerAngleBadge');
    if (badge) {
      let normAngle = Math.round(this.angle % 360);
      if (normAngle < 0) normAngle += 360;
      badge.textContent = `${normAngle}°`;
    }
  }

  bindElementEvents() {
    if (!this.element) return;
    const btnClose = this.element.querySelector('#btnRulerClose');
    if (btnClose) {
      btnClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setActive(false);
        this.onClose();
      });
    }

    const handle = this.element.querySelector('.ruler-drag-handle');
    if (handle) {
      handle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.isDragging = true;
        this.startPointerX = e.clientX;
        this.startPointerY = e.clientY;
        this.startRulerX = this.x;
        this.startRulerY = this.y;
        try { handle.setPointerCapture(e.pointerId); } catch (_) {}
      });
    }

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
        try { btnRotate.setPointerCapture(e.pointerId); } catch (_) {}
      });
    }
  }

  bindEvents() {
    this.bindElementEvents();

    // Movimiento y rotación global
    window.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.startPointerX;
        const dy = e.clientY - this.startPointerY;
        this.x = this.startRulerX + dx;
        this.y = this.startRulerY + dy;
        this.updateTransform();
      } else if (this.isRotating) {
        const rect = this.element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const currentPointerAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
        let delta = currentPointerAngle - this.startPointerAngle;
        let newAngle = this.startAngle + delta;

        // Snapping a múltiplos de 15° y 45° si está cerca (±2.5°)
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

  // Proyección y restricción física para dibujar líneas perfectamente rectas sin atravesar la regla
  snapPoint(canvasX, canvasY, options = {}) {
    if (!this.active || !this.element || !this.engine || !this.engine.canvas) {
      return { snapped: false, x: canvasX, y: canvasY, edge: null };
    }

    const mainCanvas = this.engine.canvas;
    const canvasRect = mainCanvas.getBoundingClientRect();
    if (canvasRect.width === 0 || canvasRect.height === 0) {
      return { snapped: false, x: canvasX, y: canvasY, edge: null };
    }

    const logicalWidth = this.engine.logicalWidth || 794;
    const logicalHeight = this.engine.logicalHeight || 1123;

    // Convertir de coordenadas lógicas de canvas a píxeles de pantalla
    const screenX = canvasRect.left + canvasX * (canvasRect.width / logicalWidth);
    const screenY = canvasRect.top + canvasY * (canvasRect.height / logicalHeight);

    const rulerRect = this.element.getBoundingClientRect();
    const cx = rulerRect.left + rulerRect.width / 2;
    const cy = rulerRect.top + rulerRect.height / 2;

    const rad = (this.angle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    // Vector relativo al centro de la regla en pantalla
    const dx = screenX - cx;
    const dy = screenY - cy;

    // Coordenadas locales en la regla: u_dist (a lo largo), n_dist (a lo ancho)
    const u_dist = dx * cosA + dy * sinA;
    const n_dist = -dx * sinA + dy * cosA;

    const halfL = this.width / 2; // e.g. 288px
    const halfThickness = this.height / 2; // e.g. 38px

    const lockedEdge = options.lockedEdge || null;
    const snapMargin = options.snapMargin !== undefined ? options.snapMargin : 65; // Margen de captura magnética en px

    // 1. Si el trazo ya está bloqueado a un borde, proyectar ESTRICTAMENTE recto sobre esa recta
    if (lockedEdge === 'top') {
      const clampedU = Math.max(-halfL, Math.min(halfL, u_dist));
      const targetN = -halfThickness;
      const sx = cx + clampedU * cosA - targetN * sinA;
      const sy = cy + clampedU * sinA + targetN * cosA;
      return {
        snapped: true,
        edge: 'top',
        x: (sx - canvasRect.left) * (logicalWidth / canvasRect.width),
        y: (sy - canvasRect.top) * (logicalHeight / canvasRect.height)
      };
    } else if (lockedEdge === 'bottom') {
      const clampedU = Math.max(-halfL, Math.min(halfL, u_dist));
      const targetN = halfThickness;
      const sx = cx + clampedU * cosA - targetN * sinA;
      const sy = cy + clampedU * sinA + targetN * cosA;
      return {
        snapped: true,
        edge: 'bottom',
        x: (sx - canvasRect.left) * (logicalWidth / canvasRect.width),
        y: (sy - canvasRect.top) * (logicalHeight / canvasRect.height)
      };
    }

    // 2. Si no hay bloqueo previo, comprobar proximidad a bordes superior e inferior
    const isNearLength = u_dist >= -halfL - 30 && u_dist <= halfL + 30;
    const distToTop = Math.abs(n_dist - (-halfThickness));
    const distToBottom = Math.abs(n_dist - halfThickness);

    if (isNearLength && (distToTop <= snapMargin || distToBottom <= snapMargin)) {
      const isTop = distToTop <= distToBottom;
      const edge = isTop ? 'top' : 'bottom';
      const targetN = isTop ? -halfThickness : halfThickness;
      const clampedU = Math.max(-halfL, Math.min(halfL, u_dist));

      const sx = cx + clampedU * cosA - targetN * sinA;
      const sy = cy + clampedU * sinA + targetN * cosA;

      return {
        snapped: true,
        edge: edge,
        x: (sx - canvasRect.left) * (logicalWidth / canvasRect.width),
        y: (sy - canvasRect.top) * (logicalHeight / canvasRect.height)
      };
    }

    // 3. Comprobar si el punto cae dentro del cuerpo físico de la regla (bloquear para no atravesar)
    const isInside = Math.abs(u_dist) <= halfL && Math.abs(n_dist) < halfThickness;
    if (isInside) {
      const isTop = n_dist < 0;
      const targetN = isTop ? -halfThickness : halfThickness;
      const clampedU = Math.max(-halfL, Math.min(halfL, u_dist));
      const sx = cx + clampedU * cosA - targetN * sinA;
      const sy = cy + clampedU * sinA + targetN * cosA;
      return {
        snapped: true,
        edge: isTop ? 'top' : 'bottom',
        blockedInside: true,
        x: (sx - canvasRect.left) * (logicalWidth / canvasRect.width),
        y: (sy - canvasRect.top) * (logicalHeight / canvasRect.height)
      };
    }

    return { snapped: false, x: canvasX, y: canvasY, edge: null };
  }

  projectOnSegment(p, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const lenSq = abx * abx + aby * aby;
    if (lenSq === 0) return { x: a.x, y: a.y };
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
    return {
      x: a.x + t * abx,
      y: a.y + t * aby
    };
  }
}
