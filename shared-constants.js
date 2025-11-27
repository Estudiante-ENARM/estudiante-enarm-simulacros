/***********************************************
 * CONSTANTES COMPARTIDAS ADMIN / STUDENT
 * Estudiante ENARM – Simulacros
 ***********************************************/

// Especialidades usadas en preguntas y reportes
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

// Dificultad
export const DIFFICULTIES = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};

// Peso de cada dificultad para el puntaje ponderado
export const DIFFICULTY_WEIGHTS = {
  baja: 1,
  media: 2,
  alta: 3,
};

// Intentos máximos por examen (valor por defecto)
export const DEFAULT_MAX_ATTEMPTS = 3;

// Tiempo por pregunta en segundos (valor por defecto)
export const DEFAULT_TIME_PER_QUESTION = 77;

// Tamaños permitidos para mini-exámenes
export const MINI_EXAM_ALLOWED_QUESTION_COUNTS = [5, 10, 15, 20];

