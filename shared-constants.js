/***********************************************
 * CONSTANTES COMPARTIDAS (ADMIN / STUDENT)
 ***********************************************/

// Especialidades ENARM
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

// Peso de cada dificultad para el cálculo ponderado
export const DIFFICULTY_WEIGHTS = {
  baja: 1,   // 1 punto
  media: 2,  // 2 puntos
  alta: 3,   // 3 puntos
};

// Reglas por defecto de los exámenes
// (si no existe el doc en examRules lo usamos como respaldo)
export const DEFAULT_EXAM_RULES = {
  maxAttempts: 3,
  timePerQuestionSeconds: 77, // cada pregunta 77 segundos
};
