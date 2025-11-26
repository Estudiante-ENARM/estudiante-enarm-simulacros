/***********************************************
 * shared-constants.js
 * Constantes compartidas (admin + estudiante)
 ***********************************************/

// Especialidades principales ENARM
export const SPECIALTIES = {
  medicina_interna: "Medicina interna",
  cirugia_general: "Cirugía general",
  pediatria: "Pediatría",
  gine_obstetricia: "Ginecología y obstetricia"
};

// Subtipos de pregunta
export const SUBTYPES = {
  salud_publica: "Salud pública",
  medicina_familiar: "Medicina familiar",
  urgencias: "Urgencias"
};

// Dificultades y etiquetas
export const DIFFICULTIES = {
  baja: "Baja",
  media: "Media",
  alta: "Alta"
};

// Peso de cada dificultad (para puntaje ponderado)
export const DIFFICULTY_WEIGHTS = {
  baja: 1,   // 1 punto
  media: 2,  // 2 puntos
  alta: 3    // 3 puntos
};
