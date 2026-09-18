const canvas = document.getElementById('paintCanvas');
    const ctx = canvas.getContext('2d');
    const formatSelect = document.getElementById('formatSelect');
    const btnPen = document.getElementById('btnPen');
    const btnEraser = document.getElementById('btnEraser');
    const strokeColor = document.getElementById('strokeColor');
    const strokeWidth = document.getElementById('strokeWidth');
    const btnClear = document.getElementById('btnClear');
    const btnExportPdf = document.getElementById('btnExportPdf');

    // Dimensiones estándar (A4 a ~96 DPI: 794 x 1123 px)
    const FORMATS = {
      a4: { width: 794, height: 1123 },
      board: { width: 1600, height: 1000 }
    };

    let isDrawing = false;
    let mode = 'pen'; // 'pen' o 'eraser'
    let lastX = 0;
    let lastY = 0;

    // Configurar resolución del lienzo
    function setCanvasSize(formatKey) {
      const { width, height } = FORMATS[formatKey];
      
      // Guardar contenido existente antes de redimensionar
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);

      // Cambiar dimensiones
      canvas.width = width;
      canvas.height = height;

      // Restaurar estilos de línea por defecto
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Restaurar dibujo previo
      ctx.drawImage(tempCanvas, 0, 0);
    }

    setCanvasSize('a4');

    formatSelect.addEventListener('change', (e) => {
      setCanvasSize(e.target.value);
    });

    // Herramientas
    btnPen.addEventListener('click', () => {
      mode = 'pen';
      btnPen.classList.add('active');
      btnEraser.classList.remove('active');
    });

    btnEraser.addEventListener('click', () => {
      mode = 'eraser';
      btnEraser.classList.add('active');
      btnPen.classList.remove('active');
    });

    btnClear.addEventListener('click', () => {
      if (confirm('¿Deseas borrar todo el contenido actual?')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    // Gestión de eventos con PointerEvents (ratón, lápiz y dedo táctil)
    function getCanvasCoordinates(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }

    canvas.addEventListener('pointerdown', (e) => {
      isDrawing = true;
      const coords = getCanvasCoordinates(e);
      lastX = coords.x;
      lastY = coords.y;
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isDrawing) return;

      const coords = getCanvasCoordinates(e);

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(coords.x, coords.y);

      if (mode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = Number(strokeWidth.value) * 3;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = strokeColor.value;
        ctx.lineWidth = Number(strokeWidth.value);
      }

      ctx.stroke();

      lastX = coords.x;
      lastY = coords.y;
    });

    function stopDrawing() {
      isDrawing = false;
    }

    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointerleave', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);

    // Exportación a PDF con jsPDF
    btnExportPdf.addEventListener('click', () => {
      const { jsPDF } = window.jspdf;
      
      // Crear un lienzo temporal blanco para asegurar fondo no transparente al exportar
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const expCtx = exportCanvas.getContext('2d');

      expCtx.fillStyle = '#ffffff';
      expCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      expCtx.drawImage(canvas, 0, 0);

      const imgData = exportCanvas.toDataURL('image/jpeg', 0.95);
      
      const isA4 = formatSelect.value === 'a4';
      const pdf = new jsPDF({
        orientation: isA4 ? 'portrait' : 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`nota_${new Date().toISOString().slice(0, 10)}.pdf`);
    });