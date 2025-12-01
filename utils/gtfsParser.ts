
import JSZip from 'jszip';
import Papa from 'papaparse';
import { Stop, StopTime, Trip, ParsedData, ProcessedSchedule, TrainSchedule } from '../types';
import { STATIONS_GIPUZKOA } from '../data/stations';

const GIPUZKOA_ORDERED_IDS = STATIONS_GIPUZKOA.map(s => String(s.CODIGO));
const GIPUZKOA_ID_SET = new Set(GIPUZKOA_ORDERED_IDS);

// Helper to find file in zip regardless of folder structure
const findFile = (zip: JSZip, fileName: string) => {
    const regex = new RegExp(`(^|/)${fileName}$`, 'i');
    const files = zip.file(regex);
    return files.length > 0 ? files[0] : null;
};

// Optimized CSV parser that handles blobs to save memory on mobile
const parseCSVFile = async <T>(zip: JSZip, filename: string): Promise<T[]> => {
  const file = findFile(zip, filename);
  if (!file) return [];
  
  const text = await file.async('string');
  const result = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data;
};

// Streaming parser specifically for the huge stop_times.txt
const parseStopTimesStream = async (zip: JSZip, validStopIds: Set<string>): Promise<StopTime[]> => {
  const file = findFile(zip, 'stop_times.txt');
  if (!file) return [];

  const blob = await file.async('blob');
  
  return new Promise((resolve, reject) => {
    const relevantStopTimes: StopTime[] = [];
    
    // Cast to any/File because PapaParse types expect File but Blob works in browser
    Papa.parse<StopTime>(blob as unknown as File, {
      header: true,
      skipEmptyLines: true,
      chunkSize: 1024 * 1024 * 5, // 5MB chunks
      chunk: (results) => {
        // Process chunk immediately and discard irrelevant data to keep memory low
        for (const st of results.data) {
          // Defensive check: ensure stop_id exists
          if (st.stop_id && validStopIds.has(st.stop_id)) {
            relevantStopTimes.push(st);
          }
        }
      },
      complete: () => {
        resolve(relevantStopTimes);
      },
      error: (err) => {
        reject(err);
      }
    });
  });
};

export const parseGTFS = async (data: Blob): Promise<ParsedData> => {
  const zip = new JSZip();
  await zip.loadAsync(data);

  // 1. Load ONLY stops (small). SKIP trips.txt because it's huge and causes crashes on iOS.
  const stopsData = await parseCSVFile<Stop>(zip, 'stops.txt');
  
  // 2. Load stop_times using streaming to filter ONLY Gipuzkoa stops
  const stopTimesData = await parseStopTimesStream(zip, GIPUZKOA_ID_SET);

  const stops = new Map<string, Stop>();
  stopsData.forEach(s => stops.set(s.stop_id, s));
  
  return {
    stops,
    trips: [], // Empty to save memory
    stopTimes: stopTimesData,
  };
};

export const processScheduleData = (data: ParsedData): ProcessedSchedule => {
  const { stopTimes } = data;

  // 1. Group Stop Times by Trip
  const stopTimesByTrip = new Map<string, StopTime[]>();
  stopTimes.forEach(st => {
    if (!st.trip_id) return;
    if (!stopTimesByTrip.has(st.trip_id)) {
      stopTimesByTrip.set(st.trip_id, []);
    }
    stopTimesByTrip.get(st.trip_id)?.push(st);
  });

  // 2. Sort Stop Times within trips
  for (const times of stopTimesByTrip.values()) {
     times.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
  }

  // 3. Process Trips into Schedules with Deduplication
  const uniqueSchedulesIrunToBrinkola = new Map<string, TrainSchedule>();
  const uniqueSchedulesBrinkolaToIrun = new Map<string, TrainSchedule>();

  stopTimesByTrip.forEach((times, tripId) => {
    if (times.length < 2) return; // Ignore single stops

    const firstStopId = times[0].stop_id;
    const lastStopId = times[times.length - 1].stop_id;

    const firstIndex = GIPUZKOA_ORDERED_IDS.indexOf(firstStopId);
    const lastIndex = GIPUZKOA_ORDERED_IDS.indexOf(lastStopId);

    // Determine direction purely by topology
    let isIrunToBrinkola = true;
    if (firstIndex !== -1 && lastIndex !== -1) {
      if (firstIndex < lastIndex) {
        isIrunToBrinkola = true;
      } else if (firstIndex > lastIndex) {
        isIrunToBrinkola = false;
      } else {
        return; // Loop or same station
      }
    } else {
        return; // Can't determine direction
    }

    // Build Time Map & Signature
    const timeMap: Record<string, string> = {};
    const signatureParts: string[] = [];
    
    times.forEach(t => {
      if (!t.departure_time) return;
      
      const timeParts = t.departure_time.split(':');
      if (timeParts.length < 2) return;

      let hour = parseInt(timeParts[0]);
      if (hour >= 24) hour -= 24;
      const formattedHour = hour.toString().padStart(2, '0');
      const formattedTime = `${formattedHour}:${timeParts[1]}`; // HH:MM
      
      timeMap[t.stop_id] = formattedTime;
      signatureParts.push(`${t.stop_id}@${formattedTime}`);
    });

    const signature = signatureParts.join('|');
    const schedule: TrainSchedule = {
      tripId: tripId,
      times: timeMap,
      startTime: times[0].departure_time,
      destinationId: lastStopId
    };

    if (isIrunToBrinkola) {
        if (!uniqueSchedulesIrunToBrinkola.has(signature)) {
            uniqueSchedulesIrunToBrinkola.set(signature, schedule);
        }
    } else {
        if (!uniqueSchedulesBrinkolaToIrun.has(signature)) {
            uniqueSchedulesBrinkolaToIrun.set(signature, schedule);
        }
    }
  });

  // 4. Convert Maps to Arrays and Sort
  const schedulesIrunToBrinkola = Array.from(uniqueSchedulesIrunToBrinkola.values());
  const schedulesBrinkolaToIrun = Array.from(uniqueSchedulesBrinkolaToIrun.values());

  schedulesIrunToBrinkola.sort((a, b) => a.startTime.localeCompare(b.startTime));
  schedulesBrinkolaToIrun.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return {
    directionIrunToBrinkola: schedulesIrunToBrinkola,
    directionBrinkolaToIrun: schedulesBrinkolaToIrun,
    stationOrder: GIPUZKOA_ORDERED_IDS
  };
};
