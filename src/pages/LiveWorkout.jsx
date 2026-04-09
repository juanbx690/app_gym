import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { getRecommendedWeight, calculateEpley, getInterferenceState, normalizeMuscle } from '../utils/engine';
import { CheckCircle, X, ChevronRight, ChevronLeft, Save, FastForward, RefreshCw, Search } from 'lucide-react';

export default function LiveWorkout() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [routine, setRoutine] = useState(null);
  const [allExercises, setAllExercises] = useState([]);
  
  const [activeExIndex, setActiveExIndex] = useState(0);
  const [setsCompleted, setSetsCompleted] = useState([]);
  const [debugLoad, setDebugLoad] = useState('');
  const [activeMuscleState, setActiveMuscleState] = useState(0);
  
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapSearchTerm, setSwapSearchTerm] = useState('');
  
  // Para el set en curso
  const [currentWeight, setCurrentWeight] = useState('');
  const [currentReps, setCurrentReps] = useState('');
  const [recommendedWeight, setRecommendedWeight] = useState(null);
  const [debugRecom, setDebugRecom] = useState('');

  useEffect(() => {
    const loadSession = async () => {
      try {
        setDebugLoad('Iniciando carga...');
        const sessionId = localStorage.getItem('activeWorkoutSessionId');
        if (!sessionId) {
          setDebugLoad('No hay sessionId en localStorage');
          navigate('/');
          return;
        }
        
        setDebugLoad('Buscando session: ' + sessionId);
        const sess = await db.workoutSessions.get(sessionId);
        if (!sess) {
          setDebugLoad('Session no encontrada en DB');
          navigate('/');
          return;
        }

        setSession(sess);

        setDebugLoad('Buscando rutina: ' + sess.routineId);
        let r = await db.routines.get(sess.routineId);
        
        // Parche legacy: si el ID de la rutina se generó en el pasado como número y se está buscando como string
        if (!r && !isNaN(Number(sess.routineId))) {
          r = await db.routines.get(Number(sess.routineId));
        }

        if (!r) {
          setDebugLoad(`Falló get de Rutina. ID buscado: ${sess.routineId}`);
          return; // Dejamos que se quede en el render de "Cargando modo bestia..." para que el log sea visible
        }
        setRoutine(r);

        setDebugLoad('Cargando ejercicios');
        const ex = await db.exercises.toArray();
        setAllExercises(ex);
        
        setDebugLoad('Carga finalizada con éxito');
      } catch (err) {
        setDebugLoad('Error crítico: ' + err.message);
      }
    };

    loadSession();
  }, [navigate]);

  // Inicializador al cambiar de ejercicio
  useEffect(() => {
    if (routine && session && allExercises.length > 0) {
      setSetsCompleted([]);
      const initialTargetReps = routine.exercises[activeExIndex]?.sets?.[0]?.targetReps || '';
      setCurrentReps(initialTargetReps);
    }
  }, [activeExIndex, routine, session, allExercises.length]);

  // Recalculador dinámico para CADA serie individual
  useEffect(() => {
    if (routine && session && allExercises.length > 0) {
      calculateRecommendation();
    }
  }, [activeExIndex, routine, session, allExercises.length, setsCompleted.length]);

  const calculateRecommendation = async () => {
    const currentEx = routine.exercises[activeExIndex];
    const fullExInfo = allExercises.find(e => e.id === currentEx.exerciseId);
    if (!fullExInfo) return;

    // Buscar historial
    try {
      if (!currentEx || !currentEx.exerciseId) return;

      // Buscar historial EXACTO de este ejercicio
      const allHistories = await db.exerciseHistory.toArray(); // debug
      
      const history = allHistories.filter(h => h.exerciseId === currentEx.exerciseId);
      
      // Sort descendente (más reciente primero)
      const sortedHistory = history.sort((a, b) => new Date(b.date) - new Date(a.date));

      // Calcula fatiga real: primaria declarada + interferencia secundaria de otros grupos
      const primaryState = session.muscleStates?.[normalizeMuscle(fullExInfo.muscleGroup)] || 0;
      const interferenceState = getInterferenceState(fullExInfo.muscleGroup, session.muscleStates || {});
      const mState = Math.min(3, Math.max(primaryState, interferenceState));
      setActiveMuscleState(mState);
      
      // Averiguamos en qué serie estamos exactamente para leer sus Reps Objetivo
      const currentSetIndex = setsCompleted.length;
      const currentSetTargetReps = currentEx.sets?.[currentSetIndex]?.targetReps 
                                || currentEx.sets?.[currentEx.sets.length - 1]?.targetReps 
                                || 10;
      
      const recomendacion = getRecommendedWeight(
        sortedHistory,
        currentSetTargetReps,
        activeExIndex, // Order Index de hoy
        mState
      );

      setDebugRecom(`SetsListos: ${currentSetIndex}. Target Reps de esta serie: ${currentSetTargetReps}. e1RM: ${sortedHistory[0]?.e1RM?.toFixed(1) || 'NaN'}`);

      setRecommendedWeight(recomendacion);
      if (recomendacion) {
        setCurrentWeight(recomendacion);
      } else {
        setCurrentWeight('');
      }
    } catch (err) {
      console.error(err);
      setDebugRecom(`Error: ${err.message}`);
    }
  };

  const handleFinishSet = () => {
    if (!currentWeight || !currentReps) return;
    
    const currentEx = routine.exercises[activeExIndex];
    const targetRepsForThisSet = currentEx.sets?.[setsCompleted.length]?.targetReps || currentEx.sets?.[currentEx.sets.length - 1]?.targetReps;

    setSetsCompleted(prev => [...prev, {
      weight: parseFloat(currentWeight),
      reps: parseInt(currentReps),
      targetReps: targetRepsForThisSet
    }]);

    // Establecer target de reps para la siguiente serie, si la hay
    const nextSetIndex = setsCompleted.length + 1;
    if (nextSetIndex < currentEx.sets?.length) {
      setCurrentReps(currentEx.sets[nextSetIndex].targetReps);
    }
  };

  const handleFinishExercise = async () => {
    const currentEx = routine.exercises[activeExIndex];
    const fullExInfo = allExercises.find(e => e.id === currentEx.exerciseId);
    
    if (setsCompleted.length > 0) {
      // Calcular el mejor set (e1RM más alto)
      let bestSet = setsCompleted[0];
      let maxE1rm = calculateEpley(bestSet.weight, bestSet.reps);

      for (let s of setsCompleted) {
        const est = calculateEpley(s.weight, s.reps);
        if (est > maxE1rm) {
          maxE1rm = est;
          bestSet = s;
        }
      }

      const primaryState = session.muscleStates?.[normalizeMuscle(fullExInfo.muscleGroup)] || 0;
      const interferenceState = getInterferenceState(fullExInfo.muscleGroup, session.muscleStates || {});
      const mState = Math.min(3, Math.max(primaryState, interferenceState));
      
      // Guardar en exerciseHistory
      await db.exerciseHistory.add({
        id: crypto.randomUUID(),
        exerciseId: currentEx.exerciseId,
        workoutSessionId: session.id,
        date: new Date().toISOString(),
        orderIndex: activeExIndex,
        e1RM: maxE1rm,
        bestSetWeight: bestSet.weight,
        bestSetReps: bestSet.reps,
        targetReps: bestSet.targetReps,
        muscleState: mState,
        // Criterios de calidad. consideramos hit del target rep si se llegó o superó
        completedTargetReps: bestSet.reps >= bestSet.targetReps,
        wasProtectedSession: mState > 0 // Si estaba tocado, fue protegida
      });

      // Actualizar sesion con estos sets
      await db.workoutSessions.where('id').equals(session.id).modify(s => {
        if (!s.exercisesCompleted) s.exercisesCompleted = [];
        s.exercisesCompleted.push({
          exerciseId: currentEx.exerciseId,
          orderIndex: activeExIndex,
          sets: setsCompleted
        });
      });
    }

    // Avanzar
    if (activeExIndex < routine.exercises.length - 1) {
      setActiveExIndex(activeExIndex + 1);
    } else {
      // Finalizar Rutina
      await db.workoutSessions.where('id').equals(session.id).modify(s => {
        s.status = 'completed';
        s.endTime = new Date().toISOString();
      });
      localStorage.removeItem('activeWorkoutSessionId');
      navigate('/history');
    }
  };

  const handleSkipExercise = async () => {
    // Avanzar
    setSetsCompleted([]);
    setCurrentReps('');
    setCurrentWeight('');
    if (activeExIndex < routine.exercises.length - 1) {
      setActiveExIndex(activeExIndex + 1);
    } else {
      // Finalizar Rutina
      await db.workoutSessions.where('id').equals(session.id).modify(s => {
        s.status = 'completed';
        s.endTime = new Date().toISOString();
      });
      localStorage.removeItem('activeWorkoutSessionId');
      navigate('/history');
    }
  };

  const handleSwapExercise = (newExerciseId) => {
    const updatedExercises = [...routine.exercises];
    updatedExercises[activeExIndex] = {
      ...updatedExercises[activeExIndex],
      exerciseId: newExerciseId
    };
    setRoutine({ ...routine, exercises: updatedExercises });
    setSetsCompleted([]);
    setCurrentReps('');
    setCurrentWeight('');
    setIsSwapping(false);
    setSwapSearchTerm('');
  };

  const getWeightInputColor = () => {
    if (!currentWeight || !recommendedWeight) return 'border-neutral-800 text-white';
    if (parseFloat(currentWeight) === recommendedWeight) return 'border-teal-500 text-teal-400';
    if (parseFloat(currentWeight) < recommendedWeight) return 'border-yellow-500 text-yellow-500';
    return 'border-red-500 text-red-500';
  };

  if (!session || !routine || allExercises.length === 0) {
    return (
      <div className="p-8 text-center text-teal-500 flex flex-col items-center justify-center min-h-screen">
        <h2 className="text-xl font-bold mb-4">Cargando modo bestia...</h2>
        <p className="text-xs text-neutral-400 mb-2">Debug Info: {debugLoad}</p>
        <p className="text-xs text-neutral-500 break-words max-w-xs">
          Session: {session ? 'OK' : 'MIS'} | 
          Routine: {routine ? 'OK' : 'MIS'} | 
          Ejercicios: {allExercises.length}
        </p>
        <button onClick={() => navigate('/')} className="mt-8 border border-teal-500 px-4 py-2 rounded text-teal-500">Volver</button>
      </div>
    );
  }

  const currentExDef = routine.exercises[activeExIndex];
  const fullExInfo = allExercises.find(e => e.id === currentExDef.exerciseId);

  return (
    <div className="animate-fade-in fixed inset-0 bg-black z-[100] flex flex-col text-slate-100">
      {/* Header Live */}
      <div className="flex justify-between items-center p-4 border-b border-neutral-900 bg-neutral-950">
        <button onClick={() => navigate(-1)} className="p-2 text-neutral-400 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        <div className="text-center">
          <span className="text-[10px] text-teal-500 font-bold uppercase tracking-widest block">Live Workout</span>
          <span className="font-semibold text-sm">{routine.name}</span>
        </div>
        <div className="w-10"></div> {/* Spacer */}
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* Progreso */}
        <div className="flex space-x-1 p-4">
          {routine.exercises.map((_, i) => (
            <div 
              key={i} 
              className={`h-1.5 flex-1 rounded-full ${i < activeExIndex ? 'bg-teal-500' : i === activeExIndex ? 'bg-white' : 'bg-neutral-800'}`} 
            />
          ))}
        </div>

        {/* Ejercicio Actual Info */}
        <div className="px-6 py-4 flex-1 flex flex-col items-center">
          <span className="text-teal-500 font-bold uppercase tracking-widest text-xs mb-2">
            Ejercicio {activeExIndex + 1} de {routine.exercises.length}
          </span>
          <h2 className="text-3xl font-extrabold text-center mb-1 leading-tight">
            {fullExInfo?.name}
          </h2>
          <span className="text-neutral-500 text-sm mb-4">{fullExInfo?.muscleGroup}</span>

          {/* Action Buttons: Swap and Skip */}
          <div className="flex gap-4 w-full max-w-xs mb-8">
            <button 
              onClick={() => setIsSwapping(true)}
              className="flex-1 py-2 px-3 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col items-center justify-center text-teal-500 hover:bg-neutral-800 active:scale-95 transition-all"
            >
              <RefreshCw className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Sustituir</span>
            </button>
            <button 
              onClick={handleSkipExercise}
              className="flex-1 py-2 px-3 bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all"
            >
              <FastForward className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Saltar</span>
            </button>
          </div>

          {/* Engine Suggestion */}
          <div className="bg-teal-950/30 border border-teal-900/50 rounded-2xl w-full p-4 mb-8">
            <h4 className="text-teal-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center justify-center">
              Recomendación del Motor
            </h4>
            <div className="flex justify-center items-end items-baseline">
              {recommendedWeight ? (
                <>
                  <span className="text-4xl font-black text-white">{recommendedWeight}</span>
                  <span className="text-neutral-400 ml-1 font-medium">kg</span>
                </>
              ) : (
                <span className="text-neutral-500 italic text-sm">Sin historial. Inicia con un peso base.</span>
              )}
            </div>
            {activeMuscleState > 0 && (
              <p className="text-orange-400 text-[10px] text-center mt-2 uppercase font-bold">
                ⚠️ Carga reducida por protección
              </p>
            )}
            <p className="text-[9px] text-neutral-600 text-center mt-3 font-mono">{debugRecom}</p>
          </div>

          {/* Inputs de la serie */}
          <div className="flex gap-4 w-full mb-8">
            <div className="flex-1">
              <label className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-2 text-center">Peso Real (kg)</label>
              <input 
                type="number" 
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                className={`w-full bg-neutral-900 border-2 rounded-2xl text-center py-4 text-3xl font-bold focus:outline-none transition-colors ${getWeightInputColor()}`} 
                inputMode="decimal"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-neutral-500 uppercase tracking-widest block mb-2 text-center">
                Reps (Obj: {currentExDef?.sets?.[setsCompleted.length]?.targetReps || currentExDef?.sets?.[currentExDef?.sets?.length - 1]?.targetReps || '-'})
              </label>
              <input 
                type="number" 
                value={currentReps}
                onChange={(e) => setCurrentReps(e.target.value)}
                className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl text-center py-4 text-3xl font-bold focus:outline-none text-white" 
                inputMode="numeric"
              />
            </div>
          </div>

          <button 
            onClick={handleFinishSet}
            disabled={!currentWeight || !currentReps}
            className="w-full bg-white text-black font-extrabold py-5 rounded-2xl text-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
          >
            <CheckCircle className="mr-2" /> COMPLETAR SERIE
          </button>
        </div>

        {/* History of Sets Current Session */}
        <div className="px-6 py-4 border-t border-neutral-900 bg-neutral-950">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold">Series Completadas</span>
            <span className="text-xs text-neutral-500">{setsCompleted.length} / {currentExDef?.sets?.length || '-'}</span>
          </div>
          <div className="flex flex-col gap-2 mb-6">
            {setsCompleted.map((set, idx) => (
              <div key={idx} className="flex justify-between items-center bg-black border border-neutral-800 px-4 py-3 rounded-xl">
                <span className="text-neutral-500 text-sm font-bold">Set {idx + 1}</span>
                <div className="font-bold">
                  {set.weight} <span className="text-neutral-500 font-normal">kg</span> × {set.reps} <span className="text-neutral-500 font-normal">reps</span>
                </div>
              </div>
            ))}
            {setsCompleted.length === 0 && <p className="text-neutral-600 text-sm text-center italic py-2">Ninguna serie registrada aún</p>}
          </div>

          <button 
            onClick={handleFinishExercise}
            className="w-full border-2 border-teal-500 text-teal-400 font-bold py-4 rounded-xl flex items-center justify-center active:bg-teal-500/10"
          >
            Siguiente Ejercicio <ChevronRight className="ml-1" />
          </button>
        </div>
      </div>
      {/* Swap Modal */}
      {isSwapping && (
        <div className="fixed inset-0 bg-black/95 z-[110] flex flex-col animate-fade-in p-6">
          <div className="flex justify-between items-center mb-6 mt-4">
            <h2 className="text-2xl font-bold flex items-center">
              <RefreshCw className="text-teal-400 mr-3" /> Sustituir Ejercicio
            </h2>
            <button onClick={() => setIsSwapping(false)} className="text-neutral-500 p-2 border border-neutral-800 rounded-full">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Buscar alternativa..." 
              value={swapSearchTerm}
              onChange={(e) => setSwapSearchTerm(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-4 focus:outline-none focus:border-teal-500 transition-colors text-white text-lg"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pb-6">
            {allExercises
              .filter(ex => ex.name.toLowerCase().includes(swapSearchTerm.toLowerCase()) || ex.muscleGroup.toLowerCase().includes(swapSearchTerm.toLowerCase()))
              .map(ex => (
                <button
                  key={ex.id}
                  onClick={() => handleSwapExercise(ex.id)}
                  className="flex justify-between items-center bg-neutral-900 border border-neutral-800 p-4 rounded-xl text-left hover:border-teal-500/50 active:scale-[0.98] transition-all"
                >
                  <span className="font-bold text-lg">{ex.name}</span>
                  <span className="text-xs text-teal-500 uppercase tracking-widest font-bold">{ex.muscleGroup}</span>
                </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
