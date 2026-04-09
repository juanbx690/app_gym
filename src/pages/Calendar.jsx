import { useState, useEffect, useRef } from 'react';
import { db } from '../db/db';
import { CalendarDays, Save, Trash2 } from 'lucide-react';

export default function Calendar() {
  const [routines, setRoutines] = useState([]);
  const [plannedSession, setPlannedSession] = useState(null);
  
  // Format YYYY-MM-DD
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  
  // Para la UI del formulario
  const [selectedRoutineId, setSelectedRoutineId] = useState('');

  // Generar un array de fechas para la cinta
  // Vamos a mostrar 7 días atrás y 14 días a futuro
  const [datesRibbon, setDatesRibbon] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    const today = new Date();
    const ribbon = [];
    for (let i = -7; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      ribbon.push({
        dateObj: d,
        dateStr: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('es-ES', { weekday: 'short' }),
        dayMonth: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
      });
    }
    setDatesRibbon(ribbon);
  }, []);

  // Cargar datos
  useEffect(() => {
    const loadData = async () => {
      const r = await db.routines.toArray();
      setRoutines(r);
    };
    loadData();
  }, []);

  // Cuando cambia la fecha seleccionada, buscamos si hay plan.
  useEffect(() => {
    const fetchPlanForDate = async () => {
      const plan = await db.plannedSessions.where({ date: selectedDate }).first();
      setPlannedSession(plan || null);
      if (plan) {
        setSelectedRoutineId(plan.routineId);
      } else {
        setSelectedRoutineId('');
      }
    };
    fetchPlanForDate();
  }, [selectedDate]);

  // Centrar la fecha seleccionada (Today) inicial en la cinta
  useEffect(() => {
    if (datesRibbon.length > 0 && scrollRef.current) {
      const todayIndex = datesRibbon.findIndex(d => d.dateStr === getTodayStr());
      if (todayIndex !== -1) {
        // Un cálculo aproximado asumiendo un ancho de celda de ~80px y un padding
        const scrollAmount = (todayIndex * 80) - (window.innerWidth / 2) + 40;
        scrollRef.current.scrollTo({ left: scrollAmount, behavior: 'smooth' });
      }
    }
  }, [datesRibbon]);

  const handleSavePlan = async () => {
    if (!selectedRoutineId) return;

    try {
      if (plannedSession) {
        // Actualizar
        await db.plannedSessions.update(plannedSession.id, {
          routineId: selectedRoutineId
        });
      } else {
        // Crear nuevo
        await db.plannedSessions.add({
          id: crypto.randomUUID(),
          date: selectedDate,
          routineId: selectedRoutineId
        });
      }
      // Actualizar estado local para mostrar confirmación visual si es necesario, o recargar
      const updatedPlan = await db.plannedSessions.where({ date: selectedDate }).first();
      setPlannedSession(updatedPlan);
    } catch (err) {
      console.error(err);
      alert("Error al guardar planificación");
    }
  };

  const handleDeletePlan = async () => {
    if (plannedSession) {
      await db.plannedSessions.delete(plannedSession.id);
      setPlannedSession(null);
      setSelectedRoutineId('');
    }
  };

  const todayStr = getTodayStr();
  const selectedDateObj = datesRibbon.find(d => d.dateStr === selectedDate);

  return (
    <div className="animate-fade-in flex flex-col h-full mt-4">
      <div className="flex items-center gap-2 mb-6">
        <CalendarDays className="text-teal-500 w-8 h-8" />
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Planificador</h1>
      </div>

      {/* Cinta de fechas */}
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto gap-3 pb-4 mb-6 custom-scrollbar snap-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {datesRibbon.map((d) => {
          const isSelected = d.dateStr === selectedDate;
          const isToday = d.dateStr === todayStr;

          return (
            <div 
              key={d.dateStr}
              onClick={() => setSelectedDate(d.dateStr)}
              className={`snap-center shrink-0 w-16 h-20 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer border ${
                isSelected 
                  ? 'bg-teal-500 border-teal-500 text-black shadow-[0_0_15px_rgba(20,184,166,0.3)]' 
                  : isToday
                  ? 'bg-neutral-800 border-teal-500 border-opacity-50 text-white'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'
              }`}
            >
              <span className={`text-[10px] uppercase font-bold tracking-widest ${isSelected ? 'text-teal-950' : isToday ? 'text-teal-500' : 'text-neutral-500'}`}>
                {d.dayName}
              </span>
              <span className="text-xl font-black mt-1">
                {d.dateObj.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Área de planificación */}
      <div className="bg-neutral-900 rounded-3xl p-6 border border-neutral-800/50 flex-1">
        <div className="mb-6">
          <h2 className="text-teal-500 text-xs font-bold uppercase tracking-widest mb-1">Día seleccionado</h2>
          <p className="text-xl font-bold text-white capitalize">
            {selectedDateObj ? `${selectedDateObj.dayName}, ${selectedDateObj.dayMonth}` : selectedDate}
            {selectedDate === todayStr && <span className="ml-2 text-[10px] bg-teal-500 text-black px-2 py-0.5 rounded-full align-middle uppercase tracking-wider font-extrabold">Hoy</span>}
          </p>
        </div>

        {routines.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-neutral-500 italic mb-4 text-sm">No tienes rutinas creadas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-neutral-400">
              Asignar Rutina:
            </label>
            <div className="relative">
              <select
                value={selectedRoutineId}
                onChange={(e) => setSelectedRoutineId(e.target.value)}
                className="w-full bg-black border border-neutral-800 text-white p-4 rounded-2xl appearance-none focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-colors"
                style={{ WebkitAppearance: 'none' }}
              >
                <option value="">-- Día de Descanso --</option>
                {routines.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSavePlan}
                disabled={!selectedRoutineId && !plannedSession} // No hace falta guardar si ya es dia de descanso y no habia sesion
                className={`flex-1 p-4 rounded-full font-bold flex items-center justify-center gap-2 transition-all ${
                  selectedRoutineId 
                    ? 'bg-teal-500 text-black hover:bg-teal-400' 
                    : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                <Save className="w-5 h-5" />
                Guardar Plan
              </button>

              {plannedSession && (
                <button
                  onClick={handleDeletePlan}
                  className="p-4 rounded-full bg-red-950/30 text-red-500 border border-red-900/50 hover:bg-red-900/50 flex items-center justify-center transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {plannedSession && !!selectedRoutineId && (
               <p className="text-[10px] text-teal-400 text-center mt-4">✓ Guardado correctamente como entrenamiento planificado</p>
            )}
            {!plannedSession && !selectedRoutineId && (
               <p className="text-[10px] text-neutral-600 text-center mt-4">☀ Día de descanso</p>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
