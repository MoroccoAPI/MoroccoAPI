export type Language = "ar" | "fr" | "en";
export type Names = Readonly<Record<Language, string>>;

export interface Holiday {
  id: string;
  date: string | null;
  names: Names;
  type: "national" | "religious";
  status: "fixed" | "confirmed" | "pending_confirmation";
  day: number;
  source_urls: readonly string[];
}

export interface Calendar {
  year: number;
  holidays: Holiday[];
  complete: boolean;
}
