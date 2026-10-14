import type { SourceLanguageName } from "../geography/types.js";

export interface Museum {
  id: string;
  name: Readonly<SourceLanguageName>;
  aliases: readonly string[];
  city_code: string;
  region_code: string;
  address_fr: string;
  contact: Readonly<{
    phone_e164: string | null;
    phone_status: "format_valid_unverified" | "invalid_format" | "missing";
    social_handles: readonly string[];
  }>;
  opening_hours_text_fr: string;
  admission_text_fr: string;
  coordinates: null;
  operating_status: "unknown";
  quality_flags: readonly string[];
}

export interface MuseumQuery {
  q?: string;
  city_code?: string;
  region_code?: string;
}

export interface MuseumParams { id: string }
