// js/editor/coverDesigner.js - Diseñador y renderizador de portadas para Cuadernos Digitales
export class CoverDesigner {
  static TEMPLATES = {
    moleskine: {
      name: 'Moleskine Clásica',
      bg: '#0f172a',
      accent: '#3b82f6',
      textColor: '#ffffff',
      subtextColor: '#94a3b8'
    },
    leather: {
      name: 'Cuero Rústico',
      bg: '#78350f',
      accent: '#d97706',
      textColor: '#fef3c7',
      subtextColor: '#fde68a'
    },
    minimal: {
      name: 'Minimalista Blanco',
      bg: '#ffffff',
      accent: '#2563eb',
      textColor: '#0f172a',
      subtextColor: '#64748b'
    },
    pastel: {
      name: 'Tonos Pastel Menta',
      bg: '#ecfdf5',
      accent: '#10b981',
      textColor: '#064e3b',
      subtextColor: '#047857'
    },
    custom: {
      name: 'Imagen Personalizada',
      bg: '#1e293b',
      accent: '#38bdf8',
      textColor: '#ffffff',
      subtextColor: '#e2e8f0'
    }
  };

  static renderCover(ctx, width, height, coverData = {}) {
    const templateKey = coverData.template || 'moleskine';
    const tmpl = this.TEMPLATES[templateKey] || this.TEMPLATES.moleskine;
    const title = coverData.title || 'Mi Cuaderno';
    const subtitle = coverData.subtitle || 'Notas y Apuntes';
    const date = coverData.date || new Date().getFullYear().toString();
    const bgColor = coverData.color || tmpl.bg;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Fondo base de la portada
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Si hay imagen personalizada de fondo
    if (coverData.customImage && coverData._imgElement && coverData._imgElement.complete) {
      ctx.drawImage(coverData._imgElement, 0, 0, width, height);
      // Capa de oscurecimiento para legibilidad
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.fillRect(0, 0, width, height);
    }

    if (templateKey === 'moleskine') {
      // Banda elástica derecha
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(width - 50, 0, 24, height);

      // Lomo izquierdo
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(0, 0, 36, height);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(36, 0);
      ctx.lineTo(36, height);
      ctx.stroke();

      // Etiqueta centrada clásica
      const labelW = Math.min(width * 0.72, 480);
      const labelH = 220;
      const labelX = (width - labelW) / 2 + 10;
      const labelY = height * 0.32;

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(labelX, labelY, labelW, labelH);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(labelX, labelY, labelW, labelH);

      // Marco interior
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(labelX + 8, labelY + 8, labelW - 16, labelH - 16);

      // Textos de la etiqueta
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 28px "Georgia", serif';
      ctx.fillText(title, labelX + labelW / 2, labelY + 70);

      ctx.font = '16px "Georgia", serif';
      ctx.fillStyle = '#475569';
      ctx.fillText(subtitle, labelX + labelW / 2, labelY + 120);

      ctx.font = 'italic 14px "Georgia", serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(date, labelX + labelW / 2, labelY + 165);

    } else if (templateKey === 'leather') {
      // Pespunte / costura en los bordes
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(20, 20, width - 40, height - 40);
      ctx.setLineDash([]);

      // Marco dorado central
      const boxW = Math.min(width * 0.75, 520);
      const boxH = 240;
      const boxX = (width - boxW) / 2;
      const boxY = height * 0.3;

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.strokeRect(boxX, boxY, boxW, boxH);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 32px "Times New Roman", serif';
      ctx.fillText(title.toUpperCase(), width / 2, boxY + 80);

      ctx.font = '18px "Times New Roman", serif';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(subtitle, width / 2, boxY + 135);

      ctx.font = 'italic 15px "Times New Roman", serif';
      ctx.fillStyle = '#d97706';
      ctx.fillText(date, width / 2, boxY + 185);

    } else if (templateKey === 'minimal' || templateKey === 'pastel') {
      // Franja de acento superior
      ctx.fillStyle = tmpl.accent;
      ctx.fillRect(0, 0, width, 12);

      // Acento geométrico lateral
      ctx.fillRect(50, height * 0.28, 6, 120);

      ctx.textAlign = 'left';
      ctx.fillStyle = tmpl.textColor;
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(title, 72, height * 0.33);

      ctx.fillStyle = tmpl.subtextColor;
      ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(subtitle, 72, height * 0.38);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(date, 72, height * 0.44);

    } else {
      // Personalizada / Foto
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(title, width / 2, height * 0.4);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(subtitle, width / 2, height * 0.46);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(date, width / 2, height * 0.52);
    }

    ctx.restore();
  }

  static generateCoverThumbnail(coverData, thumbW = 280, thumbH = 390) {
    const canvas = document.createElement('canvas');
    canvas.width = thumbW;
    canvas.height = thumbH;
    const ctx = canvas.getContext('2d');
    this.renderCover(ctx, thumbW, thumbH, coverData);
    return canvas.toDataURL('image/jpeg', 0.88);
  }

  static renderPaperPreview(ctx, width, height, pattern = 'ruled', paperColor = '#ffffff') {
    ctx.save();
    ctx.fillStyle = paperColor || '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const isDarkPaper = paperColor === '#1e293b' || paperColor === '#0f172a';

    if (pattern === 'ruled') {
      ctx.strokeStyle = isDarkPaper ? 'rgba(255, 255, 255, 0.2)' : '#cbd5e1';
      ctx.lineWidth = 1;
      const lineGap = Math.max(10, Math.round(height / 28));
      const topMargin = Math.round(height * 0.12);

      for (let y = topMargin; y < height; y += lineGap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      ctx.strokeStyle = isDarkPaper ? 'rgba(248, 113, 113, 0.45)' : '#fca5a5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const marginX = Math.round(width * 0.1);
      ctx.moveTo(marginX, 0);
      ctx.lineTo(marginX, height);
      ctx.stroke();

    } else if (pattern === 'grid') {
      ctx.strokeStyle = isDarkPaper ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0';
      ctx.lineWidth = 1;
      const gap = Math.max(8, Math.round(width / 24));

      for (let x = 0; x <= width; x += gap) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += gap) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

    } else if (pattern === 'dots') {
      ctx.fillStyle = isDarkPaper ? 'rgba(255, 255, 255, 0.3)' : '#94a3b8';
      const gap = Math.max(10, Math.round(width / 18));
      for (let x = gap; x < width; x += gap) {
        for (let y = gap; y < height; y += gap) {
          ctx.beginPath();
          ctx.arc(x, y, 1.25, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }
}


