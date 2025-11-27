/***********************************************
 * CONSTANTES COMPARTIDAS
 * Usadas por admin.js y student.js
 ***********************************************/

// Especialidades
export const SPECIALTIES = {
  medicina_interna: "Medicina interna",
  pediatria: "Pediatría",
  gine_obstetricia: "Ginecología y Obstetricia",
  cirugia_general: "Cirugía general",
};

// Subtipos de pregunta
export const SUBTYPES = {
  salud_publica: "Salud pública",
  medicina_familiar: "Medicina familiar",
  urgencias: "Urgencias",
};

// Dificultades
export const DIFFICULTIES = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

// Pesos por dificultad (para ponderar calificación)
export const DIFFICULTY_WEIGHTS = {
  baja: 1,
  media: 2,
  alta: 3,
};

// ==== REGLAS POR DEFECTO PARA EXÁMENES ====

// Lo que usa student.js directamente
export const DEFAULT_MAX_ATTEMPTS = 3;        // intentos por examen
export const DEFAULT_TIME_PER_QUESTION = 77;  // segundos por pregunta

// Lo que está importando admin.js (objeto agrupado)
export const DEFAULT_EXAM_RULES = {
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  timePerQuestionSeconds: DEFAULT_TIME_PER_QUESTION,
};

// Opciones de número de preguntas para mini-exámenes (student.js)
export const MINI_EXAM_QUESTION_OPTIONS = [5, 10, 15, 20];

// ==== MAPAS DE ETIQUETAS (para tablas y metadatos en student.js) ====
// Son simplemente alias de los objetos anteriores, pero con nombres
// más claros para usarlos en las tablas de resultados.

export const SPECIALTY_LABELS = SPECIALTIES;

export const SUBTYPE_LABELS = SUBTYPES;

export const DIFFICULTY_LABELS = DIFFICULTIES;
