import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Activity, X, Dumbbell } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);
  const [muscleStates, setMuscleStates] = useState({});
  
  const routines = useLiveQuery(() => db.routines.toArray());
  const todayPlanned = useLiveQuery(() => {
    const today = new Date().toISOString().split('T')[0];
    return db.plannedSessions.where({ date: today }).first();
  });

  const activeRoutine = routines?.find(r => r.id === todayPlanned?.routineId);

  const handleMuscleClick = (muscle) => {
    setMuscleStates(prev => {
      const current = prev[muscle] || 0;
      const next = current === 3 ? 0 : current + 1;
      return { ...prev, [muscle]: next };
    });
  };

  const getStateColor = (state) => {
    if (state === 1) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    if (state === 2) return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
    if (state === 3) return 'bg-red-500/20 text-red-500 border-red-500/50';
    return 'bg-neutral-900 text-neutral-400 border-neutral-800';
  };

  const getStateLabel = (state) => {
    if (state === 1) return 'Leve';
    if (state === 2) return 'Medio';
    if (state === 3) return 'Tocado';
    return 'Fresco';
  };

  const startWorkout = async () => {
    if (!activeRoutine) return;
    
    let exists = await db.routines.get(activeRoutine.id);
    if (!exists && !isNaN(Number(activeRoutine.id))) {
      exists = await db.routines.get(Number(activeRoutine.id));
    }
    
    if (!exists) {
      alert("La rutina planificada ya no existe. Revisa tu calendario.");
      setIsCheckinOpen(false);
      return;
    }

    const sessionId = crypto.randomUUID();
    
    // Crear la sesión activa en db.workoutSessions
    await db.workoutSessions.add({
      id: sessionId,
      date: new Date().toISOString(),
      routineId: activeRoutine.id,
      muscleStates: muscleStates, 
      status: 'active',
      exercisesCompleted: []
    });

    // Guardar ID en localStorage o navegar pasando estado
    localStorage.setItem('activeWorkoutSessionId', sessionId);
    navigate('/workout');
  };

  const muscleGroups = [
    { key: 'pecho',      label: 'Pecho'      },
    { key: 'espalda',    label: 'Espalda'    },
    { key: 'hombro',     label: 'Hombro'     },
    { key: 'cuadriceps', label: 'Cuádriceps' },
    { key: 'femoral',    label: 'Femoral'    },
    { key: 'biceps',     label: 'Bíceps'     },
    { key: 'triceps',    label: 'Tríceps'    },
    { key: 'gluteo',     label: 'Glúteo'     },
    { key: 'gemelo',     label: 'Gemelo'     },
  ];

  return (
    <div className="animate-fade-in flex flex-col items-center justify-center min-h-[70vh]">
      <h1 className="text-3xl font-bold mb-2">Entreno de Hoy</h1>
      
      <div className="w-full mt-4 mb-10 flex flex-col items-center">
        <label className="block text-sm text-neutral-400 mb-2 text-center">Planificado para hoy:</label>
        {activeRoutine ? (
          <div className="bg-neutral-900 border border-teal-900/50 rounded-xl px-6 py-4 text-center font-bold text-teal-400 w-full max-w-xs shadow-[0_0_15px_rgba(20,184,166,0.1)]">
            {activeRoutine.name}
          </div>
        ) : (
          <div className="text-center w-full">
            <p className="text-neutral-500 italic mb-4">No hay entrenamiento programado hoy o es día de descanso.</p>
            <button 
              onClick={() => navigate('/calendar')}
              className="px-6 py-2 rounded-full border border-neutral-700 text-neutral-300 hover:text-white hover:border-teal-500 transition-colors"
            >
              Abrir Planificador
            </button>
          </div>
        )}
      </div>
      
      <button 
        disabled={!activeRoutine}
        onClick={() => setIsCheckinOpen(true)}
        className="w-48 h-48 rounded-full bg-teal-500 text-black font-extrabold text-3xl flex items-center justify-center shadow-[0_0_40px_rgba(20,184,166,0.2)] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
      >
        PLAY
      </button>

      {!activeRoutine && <p className="mt-8 text-sm text-neutral-500 animate-pulse">Planifica una rutina para empezar</p>}

      {/* CHECK-IN MODAL */}
      {isCheckinOpen && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col animate-slide-up p-6">
          <div className="flex justify-between items-center mb-8 mt-4">
            <h2 className="text-2xl font-bold flex items-center">
              <Activity className="text-teal-400 mr-2" /> Check-in Médico
            </h2>
            <button onClick={() => setIsCheckinOpen(false)} className="text-neutral-500 p-2">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <p className="text-neutral-400 mb-6 leading-relaxed">
            Pulsa en los músculos que tengas con agujetas o tocados. 
            El motor ajustará los pesos sugeridos para evitar lesiones.
          </p>

          <div className="grid grid-cols-3 gap-3 overflow-y-auto pb-4 max-h-[50vh]">
            {muscleGroups.map(({ key, label }) => {
              const state = muscleStates[key] || 0;
              return (
                <button
                  key={key}
                  onClick={() => handleMuscleClick(key)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-colors ${getStateColor(state)}`}
                >
                  <span className="font-semibold text-sm mb-1">{label}</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider">{getStateLabel(state)}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-auto">
            <button 
              onClick={startWorkout}
              className="w-full bg-teal-500 text-black font-bold py-4 rounded-xl flex items-center justify-center text-lg active:scale-95 transition-transform"
            >
              <Dumbbell className="mr-2" /> A DARLE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
