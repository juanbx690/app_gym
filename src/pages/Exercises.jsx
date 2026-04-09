import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Plus, Search, X, Trash2, Edit2, TrendingUp, Calendar as CalIcon, Activity, Flame } from 'lucide-react';

export default function Exercises() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExGroup, setNewExGroup] = useState('Pecho');
  const [editingEx, setEditingEx] = useState(null);
  
  const [selectedStatsEx, setSelectedStatsEx] = useState(null);
  const [exStats, setExStats] = useState({ history: [], maxWeight: 0, maxE1rm: 0, totalSets: 0, lastDate: null });

  useEffect(() => {
    const fetchStats = async () => {
      if (!selectedStatsEx) return;
      const history = await db.exerciseHistory.where('exerciseId').equals(selectedStatsEx.id).toArray();
      
      if (history.length === 0) {
        setExStats({ history: [], maxWeight: 0, maxE1rm: 0, totalSets: 0, lastDate: null });
        return;
      }
      
      const sortedHistory = history.sort((a, b) => new Date(b.date) - new Date(a.date));
      const maxW = Math.max(...history.map(h => h.bestSetWeight));
      const maxE = Math.max(...history.map(h => h.e1RM));

      setExStats({
        history: sortedHistory.slice(0, 5),
        maxWeight: maxW,
        maxE1rm: maxE,
        totalSets: history.length,
        lastDate: sortedHistory[0].date
      });
    };
    fetchStats();
  }, [selectedStatsEx]);

  const exercises = useLiveQuery(() => 
    db.exercises
      .filter(ex => ex.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .toArray()
  , [searchTerm]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newExName.trim()) return;
    
    if (editingEx) {
      await db.exercises.update(editingEx.id, {
        name: newExName.trim(),
        muscleGroup: newExGroup
      });
      setEditingEx(null);
    } else {
      await db.exercises.add({
        id: crypto.randomUUID(),
        name: newExName.trim(),
        muscleGroup: newExGroup,
        isCustom: true
      });
    }
    
    setNewExName('');
    setIsAdding(false);
  };

  const openEditModal = (ex) => {
    setEditingEx(ex);
    setNewExName(ex.name);
    setNewExGroup(ex.muscleGroup);
    setIsAdding(true);
  };

  const closeEditModal = () => {
    setEditingEx(null);
    setNewExName('');
    setNewExGroup('Pecho');
    setIsAdding(false);
  };

  const handleDelete = async (id) => {
    if(window.confirm('¿Seguro que quieres borrar este ejercicio?')) {
      await db.exercises.delete(id);
    }
  };

  const muscleGroups = ['Pecho', 'Espalda', 'Hombro', 'Bíceps', 'Tríceps', 'Cuádriceps', 'Femoral', 'Glúteo', 'Gemelo', 'Abdomen', 'Antebrazo', 'Otro'];

  return (
    <div className="animate-fade-in pb-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Catálogo</h1>
        <button 
          onClick={() => {
            setEditingEx(null);
            setNewExName('');
            setNewExGroup('Pecho');
            setIsAdding(true);
          }}
          className="bg-teal-500 text-black p-2 rounded-full active:scale-95 transition-transform shadow-lg shadow-teal-500/20"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
      
      {/* Search Input */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar ejercicio..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-teal-500 transition-colors text-neutral-200"
        />
      </div>

      {/* Add Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <form onSubmit={handleAdd} className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-3xl p-6 animate-slide-up">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold">{editingEx ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}</h2>
              <button type="button" onClick={closeEditModal} className="text-neutral-500 p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <label className="block text-sm text-neutral-400 mb-1">Nombre</label>
            <input 
              type="text" 
              autoFocus
              value={newExName}
              onChange={(e) => setNewExName(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:border-teal-500 text-white"
              placeholder="Ej. Curl Martillo"
            />

            <label className="block text-sm text-neutral-400 mb-1">Grupo Muscular</label>
            <select 
              value={newExGroup}
              onChange={(e) => setNewExGroup(e.target.value)}
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 mb-8 focus:outline-none focus:border-teal-500 text-white"
            >
              {muscleGroups.map(group => <option key={group} value={group}>{group}</option>)}
            </select>

            <button type="submit" className="w-full bg-teal-500 text-black font-bold py-4 rounded-xl active:scale-95 transition-transform">
              {editingEx ? 'Guardar Cambios' : 'Guardar Ejercicio'}
            </button>
          </form>
        </div>
      )}

      {/* List */}
      <div className="flex flex-col gap-3">
        {exercises?.map(ex => (
          <div 
            key={ex.id} 
            onClick={() => setSelectedStatsEx(ex)}
            className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex justify-between items-center cursor-pointer active:scale-[0.98] transition-transform"
          >
            <div className="pointer-events-none">
              <p className="font-semibold">{ex.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-teal-400 uppercase tracking-wider">{ex.muscleGroup}</span>
                {ex.isCustom && <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 rounded-md">Custom</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); openEditModal(ex); }} 
                className="p-2 text-neutral-500 hover:text-teal-400 bg-black rounded-lg"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button 
                 onClick={(e) => { e.stopPropagation(); handleDelete(ex.id); }} 
                 className="p-2 text-neutral-500 hover:text-red-400 bg-black rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {exercises?.length === 0 && <p className="text-neutral-500 text-center mt-10">No hay resultados.</p>}
      </div>

      {/* Stats Modal */}
      {selectedStatsEx && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col justify-end">
          <div className="bg-neutral-950 border-t border-neutral-800 rounded-t-3xl p-6 pb-safe animate-slide-up h-[85vh] flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white leading-tight">{selectedStatsEx.name}</h2>
                <span className="text-xs text-teal-500 font-bold uppercase tracking-widest">{selectedStatsEx.muscleGroup}</span>
              </div>
              <button onClick={() => setSelectedStatsEx(null)} className="p-2 -mr-2 text-neutral-500 hover:text-white bg-neutral-900 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            {exStats.totalSets === 0 ? (
              <div className="flex-1 flex items-center justify-center text-center p-4">
                 <p className="text-neutral-500 italic">No tienes ningún registro todavía de este ejercicio. ¡Dále duro en tu próxima sesión!</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 -mr-1">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-8">
                  <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
                    <div className="flex items-center gap-2 mb-2">
                       <TrendingUp className="w-4 h-4 text-teal-500" />
                       <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Máx e1RM</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white">{exStats.maxE1rm.toFixed(1)}</span>
                      <span className="text-xs text-neutral-500">kg</span>
                    </div>
                  </div>

                  <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
                    <div className="flex items-center gap-2 mb-2">
                       <Flame className="w-4 h-4 text-orange-500" />
                       <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Peso Acero</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white">{exStats.maxWeight}</span>
                      <span className="text-xs text-neutral-500">kg</span>
                    </div>
                  </div>

                  <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
                    <div className="flex items-center gap-2 mb-2">
                       <CalIcon className="w-4 h-4 text-blue-500" />
                       <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Última Vez</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-white">
                         {new Date(exStats.lastDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  </div>

                  <div className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800">
                    <div className="flex items-center gap-2 mb-2">
                       <Activity className="w-4 h-4 text-purple-500" />
                       <span className="text-[10px] text-neutral-400 uppercase font-bold tracking-widest">Histórico</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-white">{exStats.totalSets}</span>
                      <span className="text-xs text-neutral-500">sesiones</span>
                    </div>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-neutral-400 mb-4 uppercase tracking-widest">Registros Recientes</h3>
                <div className="flex flex-col gap-3 pb-8">
                   {exStats.history.map((h, i) => (
                     <div key={i} className="flex justify-between items-center p-3 rounded-xl bg-black border border-neutral-800/50">
                        <div>
                          <span className="block text-xs text-neutral-500 mb-1">
                            {new Date(h.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                          </span>
                          <span className="font-bold">{h.bestSetWeight}kg <span className="text-neutral-600 font-normal">x</span> {h.bestSetReps} <span className="text-neutral-600 font-normal text-xs uppercase">reps</span></span>
                        </div>
                        <div className="text-right">
                           <span className="block text-[10px] text-teal-700 uppercase font-bold tracking-widest mb-1">e1RM</span>
                           <span className="font-bold text-teal-400">{h.e1RM.toFixed(1)}</span>
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
