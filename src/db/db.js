import Dexie from 'dexie';

export const db = new Dexie('GymTrackerDB');

db.version(1).stores({
  exercises: 'id, name, muscleGroup, isCustom', // id: string(uuid)
  routines: 'id, name', // exercises will be an array of objects inside the record
  workoutSessions: 'id, date, routineId',
  plannedSessions: 'id, date, routineId'
});

db.version(2).stores({
  exercises: 'id, name, muscleGroup, isCustom',
  routines: 'id, name',
  workoutSessions: 'id, date, routineId',
  plannedSessions: 'id, date, routineId',
  exerciseHistory: 'id, exerciseId, date, [exerciseId+date], workoutSessionId'
});

// Precargar base de datos con ejercicios comunes (solo se dispara una vez en la vida del usuario)
db.on('populate', async () => {
  await db.exercises.bulkAdd([
    { id: 'ex_1', name: 'Press de Banca', muscleGroup: 'Pecho', isCustom: false },
    { id: 'ex_2', name: 'Sentadilla', muscleGroup: 'Cuádriceps', isCustom: false },
    { id: 'ex_3', name: 'Peso Muerto', muscleGroup: 'Femoral', isCustom: false },
    { id: 'ex_4', name: 'Press Militar', muscleGroup: 'Hombro', isCustom: false },
    { id: 'ex_5', name: 'Curl Bíceps', muscleGroup: 'Bíceps', isCustom: false },
    { id: 'ex_6', name: 'Extensión Tríceps', muscleGroup: 'Tríceps', isCustom: false },
    { id: 'ex_7', name: 'Elevación Talones', muscleGroup: 'Gemelo', isCustom: false },
    { id: 'ex_8', name: 'Dominadas', muscleGroup: 'Espalda', isCustom: false },
    { id: 'ex_9', name: 'Hip Thrust', muscleGroup: 'Glúteo', isCustom: false },
    { id: 'ex_10', name: 'Crunch', muscleGroup: 'Abdomen', isCustom: false }
  ]);
});
