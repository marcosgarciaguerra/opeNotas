// js/editor/selectionTool.js - Herramienta de lazo y barra flotante de selección
import { Icons } from '../icons.js';

export class SelectionTool {
  constructor(canvasEngine, containerElement) {
    this.engine = canvasEngine;
    this.canvas = canvasEngine.canvas;
    this.container = containerElement;

    this.isActive = false;
    this.isSelecting = false;
    this.isDraggingSelection = false;

    this.lassoPoints = [];
    this.selectedStrokes = [];
    this.selectionBBox = null;

    this.dragStartX = 0;
    this.dragStartY = 0;

    this.floatingBar = null;
    this.overlayCanvas = null;
    this.overlayCtx = null;

    this.createOverlay();
    this.createFloatingBar();
    this.bindEvents();
  }

  createOverlay() {
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.className = 'selection-overlay-canvas';
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.top = '0';
    this.overlayCanvas.style.left = '0';
    this.overlayCanvas.style.width = '100%';
    this.overlayCanvas.style.height = '100%';
    this.overlayCanvas.style.pointerEvents = 'none';
    this.overlayCanvas.style.zIndex = '5';
    this.overlayCanvas.width = this.canvas.width;
    this.overlayCanvas.height = this.canvas.height;
    this.overlayCtx = this.overlayCanvas.getContext('2d');

    this.canvas.parentElement.style.position = 'relative';
    this.canvas.parentElement.appendChild(this.overlayCanvas);
  }

  createFloatingBar() {
    this.floatingBar = document.createElement('div');
    this.floatingBar.className = 'floating-selection-bar hidden';
    this.floatingBar.innerHTML = `
      <div class="selection-actions">
        <button class="sel-btn" id="btnSelDuplicate" title="Duplicar selección">${Icons.copy} <span>Duplicar</span></button>
        <button class="sel-btn" id="btnSelDelete" title="Eliminar selección">${Icons.trash} <span>Borrar</span></button>
        <div class="sel-colors">
          <button class="color-dot" data-color="#1e293b" style="background:#1e293b"></button>
          <button class="color-dot" data-color="#2563eb" style="background:#2563eb"></button>
          <button class="color-dot" data-color="#dc2626" style="background:#dc2626"></button>
          <button class="color-dot" data-color="#16a34a" style="background:#16a34a"></button>
        </div>
      </div>
    `;
    this.canvas.parentElement.appendChild(this.floatingBar);

    this.floatingBar.querySelector('#btnSelDuplicate').addEventListener('click', (e) => {
      e.stopPropagation();
      this.duplicateSelection();
    });

    this.floatingBar.querySelector('#btnSelDelete').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteSelection();
    });

    this.floatingBar.querySelectorAll('.color-dot').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.changeSelectionColor(btn.dataset.color);
      });
    });
  }

  bindEvents() {
    this._pointerDownHandler = (e) => this.onPointerDown(e);
    this.canvas.addEventListener('pointerdown', this._pointerDownHandler);
    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));

    // Deseleccionar al hacer clic fuera
    document.addEventListener('click', (e) => {
      if (!this.isActive) return;
      if (!this.canvas.contains(e.target) && !this.floatingBar.contains(e.target)) {
        this.clearSelection();
      }
    });
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
    if (this.floatingBar) {
      hostContainer.appendChild(this.floatingBar);
    }
    this._pointerDownHandler = (e) => this.onPointerDown(e);
    this.canvas.addEventListener('pointerdown', this._pointerDownHandler);
  }

  setActive(active) {
    this.isActive = active;
    if (!active) {
      this.clearSelection();
    }
  }

  syncDimensions() {
    if (this.overlayCanvas) {
      this.overlayCanvas.width = this.canvas.width;
      this.overlayCanvas.height = this.canvas.height;
    }
  }

  onPointerDown(e) {
    if (!this.isActive) return;
    const pt = this.engine.getCanvasCoordinates(e);

    // Si pulsamos dentro del Bounding Box existente, iniciamos arrastre de la selección
    if (this.selectedStrokes.length > 0 && this.isPointInBBox(pt, this.selectionBBox)) {
      this.isDraggingSelection = true;
      this.dragStartX = pt.x;
      this.dragStartY = pt.y;
      return;
    }

    // De lo contrario, iniciamos un nuevo trazo de lazo
    this.clearSelection();
    this.isSelecting = true;
    this.lassoPoints = [pt];
    this.renderLasso();
  }

  onPointerMove(e) {
    if (!this.isActive) return;
    const pt = this.engine.getCanvasCoordinates(e);

    if (this.isDraggingSelection) {
      const dx = pt.x - this.dragStartX;
      const dy = pt.y - this.dragStartY;

      // Mover los trazos seleccionados
      for (const stroke of this.selectedStrokes) {
        for (const p of stroke.points) {
          p.x += dx;
          p.y += dy;
        }
        stroke.roughBox.minX += dx;
        stroke.roughBox.maxX += dx;
        stroke.roughBox.minY += dy;
        stroke.roughBox.maxY += dy;
      }

      this.selectionBBox.minX += dx;
      this.selectionBBox.maxX += dx;
      this.selectionBBox.minY += dy;
      this.selectionBBox.maxY += dy;

      this.dragStartX = pt.x;
      this.dragStartY = pt.y;

      this.engine.render();
      this.renderSelectionHighlight();
      this.updateFloatingBarPosition();
      return;
    }

    if (this.isSelecting) {
      this.lassoPoints.push(pt);
      this.renderLasso();
    }
  }

  onPointerUp(e) {
    if (!this.isActive) return;

    if (this.isDraggingSelection) {
      this.isDraggingSelection = false;
      if (this.engine.onStrokeEnd) this.engine.onStrokeEnd();
      return;
    }

    if (this.isSelecting) {
      this.isSelecting = false;
      this.evaluateSelection();
      this.lassoPoints = [];
      this.clearOverlay();
      if (this.selectedStrokes.length > 0) {
        this.renderSelectionHighlight();
        this.showFloatingBar();
      } else {
        this.hideFloatingBar();
      }
    }
  }

  renderLasso() {
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (this.lassoPoints.length < 2) return;

    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';

    ctx.beginPath();
    ctx.moveTo(this.lassoPoints[0].x, this.lassoPoints[0].y);
    for (let i = 1; i < this.lassoPoints.length; i++) {
      ctx.lineTo(this.lassoPoints[i].x, this.lassoPoints[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  evaluateSelection() {
    if (this.lassoPoints.length < 3) return;

    const matched = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const stroke of this.engine.strokes) {
      let strokeInside = false;
      for (const p of stroke.points) {
        if (this.pointInPolygon(p, this.lassoPoints)) {
          strokeInside = true;
          break;
        }
      }

      if (strokeInside) {
        matched.push(stroke);
        minX = Math.min(minX, stroke.roughBox.minX);
        minY = Math.min(minY, stroke.roughBox.minY);
        maxX = Math.max(maxX, stroke.roughBox.maxX);
        maxY = Math.max(maxY, stroke.roughBox.maxY);
      }
    }

    this.selectedStrokes = matched;
    if (matched.length > 0) {
      const padding = 12;
      this.selectionBBox = {
        minX: minX - padding,
        minY: minY - padding,
        maxX: maxX + padding,
        maxY: maxY + padding
      };
    } else {
      this.selectionBBox = null;
    }
  }

  pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;

      const intersect = ((yi > point.y) !== (yj > point.y))
          && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  isPointInBBox(pt, box) {
    if (!box) return false;
    return pt.x >= box.minX && pt.x <= box.maxX && pt.y >= box.minY && pt.y <= box.maxY;
  }

  renderSelectionHighlight() {
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    if (!this.selectionBBox) return;

    const { minX, minY, maxX, maxY } = this.selectionBBox;
    const w = maxX - minX;
    const h = maxY - minY;

    ctx.save();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.fillStyle = 'rgba(37, 99, 235, 0.05)';
    ctx.strokeRect(minX, minY, w, h);
    ctx.fillRect(minX, minY, w, h);

    // Pequeños tiradores en las 4 esquinas
    const handleSize = 8;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    const corners = [
      [minX, minY], [maxX, minY],
      [minX, maxY], [maxX, maxY]
    ];
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
      ctx.strokeRect(cx - handleSize/2, cy - handleSize/2, handleSize, handleSize);
    }
    ctx.restore();
  }

  updateFloatingBarPosition() {
    if (!this.selectionBBox || !this.floatingBar) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = rect.width / this.canvas.width;
    const scaleY = rect.height / this.canvas.height;

    const screenX = (this.selectionBBox.minX + (this.selectionBBox.maxX - this.selectionBBox.minX) / 2) * scaleX;
    const screenY = this.selectionBBox.minY * scaleY - 48;

    this.floatingBar.style.left = `${Math.max(10, screenX)}px`;
    this.floatingBar.style.top = `${Math.max(10, screenY)}px`;
  }

  showFloatingBar() {
    this.floatingBar.classList.remove('hidden');
    this.updateFloatingBarPosition();
  }

  hideFloatingBar() {
    this.floatingBar.classList.add('hidden');
  }

  clearOverlay() {
    this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
  }

  clearSelection() {
    this.selectedStrokes = [];
    this.selectionBBox = null;
    this.clearOverlay();
    this.hideFloatingBar();
  }

  duplicateSelection() {
    if (this.selectedStrokes.length === 0) return;
    const duplicates = [];
    const offset = 20;

    for (const stroke of this.selectedStrokes) {
      const copy = JSON.parse(JSON.stringify(stroke));
      copy.id = 'stroke_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      for (const pt of copy.points) {
        pt.x += offset;
        pt.y += offset;
      }
      copy.roughBox.minX += offset;
      copy.roughBox.maxX += offset;
      copy.roughBox.minY += offset;
      copy.roughBox.maxY += offset;

      this.engine.strokes.push(copy);
      this.engine.pushAction({ type: 'add', stroke: copy });
      duplicates.push(copy);
    }

    this.selectedStrokes = duplicates;
    this.selectionBBox.minX += offset;
    this.selectionBBox.maxX += offset;
    this.selectionBBox.minY += offset;
    this.selectionBBox.maxY += offset;

    this.engine.render();
    this.renderSelectionHighlight();
    this.updateFloatingBarPosition();
    if (this.engine.onStrokeEnd) this.engine.onStrokeEnd();
  }

  deleteSelection() {
    if (this.selectedStrokes.length === 0) return;
    const ids = new Set(this.selectedStrokes.map(s => s.id));
    const deleted = [];

    this.engine.strokes = this.engine.strokes.filter((s, idx) => {
      if (ids.has(s.id)) {
        deleted.push({ stroke: s, index: idx });
        return false;
      }
      return true;
    });

    this.engine.pushAction({ type: 'delete_multiple', strokes: deleted });
    this.clearSelection();
    this.engine.render();
    if (this.engine.onStrokeEnd) this.engine.onStrokeEnd();
  }

  changeSelectionColor(color) {
    if (this.selectedStrokes.length === 0) return;
    for (const stroke of this.selectedStrokes) {
      stroke.color = color;
    }
    this.engine.render();
    if (this.engine.onStrokeEnd) this.engine.onStrokeEnd();
  }
}

