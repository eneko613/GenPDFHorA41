
import React from 'react';
import { ProcessedSchedule, Stop } from '../types';

interface PDFPreviewProps {
  data: ProcessedSchedule;
  stopsMap: Map<string, Stop>;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({ data, stopsMap }) => {
  // Helper to get nice name
  const getStopName = (id: string) => {
    const s = stopsMap.get(id);
    if (!s) return id;
    // Clean up RENFE names (often ALL CAPS)
    return s.stop_name
      .replace(/\b(\w)/g, c => c.toUpperCase()) // Title Case roughly
      .replace(/(\sDe\s)/gi, ' de ');
  };

  // Reverse station order for the return trip
  const stationsReverse = [...data.stationOrder].reverse();

  // LIMIT PREVIEW TO 50 ROWS TO PREVENT CRASHING THE BROWSER DOM
  const PREVIEW_LIMIT = 50;

  const renderTable = (title: string, stationIds: string[], allSchedules: any[]) => {
    const schedules = allSchedules.slice(0, PREVIEW_LIMIT);
    const hiddenCount = Math.max(0, allSchedules.length - PREVIEW_LIMIT);

    return (
        <div className="mb-8 bg-white p-4 shadow rounded-lg overflow-x-auto">
        <div className="flex justify-between items-end border-b pb-2 mb-4">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">
                Total trenes únicos: {allSchedules.length}
            </span>
        </div>
        
        {schedules.length === 0 ? (
            <p className="text-slate-500 italic">No se encontraron trenes para esta dirección con los datos actuales.</p>
        ) : (
            <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                <tr>
                    <th className="p-2 border text-left font-semibold text-slate-700 bg-slate-100 sticky left-0 z-20">#</th>
                    {stationIds.map(id => (
                    <th key={id} className="p-2 border text-center font-semibold text-slate-700 whitespace-nowrap min-w-[60px]">
                        {getStopName(id)}
                    </th>
                    ))}
                </tr>
                </thead>
                <tbody>
                {schedules.map((train, idx) => (
                    <tr key={train.tripId} className="hover:bg-blue-50 border-b transition-colors even:bg-slate-50">
                    <td className="p-2 border font-mono text-slate-500 sticky left-0 bg-inherit font-bold">{idx + 1}</td>
                    {stationIds.map(id => (
                        <td key={id} className={`p-2 border text-center font-mono ${train.times[id] ? 'text-slate-900' : 'bg-slate-100/50'}`}>
                        {train.times[id] || ''}
                        </td>
                    ))}
                    </tr>
                ))}
                </tbody>
            </table>
            </div>
        )}
        {hiddenCount > 0 && (
            <div className="mt-2 text-center p-2 bg-yellow-50 text-yellow-700 text-sm border border-yellow-200 rounded">
                ⚠️ Se muestran los primeros {PREVIEW_LIMIT} horarios. El PDF incluirá los {allSchedules.length} completos.
            </div>
        )}
        </div>
    );
  };

  return (
    <div className="w-full max-w-[95vw] mx-auto mt-8">
      {renderTable("Sentido: Irún → Brinkola", data.stationOrder, data.directionIrunToBrinkola)}
      {renderTable("Sentido: Brinkola → Irún", stationsReverse, data.directionBrinkolaToIrun)}
    </div>
  );
};

export default PDFPreview;
