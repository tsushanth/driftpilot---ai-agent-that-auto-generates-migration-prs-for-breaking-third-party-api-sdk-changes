export interface FieldMapping {
  from: string;
  to: string;
}

export interface ApiPath {
  objectPath: string;
  method: string;
}

export interface BreakingChange {
  sdk: string;
  id: string;
  title: string;
  sunsetDate: string;
  changelogUrl?: string;
  detect: ApiPath;
  replacement: ApiPath;
  fieldMapping: FieldMapping[];
  addFields?: Record<string, unknown>;
  migrationNote: string;
}
