// js/editor/exporter.js - Exportación unificada: Compilación multi-página para Cuadernos y recorte automático para Pizarras
import { CoverDesigner } from './coverDesigner.js';
import { Icons } from '../icons.js';

export class Exporter {
  /**
   * Muestra modal interactivo de exportación adaptado al tipo de documento
   */
  static showExportModal(doc, canvasEngine) {
    const isNotebook = doc.type === 'notebook' || canvasEngine.format === 'a4';
    const existingModal = document.getElementById('exportModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'exportModal';
    modal.className = 'modal-backdrop';

    modal.innerHTML = `
      <div class="modal-box export-modal-box">
        <h3 class="modal-title">Exportar Documento</h3>
        <p class="export-modal-subtitle">${this.escapeHtml(doc.title)} (${isNotebook ? 'Cuaderno Digital' : 'Pizarra Infinita'})</p>

        <div class="export-options-list">
          ${isNotebook ? `
            <button class="export-option-card primary-card" id="btnExportFullPdf">
              <div class="export-card-icon">${Icons.export}</div>
              <div class="export-card-info">
                <strong>Compilar Cuaderno completo en PDF</strong>
                <small>Incluye portada diseñada y todas las páginas en formato A4 vectorial estándar.</small>
              </div>
            </button>
            <button class="export-option-card" id="btnExportCurrentPng">
              <div class="export-card-icon">${Icons.image}</div>
              <div class="export-card-info">
                <strong>Página actual como Imagen PNG</strong>
                <small>Imagen de alta resolución de la página visible en el editor.</small>
              </div>
            </button>
            <button class="export-option-card" id="btnExportCurrentJpg">
              <div class="export-card-icon">${Icons.image}</div>
              <div class="export-card-info">
                <strong>Página actual como JPG comprimido</strong>
                <small>Formato ligero ideal para compartir rápidamente.</small>
              </div>
            </button>
          ` : `
            <button class="export-option-card primary-card" id="btnExportBoardPng">
              <div class="export-card-icon">${Icons.image}</div>
              <div class="export-card-info">
                <strong>Imagen PNG con Recorte Inteligente</strong>
                <small>Ajusta los bordes automáticamente a todos los dibujos (+ margen de 40px).</small>
              </div>
            </button>
            <button class="export-option-card" id="btnExportBoardJpg">
              <div class="export-card-icon">${Icons.image}</div>
              <div class="export-card-info">
                <strong>Imagen JPG (Fondo blanco nítido)</strong>
                <small>Recorte automático al contenido con fondo blanco puro.</small>
              </div>
            </button>
            <button class="export-option-card" id="btnExportBoardPdf">
              <div class="export-card-icon">${Icons.export}</div>
              <div class="export-card-info">
                <strong>Documento PDF de la Pizarra</strong>
                <small>Exporta el área activa en un documento PDF adaptado.</small>
              </div>
            </button>
          `}
        </div>

        <div class="modal-actions" style="margin-top: 20px;">
          <button class="btn-secondary" id="btnCloseExportModal">Cerrar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#btnCloseExportModal').addEventListener('click', close);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) close();
    });

    // Conectar eventos según el tipo
    if (isNotebook) {
      modal.querySelector('#btnExportFullPdf').addEventListener('click', async () => {
        close();
        await this.exportNotebookPdf(doc, canvasEngine);
      });
      modal.querySelector('#btnExportCurrentPng').addEventListener('click', () => {
        close();
        this.exportPageImage(canvasEngine, doc.title, 'png');
      });
      modal.querySelector('#btnExportCurrentJpg').addEventListener('click', () => {
        close();
        this.exportPageImage(canvasEngine, doc.title, 'jpeg');
      });
    } else {
      modal.querySelector('#btnExportBoardPng').addEventListener('click', () => {
        close();
        this.exportWhiteboardImage(canvasEngine, doc.title, 'png');
      });
      modal.querySelector('#btnExportBoardJpg').addEventListener('click', () => {
        close();
        this.exportWhiteboardImage(canvasEngine, doc.title, 'jpeg');
      });
      modal.querySelector('#btnExportBoardPdf').addEventListener('click', () => {
        close();
        this.exportWhiteboardPdf(canvasEngine, doc.title);
      });
    }
  }

  /**
   * Compila un Cuaderno completo (Portada + Todas las páginas) a un PDF unificado
   */
  static async exportNotebookPdf(doc, canvasEngine) {
    const { jsPDF } = window.jspdf;
    const a4W = 794;
    const a4H = 1123;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [a4W, a4H]
    });

    let isFirstPage = true;

    // 1. Portada del cuaderno si existe
    if (doc.cover) {
      const coverCanvas = document.createElement('canvas');
      coverCanvas.width = a4W;
      coverCanvas.height = a4H;
      const cCtx = coverCanvas.getContext('2d');

      // Si tiene imagen de fondo personalizada, esperar a que cargue
      if (doc.cover.customImage && !doc.cover._imgElement) {
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => { doc.cover._imgElement = img; resolve(); };
          img.onerror = resolve;
          img.src = doc.cover.customImage;
        });
      }

      this.renderPageDataToContext(cCtx, doc.cover, a4W, a4H, canvasEngine);
      const coverImgData = coverCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(coverImgData, 'JPEG', 0, 0, a4W, a4H);
      isFirstPage = false;
    }

    // 2. Iterar sobre las páginas del cuaderno
    const pages = (doc.pages && doc.pages.length > 0) ? doc.pages : [{
      strokes: canvasEngine.strokes,
      shapes: canvasEngine.shapes,
      texts: canvasEngine.texts,
      images: canvasEngine.images,
      backgroundPattern: canvasEngine.backgroundPattern
    }];

    const renderCanvas = document.createElement('canvas');
    renderCanvas.width = a4W;
    renderCanvas.height = a4H;
    const rCtx = renderCanvas.getContext('2d');

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!isFirstPage) {
        pdf.addPage([a4W, a4H], 'portrait');
      } else {
        isFirstPage = false;
      }

      // Pre-cargar imagen de fondo PDF si procede
      if (page.backgroundImage && !page._bgImgElement) {
        const bgImg = new Image();
        bgImg.src = page.backgroundImage;
        await new Promise(r => { bgImg.onload = r; bgImg.onerror = r; });
        page._bgImgElement = bgImg;
      }

      // Pre-cargar imágenes de la página
      if (page.images && page.images.length > 0) {
        for (const imgItem of page.images) {
          if (!imgItem._element && imgItem.dataUrl) {
            const img = new Image();
            img.src = imgItem.dataUrl;
            await new Promise(r => { img.onload = r; img.onerror = r; });
            imgItem._element = img;
          }
        }
      }

      // Renderizado limpio de la página
      this.renderPageDataToContext(rCtx, page, a4W, a4H, canvasEngine);

      const pageImgData = renderCanvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(pageImgData, 'JPEG', 0, 0, a4W, a4H);
    }

    const cleanTitle = (doc.title || 'Cuaderno').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${cleanTitle}_completo_${new Date().toISOString().slice(0, 10)}.pdf`;
    if (typeof window.saveNativeFile === 'function' && window.isAndroidApp && window.isAndroidApp()) {
      window.saveNativeFile(pdf.output('datauristring'), filename, 'application/pdf');
    } else {
      pdf.save(filename);
    }
  }

  /**
   * Exporta la Pizarra libre con Auto-crop al contenido (+40px margen)
   */
  static exportWhiteboardImage(canvasEngine, title = 'Pizarra', format = 'png') {
    const bbox = canvasEngine.getBoundingBox();
    const margin = 40;

    const minX = Math.max(0, bbox.minX - margin);
    const minY = Math.max(0, bbox.minY - margin);
    const maxX = Math.min(canvasEngine.canvas.width, bbox.maxX + margin);
    const maxY = Math.min(canvasEngine.canvas.height, bbox.maxY + margin);

    const cropW = Math.max(120, maxX - minX);
    const cropH = Math.max(120, maxY - minY);

    // 1. Renderizar lienzo completo a un canvas auxiliar
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = canvasEngine.canvas.width;
    fullCanvas.height = canvasEngine.canvas.height;
    const fCtx = fullCanvas.getContext('2d');

    // Fondo blanco
    fCtx.fillStyle = '#ffffff';
    fCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
    canvasEngine.renderBackground(fCtx);
    canvasEngine.renderImages(fCtx);

    fCtx.save();
    fCtx.globalCompositeOperation = 'multiply';
    for (const s of canvasEngine.strokes) {
      if (s.isHighlighter) canvasEngine.drawStroke(fCtx, s);
    }
    fCtx.restore();

    fCtx.save();
    for (const sh of canvasEngine.shapes) canvasEngine.drawShape(fCtx, sh);
    for (const s of canvasEngine.strokes) {
      if (!s.isHighlighter) canvasEngine.drawStroke(fCtx, s);
    }
    for (const t of canvasEngine.texts) canvasEngine.drawText(fCtx, t);
    fCtx.restore();

    // 2. Extraer recorte exacto al área ocupada
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cCtx = cropCanvas.getContext('2d');

    cCtx.fillStyle = '#ffffff';
    cCtx.fillRect(0, 0, cropW, cropH);
    cCtx.drawImage(fullCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    const cleanTitle = (title || 'Pizarra').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const filename = `${cleanTitle}_recorte_${new Date().toISOString().slice(0, 10)}.${ext}`;
    const dataUrl = cropCanvas.toDataURL(mime, 0.95);

    if (typeof window.saveNativeFile === 'function' && window.isAndroidApp && window.isAndroidApp()) {
      window.saveNativeFile(dataUrl, filename, mime);
    } else {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    }
  }

  /**
   * Exporta la Pizarra a PDF adaptado a su bounding box
   */
  static exportWhiteboardPdf(canvasEngine, title = 'Pizarra') {
    const { jsPDF } = window.jspdf;
    const bbox = canvasEngine.getBoundingBox();
    const margin = 40;

    const minX = Math.max(0, bbox.minX - margin);
    const minY = Math.max(0, bbox.minY - margin);
    const maxX = Math.min(canvasEngine.canvas.width, bbox.maxX + margin);
    const maxY = Math.min(canvasEngine.canvas.height, bbox.maxY + margin);

    const cropW = Math.max(120, maxX - minX);
    const cropH = Math.max(120, maxY - minY);

    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = canvasEngine.canvas.width;
    fullCanvas.height = canvasEngine.canvas.height;
    const fCtx = fullCanvas.getContext('2d');

    fCtx.fillStyle = '#ffffff';
    fCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
    canvasEngine.renderBackground(fCtx);
    canvasEngine.renderImages(fCtx);

    fCtx.save();
    fCtx.globalCompositeOperation = 'multiply';
    for (const s of canvasEngine.strokes) {
      if (s.isHighlighter) canvasEngine.drawStroke(fCtx, s);
    }
    fCtx.restore();

    fCtx.save();
    for (const sh of canvasEngine.shapes) canvasEngine.drawShape(fCtx, sh);
    for (const s of canvasEngine.strokes) {
      if (!s.isHighlighter) canvasEngine.drawStroke(fCtx, s);
    }
    for (const t of canvasEngine.texts) canvasEngine.drawText(fCtx, t);
    fCtx.restore();

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cCtx = cropCanvas.getContext('2d');
    cCtx.fillStyle = '#ffffff';
    cCtx.fillRect(0, 0, cropW, cropH);
    cCtx.drawImage(fullCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

    const isLandscape = cropW >= cropH;
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'px',
      format: [cropW, cropH]
    });

    pdf.addImage(cropCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, cropW, cropH);
    const cleanTitle = (title || 'Pizarra').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${cleanTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;
    if (typeof window.saveNativeFile === 'function' && window.isAndroidApp && window.isAndroidApp()) {
      window.saveNativeFile(pdf.output('datauristring'), filename, 'application/pdf');
    } else {
      pdf.save(filename);
    }
  }

  /**
   * Exporta la página activa del lienzo como imagen PNG o JPG
   */
  static exportPageImage(canvasEngine, title = 'Documento', format = 'png') {
    const canvas = canvasEngine.canvas;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d');

    tCtx.fillStyle = '#ffffff';
    tCtx.fillRect(0, 0, canvas.width, canvas.height);
    canvasEngine.renderBackground(tCtx);
    canvasEngine.renderImages(tCtx);

    tCtx.save();
    tCtx.globalCompositeOperation = 'multiply';
    for (const s of canvasEngine.strokes) {
      if (s.isHighlighter) canvasEngine.drawStroke(tCtx, s);
    }
    tCtx.restore();

    tCtx.save();
    for (const sh of canvasEngine.shapes) canvasEngine.drawShape(tCtx, sh);
    for (const s of canvasEngine.strokes) {
      if (!s.isHighlighter) canvasEngine.drawStroke(tCtx, s);
    }
    for (const t of canvasEngine.texts) canvasEngine.drawText(tCtx, t);
    tCtx.restore();

    const cleanTitle = (title || 'Documento').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const filename = `${cleanTitle}_pagina_${new Date().toISOString().slice(0, 10)}.${ext}`;
    const dataUrl = tempCanvas.toDataURL(mime, 0.95);

    if (typeof window.saveNativeFile === 'function' && window.isAndroidApp && window.isAndroidApp()) {
      window.saveNativeFile(dataUrl, filename, mime);
    } else {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    }
  }

  /**
   * Renderiza el contenido de una página arbitraria a un contexto 2D
   */
  static renderPageDataToContext(ctx, page, width, height, canvasEngine) {
    ctx.clearRect(0, 0, width, height);

    if (page.isCover || page.template) {
      CoverDesigner.renderCover(ctx, width, height, page.coverData || page);
    } else {
      // Fondo blanco o tono de papel
      const bgColor = page.paperColor || '#ffffff';
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      if (page.backgroundImage) {
        let bgImg = page._bgImgElement;
        if (!bgImg) {
          bgImg = new Image();
          bgImg.src = page.backgroundImage;
          page._bgImgElement = bgImg;
        }
        if (bgImg.complete && bgImg.naturalWidth > 0) {
          ctx.drawImage(bgImg, 0, 0, width, height);
        }
      } else {
        // Patrón de fondo
        const pattern = page.backgroundPattern || 'grid';
        if (pattern === 'ruled') {
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          const lineGap = 28;
          const topMargin = 70;
          for (let y = topMargin; y < height; y += lineGap) {
            ctx.beginPath();
            ctx.moveTo(30, y);
            ctx.lineTo(width - 30, y);
            ctx.stroke();
          }
          ctx.strokeStyle = '#fecaca';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(76, 0);
          ctx.lineTo(76, height);
          ctx.stroke();
        } else if (pattern === 'grid') {
          ctx.strokeStyle = '#f1f5f9';
          ctx.lineWidth = 1;
          const gap = 20;
          for (let x = gap; x < width; x += gap) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
          }
          for (let y = gap; y < height; y += gap) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
          }
        } else if (pattern === 'dots') {
          ctx.fillStyle = '#cbd5e1';
          const gap = 24;
          for (let x = gap; x < width; x += gap) {
            for (let y = gap; y < height; y += gap) {
              ctx.beginPath(); ctx.arc(x, y, 1.25, 0, Math.PI * 2); ctx.fill();
            }
          }
        }
      }
    }

    // Imágenes
    if (page.images) {
      for (const imgItem of page.images) {
        if (imgItem._element && imgItem._element.complete) {
          ctx.save();
          ctx.translate(imgItem.x + imgItem.width / 2, imgItem.y + imgItem.height / 2);
          if (imgItem.rotation) ctx.rotate(imgItem.rotation);
          ctx.drawImage(imgItem._element, -imgItem.width / 2, -imgItem.height / 2, imgItem.width, imgItem.height);
          ctx.restore();
        }
      }
    }

    // Subrayadores en modo multiply
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    if (page.strokes) {
      for (const s of page.strokes) {
        if (s.isHighlighter) canvasEngine.drawStroke(ctx, s);
      }
    }
    ctx.restore();

    // Figuras y trazos
    ctx.save();
    if (page.shapes) {
      for (const sh of page.shapes) canvasEngine.drawShape(ctx, sh);
    }
    if (page.strokes) {
      for (const s of page.strokes) {
        if (!s.isHighlighter) canvasEngine.drawStroke(ctx, s);
      }
    }
    if (page.texts) {
      for (const t of page.texts) canvasEngine.drawText(ctx, t);
    }
    ctx.restore();
  }

  static escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
}
