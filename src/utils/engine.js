export const ENGINE_CONFIG = {
  // Ponderación de e1RM (sesión más reciente a la más antigua)
  historicalWeights: [0.5, 0.3, 0.2],

  // Penalización por fatiga de orden
  fatiguePenalty: 0.025,

  // Modificadores por estado muscular
  // 0: Fresco | 1: Leve | 2: Medio | 3: Tocado fuerte
  statePenalties: {
    0: 1.00,
    1: 0.95,
    2: 0.90,  // era 0.85 → ahora -10% (más realista para fatiga media)
    3: 0.80,  // ajustado para que el statePenalty sea coherente con el clamp normal
  },

  // Clamp normal: límite de variación entre sesiones (estados 0, 1, 2)
  maxIncreaseFactor: 1.05,
  maxDecreaseFactor: 0.80,

  // Clamp especial para estado 3 "Tocado fuerte":
  // Permite bajar más allá del -20% cuando el usuario marca el músculo como muy tocado.
  // Solo se activa si muscleState === 3.
  maxProtectedDecreaseFactor: 0.65,

  // Paso de redondeo global (discos de gimnasio estándar)
  // TODO: En el futuro este valor podrá ser sobreescrito a nivel de ejercicio
  // (ej: mancuernas ligeras → 1kg, barra olímpica → 2.5kg)
  roundingStep: 2.5,
};

/**
 * Normaliza un nombre de grupo muscular a la clave interna del motor:
 * minúsculas, sin tildes. Ej: 'Pecho' → 'pecho', 'Bíceps' → 'biceps'
 */
export function normalizeMuscle(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // quita tildes/diacríticos
}

/**
 * Mapa de interferencia muscular.
 * Clave: muscleGroup principal (tal como está guardado en db.exercises).
 * Valor: qué otros grupos musculares se ven secundariamente afectados y cuánto.
 * 
 * Regla: NO se usa el nombre del ejercicio, siempre el muscleGroup.
 * Esto evita falsos positivos (ej: femoral no hereda de espalda aunque
 * deadlift use espalda, porque el curl femoral no tiene nada que ver).
 */
export const MUSCLE_INTERFERENCE = {
  pecho: {
    primary: 'pecho',
    secondary: [
      { muscle: 'hombro',  weight: 0.60 },
      { muscle: 'triceps', weight: 0.50 },
      { muscle: 'biceps',  weight: 0.10 },
    ]
  },
  espalda: {
    primary: 'espalda',
    secondary: [
      { muscle: 'biceps',  weight: 0.55 },
      { muscle: 'hombro',  weight: 0.25 },
      { muscle: 'triceps', weight: 0.10 },
    ]
  },
  hombro: {
    primary: 'hombro',
    secondary: [
      { muscle: 'triceps', weight: 0.40 },
      { muscle: 'pecho',   weight: 0.20 },
      { muscle: 'biceps',  weight: 0.10 },
    ]
  },
  biceps: {
    primary: 'biceps',
    secondary: [
      { muscle: 'hombro',  weight: 0.10 },
    ]
  },
  triceps: {
    primary: 'triceps',
    secondary: [
      { muscle: 'hombro',  weight: 0.35 },
      { muscle: 'pecho',   weight: 0.25 },
      { muscle: 'biceps',  weight: 0.05 },
    ]
  },
  cuadriceps: {
    primary: 'cuadriceps',
    secondary: [
      { muscle: 'gluteo',     weight: 0.50 },
      { muscle: 'femoral',    weight: 0.30 },
      { muscle: 'gemelo',     weight: 0.10 },
    ]
  },
  femoral: {
    primary: 'femoral',
    secondary: [
      { muscle: 'gluteo',     weight: 0.50 },
      { muscle: 'cuadriceps', weight: 0.10 },
      // ⚠️ espalda no incluida intencionalmente:
      // evita falsos positivos en ejercicios aislados como curl femoral.
    ]
  },
  gluteo: {
    primary: 'gluteo',
    secondary: [
      { muscle: 'femoral',    weight: 0.40 },
      { muscle: 'cuadriceps', weight: 0.20 },
    ]
  },
  gemelo: {
    primary: 'gemelo',
    secondary: [
      { muscle: 'cuadriceps', weight: 0.05 },
      { muscle: 'femoral',    weight: 0.05 },
    ]
  },
};

/**
 * Dado un muscleGroup que se va a entrenar HOY y un mapa de estados musculares actuales
 * (muscleStates: { pecho: 0, hombro: 2, ... }), calcula el score de fatiga acumulada
 * por interferencia secundaria.
 * 
 * @param {string} primaryMuscle - Grupo muscular del ejercicio que se va a hacer ahora.
 * @param {Object} muscleStates  - Estado actual de cada músculo { muscleGroup: 0|1|2|3 }.
 * @returns {number} - Score de fatiga secundaria [0, 3]. Puede usarse como muscleStateToday.
 */
export function getInterferenceState(primaryMuscle, muscleStates) {
  const key = normalizeMuscle(primaryMuscle);
  const config = MUSCLE_INTERFERENCE[key];
  if (!config) return 0;

  let interferenceScore = 0;

  for (const { muscle, weight } of config.secondary) {
    // Buscar en muscleStates normalizando la clave
    const stateKey = Object.keys(muscleStates).find(
      k => normalizeMuscle(k) === muscle
    );
    const state = stateKey ? (muscleStates[stateKey] || 0) : 0;
    interferenceScore += state * weight;
  }

  return Math.min(3, Math.round(interferenceScore));
}

/**
 * Calcula el e1RM usando la fórmula de Epley.
 */
export const calculateEpley = (weight, reps) => {
  return weight * (1 + reps / 30);
};

/**
 * Revierte el e1RM al peso teórico para el número de reps objetivo.
 */
export const reverseEpley = (e1rm, targetReps) => {
  return e1rm / (1 + targetReps / 30);
};

/**
 * Redondea al disco físico más cercano.
 */
export const roundToGymStep = (weight) => {
  return Math.round(weight / ENGINE_CONFIG.roundingStep) * ENGINE_CONFIG.roundingStep;
};

/**
 * Calcula el peso recomendado basándose en la historia y el contexto del día.
 * 
 * @param {Array} historyRecords - Array de objetos ExerciseHistory filtrados (recientes primero).
 * @param {Number} targetRepsToday - Repeticiones objetivo del ejercicio de hoy.
 * @param {Number} orderIndexToday - Orden del ejercicio en la sesión de hoy (0, 1, 2...).
 * @param {Number} muscleStateToday - Estado muscular de hoy (0,1,2,3).
 * @returns {Number|null} - Peso sugerido redondeado, o null si no hay datos.
 */
export function getRecommendedWeight(historyRecords, targetRepsToday, orderIndexToday, muscleStateToday) {
  // 1. En lugar de filtrar sesiones fallidas, las tomamos todas
  // Si el usuario falló las targetReps, su e1RM de ese día será más bajo y le ayudará a ajustar la carga.
  if (historyRecords.length === 0) return null;

  // Tomamos hasta las N configuradas en los pesos
  const maxSessions = ENGINE_CONFIG.historicalWeights.length;
  const recentSessions = historyRecords.slice(0, maxSessions);

  // 2. Calcular e1RM Histórico Ponderado
  let totalWeightFactor = 0;
  let weightedE1RM = 0;
  let sumHistoricOrder = 0;

  recentSessions.forEach((session, idx) => {
    // Si hay menos sesiones que pesos en config, reescalamos la importancia
    let weight = ENGINE_CONFIG.historicalWeights[idx] || 0;
    
    // Si sólo hay 1 sesión, el weight pasa a ser 1.0
    if (recentSessions.length === 1) weight = 1.0;
    // Si hay 2 sesiones, podríamos usar 0.5 y 0.3 normalizados (5/8 y 3/8)
    else if (recentSessions.length < maxSessions) {
      const sumConfigWeights = ENGINE_CONFIG.historicalWeights.slice(0, recentSessions.length).reduce((a, b) => a + b, 0);
      weight = weight / sumConfigWeights;
    }

    weightedE1RM += session.e1RM * weight;
    totalWeightFactor += weight;
    sumHistoricOrder += session.orderIndex * weight;
  });

  // 3. Peso Base Teórico para hoy (Inversa Epley)
  const baseWeightToday = reverseEpley(weightedE1RM, targetRepsToday);

  // 4. Multiplicador de Fatiga
  // Si hoy lo hago más tardío (>), me penaliza. Si se hace antes (<), no beneficiamos mágicamente, asumimos base.
  let difFila = orderIndexToday - sumHistoricOrder;
  if (difFila < 0) difFila = 0; 
  const fatigueMultiplier = 1 - (difFila * ENGINE_CONFIG.fatiguePenalty);

  // 5. Multiplicador por Estado Muscular
  const stateMultiplier = ENGINE_CONFIG.statePenalties[muscleStateToday] || 1.0;

  // 6. Aplicar multiplicadores
  let suggestedWeight = baseWeightToday * fatigueMultiplier * stateMultiplier;

  // 7. Clamp de Seguridad sobre la sesión MÁS RECIENTE como referente
  const latestSessionBaseWeight = reverseEpley(recentSessions[0].e1RM, targetRepsToday);
  const ceiling = latestSessionBaseWeight * ENGINE_CONFIG.maxIncreaseFactor;

  // Si el músculo está "Tocado fuerte" (estado 3), usamos el clamp protegido especial
  // que permite bajar hasta un -35% sin bloquearlo en -20%
  const activeDecreaseClamp = muscleStateToday === 3
    ? ENGINE_CONFIG.maxProtectedDecreaseFactor
    : ENGINE_CONFIG.maxDecreaseFactor;
  const floor = latestSessionBaseWeight * activeDecreaseClamp;

  if (suggestedWeight > ceiling) suggestedWeight = ceiling;
  if (suggestedWeight < floor) suggestedWeight = floor;

  // 8. Redondear con el paso global (en el futuro: override por ejercicio)
  const step = ENGINE_CONFIG.roundingStep; // TODO: reemplazar por exerciseConfig?.roundingStep ?? ENGINE_CONFIG.roundingStep
  return Math.round(suggestedWeight / step) * step;
}
