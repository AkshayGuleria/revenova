/**
 * API Response Types (ADR-003 Compliant)
 * All API responses follow the standardized structure
 */

/**
 * Paging metadata for list responses
 */
export interface PagingObject {
  offset: number | null;
  limit: number | null;
  total: number | null;
  totalPages: number | null;
  hasNext: boolean | null;
  hasPrev: boolean | null;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  paging: PagingObject;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path: string;
    details?: Record<string, any>;
  };
}

/**
 * Query parameter operators for filtering
 */
export type QueryOperator =
  | "eq"   // Equals
  | "ne"   // Not equals
  | "lt"   // Less than
  | "lte"  // Less than or equal
  | "gt"   // Greater than
  | "gte"  // Greater than or equal
  | "in"   // In array
  | "nin"  // Not in array
  | "like" // Case-insensitive substring
  | "null"; // Is null / not null

/**
 * Query parameters for list endpoints
 */
export interface QueryParams {
  offset?: number;
  limit?: number;
  [key: string]: any;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  offset?: number;
  limit?: number;
}
