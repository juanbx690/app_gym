import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Clock, ChevronDown, ChevronUp, Trash2, Download, X, Settings, UploadCloud, DatabaseBackup } from 'lucide-react';
import { generateGymHistoryPDF } from '../utils/pdfExport';
import { exportBackup, importBackup } from '../utils/backup';

export default function History() {
  const [expandedId, setExpandedId] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [exportError, setExportError] = useState(null);

  // Fechas por defecto: hace 30 dias hasta hoy
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() - 30);
  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const data = useLiveQuery(async () => {
    const completedSessions = await db.workoutSessions
      .filter(s => s.status === 'completed')
      .toArray();
      
    // Ordenar de más reciente a más antigua
    completedSessions.sort((a, b) => new Date(b.endTime) - new Date(a.endTime));

    const routines = await db.routines.toArray();
    const routineMap = Object.fromEntries(routines.map(r => [r.id, r]));

    const exercises = await db.exercises.toArray();
    const exerciseMap = Object.fromEntries(exercises.map(e => [e.id, e]));

    return { 
      sessions: completedSessions.map(s => ({
        ...s,
        routineName: routineMap[s.routineId]?.name || 'Rutina Eliminada'
      })),
      exerciseMap
    };
  });

  const deleteSession = async (sessionId, e) => {
    e.stopPropagation();
    if (confirm('¿Eliminar entreno del historial? Las estadísticas y recomendaciones del motor revertirán los cálculos de este día.')) {
      await db.exerciseHistory.where('workoutSessionId').equals(sessionId).delete();
      await db.workoutSessions.delete(sessionId);
      if (expandedId === sessionId) setExpandedId(null);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const sessions = data?.sessions;
  const exerciseMap = data?.exerciseMap || {};

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      setExportError(null);
      // Validar orden de fechas
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59); // Include end of day
      if (start > end) throw new Error("La fecha de inicio debe ser anterior a la final");

      await generateGymHistoryPDF(start.toISOString(), end.toISOString());
      setShowExportModal(false);
    } catch (err) {
      console.error(err);
      setExportError(err.message || "Error al exportar a PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      await exportBackup();
    } catch (e) {
      alert(e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (confirm('ADVERTENCIA: Vas a sobrescribir toda la base de datos actual con este backup. Perderás los datos no guardados. ¿Continuar?')) {
      try {
        setIsRestoring(true);
        await importBackup(file);
        alert('Copia de seguridad restaurada con éxito. La aplicación se recargará.');
        window.location.reload();
      } catch (err) {
        alert(err.message);
      } finally {
        setIsRestoring(false);
      }
    }
    // reset input
    e.target.value = '';
  };

  return (
    <div className="animate-fade-in pb-10 px-4">
      <div className="flex justify-between items-center mb-6 mt-4">
        <h1 className="text-2xl font-bold">Historial</h1>
        <button 
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 text-teal-400 px-3 py-2 rounded-xl text-sm font-bold hover:bg-neutral-800 active:scale-95 transition-all"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {sessions?.map(session => {
          const isExpanded = expandedId === session.id;
          
          return (
            <div key={session.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
              <div 
                className="p-5 flex justify-between items-center cursor-pointer active:bg-neutral-800 transition-colors"
                onClick={() => toggleExpand(session.id)}
              >
                <div>
                  <h2 className="text-xl font-semibold mb-1 text-white pr-2">{session.routineName}</h2>
                  <div className="flex items-center text-sm text-neutral-400">
                    <Clock className="w-4 h-4 mr-1" />
                    {new Date(session.endTime).toLocaleDateString('es-ES', { 
                      weekday: 'short', day: 'numeric', month: 'short' 
                    })}
                    <span className="mx-2">•</span>
                    {session.exercisesCompleted?.length || 0} Ejercicios
                  </div>
                </div>
                <div className="text-neutral-500">
                  {isExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-neutral-800 bg-neutral-950/50 animate-slide-up origin-top">
                  <div className="flex flex-col gap-4 mt-2">
                    {session.exercisesCompleted?.map((ex, i) => (
                      <div key={i} className="bg-black border border-neutral-800 rounded-xl p-3">
                        <span className="font-bold text-teal-500 text-sm mb-2 block">
                          {i + 1}. {exerciseMap[ex.exerciseId]?.name || 'Ejercicio Eliminado'}
                        </span>
                        <div className="space-y-1">
                          {ex.sets?.map((set, sIdx) => (
                            <div key={sIdx} className="flex justify-between items-center text-xs text-neutral-400 px-2">
                              <span>Serie {sIdx + 1}</span>
                              <span className="font-mono text-neutral-300">
                                <span className="font-bold text-white">{set.weight}</span> kg × <span className="font-bold text-white">{set.reps}</span> reps
                              </span>
                            </div>
                          ))}
                          {(!ex.sets || ex.sets.length === 0) && (
                            <span className="text-xs text-neutral-600 block px-2 italic">Sin series registradas</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {(!session.exercisesCompleted || session.exercisesCompleted.length === 0) && (
                      <p className="text-sm text-neutral-500 italic text-center py-2">No se completaron ejercicios.</p>
                    )}
                  </div>
                  
                  <div className="mt-6 flex justify-end">
                    <button 
                      onClick={(e) => deleteSession(session.id, e)}
                      className="flex items-center text-red-500 bg-red-500/10 px-4 py-2 rounded-lg text-sm font-bold active:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Eliminar Entreno
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!sessions?.length && (
          <div className="text-center mt-20 text-neutral-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto mb-4 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <p>No has entrenado todavía.</p>
            <p className="text-sm mt-1">¡Sal a destrozar los hierros!</p>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4 animate-fade-in text-white">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-neutral-900 bg-neutral-900/50">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-teal-500" /> Opciones de Datos
              </h2>
              <button 
                onClick={() => !isExporting && !isRestoring && setShowExportModal(false)}
                className="text-neutral-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 max-h-[80vh] overflow-y-auto">
              
              {/* PDF EXPORT BLOCK */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-4">
                <h3 className="text-sm font-bold text-teal-400 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <Download className="w-4 h-4" /> Informe PDF
                </h3>
                <p className="text-xs text-neutral-400 mb-4">Grafica tu evolución de fuerza e1RM.</p>
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Desde</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} disabled={isExporting} className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-sm text-white focus:outline-none" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] text-neutral-500 uppercase font-bold mb-1">Hasta</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} disabled={isExporting} className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-sm text-white focus:outline-none" />
                    </div>
                  </div>
                </div>
                {exportError && <div className="mb-2 text-xs text-red-400 bg-red-950/30 p-2 rounded">{exportError}</div>}
                <button onClick={handleExportPDF} disabled={isExporting} className={`w-full py-2 rounded font-bold text-sm transition-all ${isExporting ? 'bg-neutral-800' : 'bg-teal-600 hover:bg-teal-500 text-white'}`}>
                  Descargar Informe
                </button>
              </div>

              {/* JSON BACKUP BLOCK */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <h3 className="text-sm font-bold text-amber-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
                  <DatabaseBackup className="w-4 h-4" /> Copia de Seguridad
                </h3>
                <p className="text-xs text-neutral-400 mb-4">Guarda o restaura 100% de tus datos (JSON).</p>
                
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleExportBackup} disabled={isExporting} className="flex flex-col items-center justify-center p-3 bg-neutral-950 border border-neutral-800 rounded-xl hover:border-amber-500/50 transition-colors">
                    <Download className="w-5 h-5 text-neutral-400 mb-1" />
                    <span className="text-xs font-bold">Generar</span>
                  </button>
                  
                  <label className={`flex flex-col items-center justify-center p-3 bg-neutral-950 border border-neutral-800 rounded-xl cursor-pointer hover:border-amber-500/50 transition-colors ${isRestoring ? 'opacity-50 pointer-events-none' : ''}`}>
                    <UploadCloud className="w-5 h-5 text-neutral-400 mb-1" />
                    <span className="text-xs font-bold text-center">Restaurar</span>
                    <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
                  </label>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
