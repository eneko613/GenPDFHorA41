
export interface Stop {
  stop_id: string;
  stop_name: string;
  stop_lat?: string;
  stop_lon?: string;
}

export interface StopTime {
  trip_id: string;
  arrival_time: string;
  departure_time: string;
  stop_id: string;
  stop_sequence: string;
}

export interface Trip {
  route_id: string;
  service_id: string;
  trip_id: string;
  trip_headsign: string;
  direction_id: string; // "0" or "1"
}

export interface RenfeStationJSON {
  CODIGO: string | number;
  DESCRIPCION: string;
  LATITUD?: string;
  LONGITUD?: string;
  [key: string]: any;
}

export interface ParsedData {
  stops: Map<string, Stop>;
  trips: Trip[];
  stopTimes: StopTime[];
}

export interface ProcessedSchedule {
  directionIrunToBrinkola: TrainSchedule[]; // Direction 0 (approx)
  directionBrinkolaToIrun: TrainSchedule[]; // Direction 1 (approx)
  stationOrder: string[]; // Canonical ordered IDs
}

export interface TrainSchedule {
  tripId: string;
  times: Record<string, string>; // Map stopId -> time string
  startTime: string; // For sorting
  destinationId: string; // The last stop ID for this specific trip
}

export type ProcessingStatus = 'idle' | 'parsing' | 'generating' | 'done' | 'error';
