import { db } from '../db/db';

export async function exportBackup() {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      version: 1,
      tables: {}
    };

    // Extract all items from target tables
    const tables = ['exercises', 'routines', 'workoutSessions', 'exerciseHistory', 'plannedSessions'];
    
    for (const tableName of tables) {
      data.tables[tableName] = await db[tableName].toArray();
    }

    const jsonData = JSON.stringify(data);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `GymTracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error("Error exporting backup:", error);
    throw new Error('No se pudo generar la copia de seguridad.');
  }
}

export async function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const rawText = e.target.result;
        const parsed = JSON.parse(rawText);
        
        if (!parsed.tables) {
          throw new Error('El archivo no tiene el formato correcto de GymTracker.');
        }

        // Wipe and restore
        const tables = Object.keys(parsed.tables);
        
        await db.transaction('rw', tables.map(t => db[t]), async () => {
          for (const tableName of tables) {
            // Validating that table actually exists in current dexie schema
            if (db[tableName]) {
               await db[tableName].clear();
               await db[tableName].bulkAdd(parsed.tables[tableName]);
            }
          }
        });
        
        resolve(true);
      } catch (err) {
        console.error("Import parsing/db error:", err);
        reject(new Error('Archivo dañado, incompatible o ilegible.'));
      }
    };
    
    reader.onerror = () => reject(new Error('Fallo crítico de lectura de archivo en el navegador.'));
    
    reader.readAsText(file);
  });
}
