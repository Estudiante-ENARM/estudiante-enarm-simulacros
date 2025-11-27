/***********************************************
 * CONSTANTES COMPARTIDAS
 * Se usan en admin.js y student.js
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

// Pesos por dificultad (para ponderar la calificación)
export const DIFFICULTY_WEIGHTS = {
  baja: 1,
  media: 2,
  alta: 3,
};

// REGLAS POR DEFECTO PARA EXÁMENES
// Estas dos CONSTANTES son las que están fallando en tu error actual
export const DEFAULT_MAX_ATTEMPTS = 3;        // 3 intentos por examen
export const DEFAULT_TIME_PER_QUESTION = 77;  // 77 segundos por pregunta
 = [5, 10, 15, 20];

