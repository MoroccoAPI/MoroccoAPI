export const airportTypes = ["small_airport", "medium_airport", "large_airport", "heliport", "closed"] as const;
export type AirportType = typeof airportTypes[number];

export interface Airport {
  id: number;
  ident: string;
  icao_code: string | null;
  iata_code: string | null;
  name: string;
  type: AirportType;
  municipality: string | null;
  iso_country: "MA";
  iso_region: string | null;
  location: Readonly<{ latitude: number; longitude: number }> | null;
  scheduled_service: boolean;
}

export interface AirportQuery {
  q?: string;
  city?: string;
  type?: AirportType;
  scheduled_service?: boolean;
}

export interface AirportParams { icao: string }
