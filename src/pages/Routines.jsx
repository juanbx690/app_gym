import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export default function Routines() {
  const navigate = useNavigate();
  const routines = useLiveQuery(() => db.routines.toArray());

  return (
    <div className="animate-fade-in pb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Mis Rutinas</h1>
        <button 
          onClick={() => navigate('/routines/new')}
          className="bg-teal-500 text-black p-2 rounded-full active:scale-95 transition-transform shadow-lg shadow-teal-500/20"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {routines?.map(routine => (
          <div key={routine.id} className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl active:bg-neutral-800 transition-colors flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold mb-1">{routine.name}</h2>
              <p className="text-neutral-400 text-sm">{routine.exercises?.length || 0} ejercicios</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  navigate('/routines/new', { state: { editRoutine: routine } });
                }}
                className="p-3 text-neutral-500 hover:text-teal-400 bg-black rounded-xl"
              >
                <Edit2 className="w-5 h-5" />
              </button>
              <button 
                onClick={async (e) => {
                  e.stopPropagation();
                  if(window.confirm(`¿Seguro que quieres borrar la rutina "${routine.name}"?`)) {
                    await db.routines.delete(routine.id);
                  }
                }}
                className="p-3 text-neutral-500 hover:text-red-400 bg-black rounded-xl"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        
        {routines?.length === 0 && (
          <div className="text-center mt-20 text-neutral-500">
            <p>No tienes rutinas todavía.</p>
            <button 
              onClick={() => navigate('/routines/new')}
              className="mt-4 px-6 py-2 border border-teal-500 text-teal-400 rounded-full text-sm font-medium active:bg-teal-500/10 transition-colors"
            >
              Crear mi primera rutina
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
