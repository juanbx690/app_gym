import { useState } from 'react';
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ArrowLeft, Plus, X, Search, Save } from 'lucide-react';

export default function CreateRoutine() {
  const navigate = useNavigate();
  const location = useLocation();
  const editRoutine = location.state?.editRoutine;

  const [name, setName] = useState(editRoutine?.name || '');
  const [exercises, setExercises] = useState([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadExercises = async () => {
      if (editRoutine) {
        // Obtenemos los nombres desde la bd de ejercicios
        const allEx = await db.exercises.toArray();
        const exMap = Object.fromEntries(allEx.map(e => [e.id, e]));
        
        const mappedEx = editRoutine.exercises.map(ex => {
          const dictEx = exMap[ex.exerciseId];
          return {
            id: crypto.randomUUID(), // id temporal ui
            exerciseId: ex.exerciseId,
            name: dictEx?.name || 'Desconocido',
            muscleGroup: dictEx?.muscleGroup || 'Otro',
            sets: ex.sets || [{ targetReps: 10 }] // migrate old routine struct or use existing
          };
        });
        setExercises(mappedEx);
      }
    };
    loadExercises();
  }, [editRoutine]);

  const allExercises = useLiveQuery(() => 
    db.exercises
      .filter(ex => ex.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .toArray()
  , [searchTerm]);

  const addExercise = (ex) => {
    setExercises([...exercises, { 
      id: crypto.randomUUID(),
      exerciseId: ex.id, 
      name: ex.name, 
      muscleGroup: ex.muscleGroup,
      sets: [{ targetReps: 10 }, { targetReps: 10 }, { targetReps: 10 }] // Por defecto 3 series
    }]);
    setIsPickerOpen(false);
    setSearchTerm('');
  };

  const removeExercise = (id) => {
    setExercises(exercises.filter(ex => ex.id !== id));
  };

  const addSet = (exId) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exId) {
        const lastReps = ex.sets.length > 0 ? ex.sets[ex.sets.length - 1].targetReps : 10;
        return { ...ex, sets: [...ex.sets, { targetReps: lastReps }] };
      }
      return ex;
    }));
  };

  const removeSet = (exId, setIndex) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exId && ex.sets.length > 1) {
        const newSets = [...ex.sets];
        newSets.splice(setIndex, 1);
        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };

  const updateSetReps = (exId, setIndex, targetReps) => {
    setExercises(exercises.map(ex => {
      if (ex.id === exId) {
        const newSets = [...ex.sets];
        newSets[setIndex].targetReps = targetReps;
        return { ...ex, sets: newSets };
      }
      return ex;
    }));
  };

  const handleSave = async () => {
    if (!name.trim() || exercises.length === 0) return;
    
    const routineData = {
      name: name.trim(),
      exercises: exercises.map(({ exerciseId, sets }) => ({
        exerciseId, sets
      }))
    };

    if (editRoutine) {
      await db.routines.update(editRoutine.id, routineData);
    } else {
      await db.routines.add({
        id: crypto.randomUUID(),
        ...routineData
      });
    }
    
    navigate('/routines');
  };

  return (
    <div className="animate-fade-in pb-20 bg-black min-h-screen absolute inset-0 z-50 px-4">
      <div className="flex justify-between items-center py-4 mb-2 mt-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-neutral-400">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <span className="font-semibold">{editRoutine ? 'Editar Rutina' : 'Nueva Rutina'}</span>
        <button 
          onClick={handleSave} 
          disabled={!name.trim() || exercises.length === 0}
          className="text-teal-400 pr-2 disabled:text-neutral-600 disabled:opacity-50 font-bold flex items-center"
        >
          {editRoutine ? 'Actualizar' : 'Guardar'}
        </button>
      </div>

      <input 
        type="text" 
        placeholder="Nombre (ej. Día de Pecho)" 
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-4 mb-6 focus:outline-none focus:border-teal-500 font-bold text-lg text-white"
      />

      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-neutral-300">Ejercicios</h3>
        <button 
          onClick={() => setIsPickerOpen(true)}
          className="flex items-center text-teal-400 text-sm font-medium bg-teal-500/10 px-3 py-1.5 rounded-full"
        >
          <Plus className="w-4 h-4 mr-1" /> Añadir
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {exercises.map((ex, index) => (
          <div key={ex.id} className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl relative">
            <button 
              onClick={() => removeExercise(ex.id)}
              className="absolute top-2 right-2 p-2 text-neutral-500 hover:text-red-400"
            >
              <X className="w-4 h-4" />
            </button>
            <p className="font-semibold text-base mb-3 pr-8">{index + 1}. {ex.name}</p>
            
            <div className="flex flex-col gap-2">
              {ex.sets.map((set, sIndex) => (
                <div key={sIndex} className="flex items-center justify-between bg-black rounded-lg p-2 px-3 border border-neutral-800">
                  <span className="text-xs text-neutral-400 font-medium">Serie {sIndex + 1}</span>
                  <div className="flex items-center">
                    <input 
                      type="number" 
                      value={set.targetReps}
                      onChange={(e) => updateSetReps(ex.id, sIndex, parseInt(e.target.value) || 0)}
                      className="w-12 bg-transparent text-center font-bold focus:outline-none text-white focus:text-teal-400" 
                      inputMode="numeric"
                    />
                    <span className="text-[10px] text-neutral-500 uppercase ml-1 mr-4">Reps</span>
                    {ex.sets.length > 1 && (
                      <button onClick={() => removeSet(ex.id, sIndex)} className="text-red-400/50 hover:text-red-400 p-1">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button 
                onClick={() => addSet(ex.id)}
                className="text-[10px] uppercase font-bold text-teal-500 mt-2 p-2 border border-dashed border-teal-900 rounded-lg flex items-center justify-center w-full active:bg-teal-900/20"
              >
                + Añadir Serie
              </button>
            </div>
          </div>
        ))}
        {exercises.length === 0 && (
          <div className="border border-dashed border-neutral-800 rounded-xl p-8 text-center text-neutral-600">
            Ningún ejercicio añadido
          </div>
        )}
      </div>

      {/* Modal / Menú Selector de Ejercicios */}
      {isPickerOpen && (
        <div className="fixed inset-0 bg-neutral-950 z-[60] flex flex-col animate-slide-up">
          <div className="p-4 pt-10 border-b border-neutral-800 flex justify-between items-center">
            <h3 className="font-bold text-lg">Seleccionar Ejercicio</h3>
            <button onClick={() => setIsPickerOpen(false)} className="p-2 text-neutral-400"><X className="w-6 h-6" /></button>
          </div>
          <div className="p-4 flex-1 overflow-hidden flex flex-col">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-900 rounded-xl pl-10 pr-4 py-3 focus:outline-none text-white"
              />
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto pb-20">
              {allExercises?.map(ex => (
                <button 
                  key={ex.id}
                  onClick={() => addExercise(ex)}
                  className="text-left bg-neutral-900 border border-neutral-800 p-4 rounded-xl active:bg-neutral-800 flex justify-between items-center"
                >
                  <span className="font-medium">{ex.name}</span>
                  <span className="text-[10px] text-teal-500 uppercase">{ex.muscleGroup}</span>
                </button>
              ))}
              {allExercises?.length === 0 && <p className="text-neutral-500 text-center mt-4">No hay resultados.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
