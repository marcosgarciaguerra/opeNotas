// js/editor/htr-worker.js - Web Worker para reconocimiento y predicción HTR offline (Handwriting-to-Text)

// Diccionario enriquecido en Español para notas, estudio y escritura general
const SPANISH_DICTIONARY = [
  // Notas y educación
  "hola", "nota", "notas", "apuntes", "tarea", "examen", "resumen", "cuaderno", "pizarra", "libro",
  "tema", "clase", "estudio", "profesor", "alumno", "estudiante", "dibujo", "figura", "esquema", "mapa",
  "texto", "linea", "color", "pagina", "ejemplo", "conclusion", "introduccion", "indice", "titulo", "subtitulo",
  "definicion", "formula", "teorema", "practica", "proyecto", "entrega", "fecha", "duda", "pregunta", "respuesta",
  "importante", "atencion", "revisar", "pendiente", "completado", "objetivo", "metodo", "analisis", "resultado",
  
  // Asignaturas
  "matematicas", "fisica", "quimica", "biologia", "historia", "geografia", "lengua", "literatura", "filosofia",
  "ingles", "frances", "economia", "derecho", "arte", "musica", "tecnologia", "informatica", "programacion",
  "calculo", "algebra", "geometria", "estadistica", "medicina", "psicologia",

  // Sustantivos comunes
  "casa", "tiempo", "año", "dia", "noche", "vida", "cosa", "mundo", "forma", "manera", "parte", "lugar",
  "agua", "fuego", "tierra", "aire", "sol", "luna", "ojo", "mano", "cabeza", "cuerpo", "ciudad", "pais",
  "pueblo", "calle", "camino", "nombre", "palabra", "letra", "punto", "numero", "semana", "mes", "hora",
  "minuto", "segundo", "amigo", "familia", "trabajo", "escuela", "universidad", "instituto", "idea", "verdad",

  // Verbos comunes
  "hacer", "tener", "estar", "saber", "decir", "poder", "poner", "ver", "dar", "ir", "querer", "llegar",
  "pasar", "deber", "parecer", "quedar", "creer", "hablar", "llevar", "dejar", "seguir", "encontrar", "llamar",
  "venir", "pensar", "salir", "volver", "tomar", "conocer", "vivir", "sentir", "tratar", "mirar", "contar",
  "empezar", "esperar", "buscar", "existir", "entrar", "trabajar", "escribir", "perder", "producir", "ocurrir",
  "entender", "pedir", "recibir", "recordar", "terminar", "permitir", "aparecer", "conseguir", "comenzar", "servir",
  "sacar", "necesitar", "mantener", "resultar", "leer", "caer", "cambiar", "presentar", "crear", "abrir"
];

// Estructura Trie de prefijos para búsqueda O(k) ultrarrápida
class TrieNode {
  constructor() {
    this.children = {};
    this.isWord = false;
    this.frequency = 0;
  }
}

class PrefixTrie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word, freq = 1) {
    let node = this.root;
    for (const ch of word.toLowerCase()) {
      if (!node.children[ch]) {
        node.children[ch] = new TrieNode();
      }
      node = node.children[ch];
    }
    node.isWord = true;
    node.frequency = freq;
  }

  searchPrefix(prefix, maxResults = 5) {
    let node = this.root;
    for (const ch of prefix.toLowerCase()) {
      if (!node.children[ch]) return [];
      node = node.children[ch];
    }

    const results = [];
    this._collectWords(node, prefix.toLowerCase(), results, maxResults);
    return results;
  }

  _collectWords(node, currentWord, results, maxResults) {
    if (results.length >= maxResults) return;
    if (node.isWord) {
      results.push({ word: currentWord, freq: node.frequency });
    }
    for (const ch of Object.keys(node.children)) {
      this._collectWords(node.children[ch], currentWord + ch, results, maxResults);
    }
  }
}

// Inicializar Trie global
const trie = new PrefixTrie();
SPANISH_DICTIONARY.forEach((w, idx) => {
  trie.insert(w, SPANISH_DICTIONARY.length - idx);
});

// Analizador geométrico de trazos
function analyzeStrokes(strokes, bbox) {
  if (!strokes || strokes.length === 0) return { detected: '', suggestions: [] };

  const width = Math.max(1, bbox.maxX - bbox.minX);
  const height = Math.max(1, bbox.maxY - bbox.minY);
  const aspectRatio = width / height;
  const strokeCount = strokes.length;

  let totalPoints = 0;
  let totalLength = 0;
  let loopCount = 0;
  let verticalTransitions = 0;
  let horizontalCrossings = 0;

  const midY = (bbox.minY + bbox.maxY) / 2;
  const midX = (bbox.minX + bbox.maxX) / 2;

  // Extraer características morfológicas
  for (const s of strokes) {
    const pts = s.points || [];
    totalPoints += pts.length;
    if (pts.length < 2) continue;

    for (let i = 1; i < pts.length; i++) {
      const p1 = pts[i - 1];
      const p2 = pts[i];
      totalLength += Math.hypot(p2.x - p1.x, p2.y - p1.y);

      // Cruces con la línea media horizontal y vertical
      if ((p1.y < midY && p2.y >= midY) || (p1.y >= midY && p2.y < midY)) {
        verticalTransitions++;
      }
      if ((p1.x < midX && p2.x >= midX) || (p1.x >= midX && p2.x < midX)) {
        horizontalCrossings++;
      }
    }

    // Detección simple de bucles (loop detection)
    if (pts.length >= 8) {
      const pStart = pts[0];
      const pEnd = pts[pts.length - 1];
      if (Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y) < height * 0.35) {
        loopCount++;
      }
    }
  }

  // Estimar longitud de caracteres según ancho y aspect ratio
  const estimatedCharCount = Math.max(2, Math.min(14, Math.round(aspectRatio * 1.6)));

  // Búsqueda en el diccionario puntuando compatibilidad
  const scoredWords = [];

  for (const word of SPANISH_DICTIONARY) {
    const lenDiff = Math.abs(word.length - estimatedCharCount);
    let score = 100 - lenDiff * 18;

    // Bonificación por relación de aspecto congruente
    const expectedRatio = word.length * 0.55;
    const ratioDiff = Math.abs(aspectRatio - expectedRatio);
    score -= ratioDiff * 10;

    // Ajuste por número de trazos (palabras largas o con tildes/cruces)
    if (strokeCount > 1 && word.length >= strokeCount) {
      score += 10;
    }

    // Ajuste por loops (letras 'o', 'a', 'e', 'g', 'b', 'd', 'p', 'q')
    const wordLoopEstimate = (word.match(/[oabdegpq]/gi) || []).length;
    if (loopCount > 0 && wordLoopEstimate > 0) {
      score += 12;
    }

    scoredWords.push({ word, score });
  }

  scoredWords.sort((a, b) => b.score - a.score);

  const topSuggestions = scoredWords.slice(0, 3).map(item => item.word);
  const detectedWord = topSuggestions[0] || 'nota';

  return {
    detected: detectedWord,
    suggestions: topSuggestions
  };
}

// Listener de mensajes en segundo plano
self.onmessage = function(e) {
  const data = e.data;
  if (!data) return;

  if (data.action === 'analyze_strokes') {
    const { wordStrokes, bbox, strokeIds } = data;
    const result = analyzeStrokes(wordStrokes, bbox);

    self.postMessage({
      action: 'htr_result',
      palabraDetectada: result.detected,
      sugerencias: result.suggestions,
      bbox: bbox,
      strokeIds: strokeIds
    });
  }
};

