import { jsPDF } from 'jspdf';
import { Chart, registerables } from 'chart.js';
import { db } from '../db/db';

Chart.register(...registerables);

export async function generateGymHistoryPDF(startDate, endDate) {
  // 1. Fetch data
  const history = await db.exerciseHistory
    .where('date')
    .between(startDate, endDate)
    .toArray();

  if (history.length === 0) {
    throw new Error('No hay entrenamientos en este rango de fechas.');
  }

  const allExercises = await db.exercises.toArray();
  const exerciseMap = Object.fromEntries(allExercises.map(e => [e.id, e]));

  // 2. Group by muscleGroup -> exerciseId
  const groupedData = {};

  // Sort history chronologically before pushing
  history.sort((a, b) => new Date(a.date) - new Date(b.date));

  history.forEach(log => {
    const ex = exerciseMap[log.exerciseId];
    if (!ex) return; // Exercise deleted

    const muscle = ex.muscleGroup || 'Otros';
    if (!groupedData[muscle]) groupedData[muscle] = {};
    if (!groupedData[muscle][ex.id]) groupedData[muscle][ex.id] = [];

    groupedData[muscle][ex.id].push(log);
  });

  // 3. Initialize PDF document
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  const marginX = 15;
  let currentY = 20;

  // Title
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Progreso de Entrenamientos', marginX, currentY);
  currentY += 10;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Desde: ${new Date(startDate).toLocaleDateString()}  Hasta: ${new Date(endDate).toLocaleDateString()}`, marginX, currentY);
  currentY += 15;

  // Render Charts
  const chartWidth = 180;
  const chartHeight = 100;

  // Hidden container for canvases
  const chartContainer = document.createElement('div');
  chartContainer.style.width = '800px';
  chartContainer.style.height = '450px';
  chartContainer.style.position = 'fixed';
  chartContainer.style.top = '-9999px';
  chartContainer.style.left = '-9999px';
  document.body.appendChild(chartContainer);

  const muscles = Object.keys(groupedData).sort();

  for (const muscle of muscles) {
    // Muscle Title
    if (currentY + 20 > pageHeight) {
      doc.addPage();
      currentY = 20;
    }
    
    doc.setFillColor(20, 184, 166); // Teal 500
    doc.rect(marginX, currentY, pageWidth - marginX * 2, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(muscle.toUpperCase(), marginX + 5, currentY + 7);
    currentY += 20;
    doc.setTextColor(0, 0, 0);

    const exercisesIds = Object.keys(groupedData[muscle]);

    for (const exId of exercisesIds) {
      const logs = groupedData[muscle][exId];
      if (logs.length === 0) continue;

      const exerciseName = exerciseMap[exId]?.name || 'Desconocido';

      // Check overflow for Exercise Title + Chart
      if (currentY + chartHeight + 15 > pageHeight) {
        doc.addPage();
        currentY = 20;
      }

      // Exercise Title
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(exerciseName, marginX, currentY);
      currentY += 5;

      // Extract Labels (Dates) and Data (e1RM)
      // Group the logs by day to prevent messy multiple points on same day, or just plot all?
      // Since it's continuous over time, plotting all points chronologically works.
      const labels = logs.map(l => new Date(l.date).toLocaleDateString());
      const dataPoints = logs.map(l => l.e1RM || 0);

      // Create Canvas
      const canvas = document.createElement('canvas');
      canvas.width = 800;
      canvas.height = 450;
      chartContainer.appendChild(canvas);

      // Generate Chart
      const chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'e1RM (kg)',
            data: dataPoints,
            borderColor: 'rgb(20, 184, 166)',
            backgroundColor: 'rgba(20, 184, 166, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: 'rgb(20, 184, 166)',
            pointRadius: 4
          }]
        },
        options: {
          animation: false, // CRUCIAL for synchronous base64 extraction
          responsive: false,
          devicePixelRatio: 2, // higher res for PDF
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: {
              beginAtZero: false,
              ticks: { font: { size: 14 } }
            },
            x: {
              ticks: { font: { size: 12 }, maxTicksLimit: 10 }
            }
          }
        }
      });

      // Get Image and inject in PDF
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      doc.addImage(imgData, 'JPEG', marginX, currentY, chartWidth, chartHeight);
      
      currentY += chartHeight + 15;

      // Cleanup
      chart.destroy();
      chartContainer.removeChild(canvas);
    }
  }

  // Remove hidden wrapper from DOM
  document.body.removeChild(chartContainer);

  // Download PDF
  const filename = `GymTracker_Fuerza_${new Date().getTime()}.pdf`;
  doc.save(filename);
}
