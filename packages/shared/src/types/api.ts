export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams {
  isActive?: boolean;
  categoryId?: string;
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export type ApiError = {
  message: string;
  statusCode: number;
  error?: string;
  details?: Record<string, any>;
};

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  version: string;
  database: 'connected' | 'disconnected';
  memory: {
    used: number;
    total: number;
    usage: string;
  };
}
