/***********************************************
 * shared-constants.js
 * Catálogos compartidos entre admin y estudiante
 ***********************************************/

// Especialidades
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

// Dificultad
export const DIFFICULTIES = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

// Pesos de dificultad (para el cálculo ponderado)
export const DIFFICULTY_WEIGHTS = {
  baja: 1,
  media: 2,
  alta: 3,
};

// Valores por defecto globales (se pueden sobreescribir con examRules/default)
export const DEFAULT_MAX_ATTEMPTS = 3;        // intentos por examen de sección
export const DEFAULT_TIME_PER_QUESTION = 77;  // segundos por pregunta

// Opciones de número de preguntas para Mini Exámenes
export const MINI_EXAM_QUESTION_OPTIONS = [5, 10, 15, 20];
