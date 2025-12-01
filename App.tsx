
import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, Train, MapPin, ArrowRight, Clock, CheckCircle2, DownloadCloud } from 'lucide-react';
import { parseGTFS, processScheduleData } from './utils/gtfsParser';
import { ProcessedSchedule, ProcessingStatus, Stop, TrainSchedule } from './types';
import { STATIONS_GIPUZKOA } from './data/stations';

function App() {
  const [gtfsBlob, setGtfsBlob] = useState<Blob | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<'idle' | 'downloading' | 'ready' | 'error'>('idle');
  
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [processedData, setProcessedData] = useState<ProcessedSchedule | null>(null);
  const [stopsMap, setStopsMap] = useState<Map<string, Stop>>(new Map());

  // Automatic download on mount
  useEffect(() => {
    const fetchGTFS = async () => {
        setDownloadStatus('downloading');
        try {
            // Using a CORS proxy to allow fetching the ZIP directly in the browser
            // Renfe servers do not allow Cross-Origin requests by default
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const targetUrl = 'https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip';
            
            const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
            if (!response.ok) throw new Error("Error en la descarga de Renfe");
            
            const blob = await response.blob();
            setGtfsBlob(blob);
            setDownloadStatus('ready');
        } catch (err) {
            console.error(err);
            setErrorMessage("Error descargando horarios oficiales. Renfe puede estar bloqueando la conexión.");
            setDownloadStatus('error');
        }
    }
    fetchGTFS();
  }, []);

  const processFiles = async () => {
    if (!gtfsBlob) {
      setErrorMessage('Los datos de horarios aún no se han descargado.');
      return;
    }
    if (!selectedStationId) {
      setErrorMessage('Por favor, selecciona una estación primero.');
      return;
    }

    setStatus('parsing');
    setErrorMessage('');

    setTimeout(async () => {
      try {
        const parsedGTFS = await parseGTFS(gtfsBlob);
        
        const enhancedStopsMap = new Map(parsedGTFS.stops);
        STATIONS_GIPUZKOA.forEach(jsonStop => {
          const id = String(jsonStop.CODIGO);
          const existing = enhancedStopsMap.get(id);
          const name = jsonStop.DESCRIPCION.replace(/\b(\w)/g, c => c.toUpperCase()).replace(/(\sDe\s)/gi, ' de ');
          
          if (existing) {
             enhancedStopsMap.set(id, { ...existing, stop_name: name });
          } else {
             enhancedStopsMap.set(id, { stop_id: id, stop_name: name });
          }
        });
        setStopsMap(enhancedStopsMap);
  
        const processed = processScheduleData(parsedGTFS);
        setProcessedData(processed);
        setStatus('done');
  
      } catch (error: any) {
        console.error(error);
        setErrorMessage('Error procesando los datos. Intenta recargar la página. Detalle: ' + error.message);
        setStatus('error');
      }
    }, 100);
  };

  // Helper to filter and sort trains for the selected station
  const getStationSchedule = () => {
    if (!processedData || !selectedStationId) return [];

    const relevantTrains: { time: string; direction: string; destinationId: string; tripId: string }[] = [];

    // Helper to process a direction array
    const addTrains = (list: TrainSchedule[], directionLabel: string) => {
      list.forEach(train => {
        const timeAtStation = train.times[selectedStationId];
        if (timeAtStation) {
          relevantTrains.push({
            time: timeAtStation,
            direction: directionLabel,
            destinationId: train.destinationId,
            tripId: train.tripId
          });
        }
      });
    };

    addTrains(processedData.directionIrunToBrinkola, "Hacia Brinkola");
    addTrains(processedData.directionBrinkolaToIrun, "Hacia Irún");

    // Sort by time
    return relevantTrains.sort((a, b) => a.time.localeCompare(b.time));
  };

  const selectedStationName = STATIONS_GIPUZKOA.find(s => String(s.CODIGO) === selectedStationId)?.DESCRIPCION || "Estación";
  const stationSchedule = getStationSchedule();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-4 md:p-6">
      <header className="mb-8 text-center max-w-3xl mx-auto">
        <div className="flex justify-center mb-4">
          <div className="bg-red-600 p-3 rounded-full text-white shadow-lg">
            <Train size={32} />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Horarios Renfe Cercanías
        </h1>
        <p className="text-slate-600">
          Consulta los horarios de paso por tu estación
        </p>
      </header>

      <main className="flex-1 w-full max-w-lg mx-auto space-y-6">
        
        {/* Status Indicator */}
        <div className={`p-4 rounded-xl border flex items-center gap-3 transition-colors ${
            downloadStatus === 'ready' 
                ? 'bg-green-50 border-green-200 text-green-700' 
                : downloadStatus === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
            {downloadStatus === 'downloading' && <Loader2 className="animate-spin" size={20} />}
            {downloadStatus === 'ready' && <CheckCircle2 size={20} />}
            {downloadStatus === 'error' && <AlertCircle size={20} />}
            
            <span className="font-medium text-sm">
                {downloadStatus === 'downloading' && "Descargando horarios oficiales de Renfe..."}
                {downloadStatus === 'ready' && "Horarios oficiales descargados y listos."}
                {downloadStatus === 'error' && "Error en la descarga automática."}
            </span>
        </div>

        {/* Step 1: Select Station */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
            <MapPin size={18} className="text-red-600" />
            1. Selecciona tu Estación
          </label>
          <select 
            className="w-full p-3 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-red-500 outline-none text-slate-800"
            value={selectedStationId}
            onChange={(e) => {
               setSelectedStationId(e.target.value);
               setProcessedData(null); 
            }}
          >
            <option value="">-- Elige una estación --</option>
            {STATIONS_GIPUZKOA.map(s => (
              <option key={s.CODIGO} value={s.CODIGO}>
                {s.DESCRIPCION}
              </option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        <button 
          onClick={processFiles}
          disabled={!gtfsBlob || !selectedStationId || status === 'parsing'}
          className={`w-full py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 font-bold text-lg shadow-md transition-all ${
            status === 'parsing' 
              ? 'bg-slate-100 text-slate-500' 
              : (!gtfsBlob || !selectedStationId)
                ? 'bg-slate-200 text-slate-400'
                : 'bg-red-600 text-white hover:bg-red-700'
          }`}
        >
          {status === 'parsing' ? <Loader2 className="animate-spin" /> : null}
          {status === 'parsing' ? 'Procesando...' : 'Ver Horarios'}
        </button>

        {errorMessage && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2 border border-red-100 animate-in fade-in">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* RESULTS LIST */}
        {processedData && status === 'done' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4 mt-8 px-1">
              <h2 className="text-xl font-bold text-slate-800">{selectedStationName}</h2>
              <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs font-mono">
                {stationSchedule.length} trenes
              </span>
            </div>

            <div className="bg-white shadow-md rounded-xl overflow-hidden border border-slate-200">
              {stationSchedule.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No hay trenes programados para esta estación en los datos subidos.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {stationSchedule.map((train) => {
                    const destinationName = stopsMap.get(train.destinationId)?.stop_name || "Desconocido";
                    return (
                      <div key={train.tripId} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                           <div className="bg-red-50 text-red-700 font-mono text-xl font-bold px-3 py-2 rounded-lg border border-red-100 flex items-center gap-2">
                             <Clock size={16} className="opacity-50" />
                             {train.time}
                           </div>
                           <div>
                             <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-0.5">
                               Dirección
                             </p>
                             <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                               {train.direction.includes("Brinkola") ? (
                                 <ArrowRight size={16} className="text-blue-500" />
                               ) : (
                                 <ArrowRight size={16} className="text-green-500 rotate-180" />
                               )}
                               <span>{destinationName}</span>
                             </div>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
             <p className="text-center text-xs text-slate-400 mt-4">
               * Destino indica la última parada del tren.
             </p>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
