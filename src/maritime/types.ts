export interface Port {
  "Nom du port": string;
  "Type de ports": string;
  "Connectivité": string;
  Latitude: number;
  Longitude: number;
  Etat: string;
}

export interface Lighthouse {
  Nom: string;
  Region: string;
  Province: string;
  Ville: string;
  "Date de mise en service": number | string;
  "Type du phare": string;
  Caracteristique_rythme: string;
  Portee_mile: number | string;
}

export interface LighthouseQuery {
  name?: string;
  region?: string;
  province?: string;
  type?: string;
  ville?: string;
}

export interface PortParams {
  name: string;
}
