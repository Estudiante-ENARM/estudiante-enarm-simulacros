// shared-constants.js
// --------------------------------------------
// Constantes compartidas para ADMIN y STUDENT
// --------------------------------------------

// Especialidades principales
export const SPECIALTIES = {
  medicina_interna: "Medicina interna",
  cirugia_general: "Cirugía general",
  pediatria: "Pediatría",
  gine_obstetricia: "Ginecología y obstetricia",
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

// Peso de cada dificultad (para la calificación ponderada)
export const DIFFICULTY_WEIGHTS = {
  baja: 1,
  media: 2,
  alta: 3,
};

// Valores por defecto para reglas de exámenes
export const DEFAULT_EXAM_RULES = {
  maxAttempts: 3,
  timePerQuestionSeconds: 77,
};
