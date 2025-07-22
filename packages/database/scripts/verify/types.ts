export type UserType = 'admin' | 'app';
export type OutputFormat = 'table' | 'json' | 'csv' | 'count';
export type SortOrder = 'asc' | 'desc';

export interface GlobalOptions {
  user: UserType;
  auth?: string;
  format: OutputFormat;
  org?: string;
  verbose: boolean;
}

export interface CountOptions extends GlobalOptions {
  where?: string;
}

export interface ShowOptions extends GlobalOptions {
  where?: string;
  select?: string;
  limit: number;
  offset: number;
  orderBy?: string;
  order: SortOrder;
}

export interface StatsOptions extends GlobalOptions {
  where?: string;
  groupBy?: string;
  count?: string;
  sum?: string;
  avg?: string;
  min?: string;
  max?: string;
}

export interface AccessOptions extends GlobalOptions {
  as: string;
}

export interface CompareOptions extends GlobalOptions {
  users: string;
}

export interface QueryResult {
  data: any[];
  count: number;
  query?: string;
}

export interface TableInfo {
  name: string;
  fields: string[];
  relations: Record<string, string>;
}