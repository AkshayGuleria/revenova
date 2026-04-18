/**
 * Type-safe API Client
 * Handles all HTTP communication with the backend
 */

import type { ApiResponse, ErrorResponse, QueryParams } from "~/types/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5177";

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Build query string from query parameters with operator support
 * Example: { status[eq]: 'active', limit[eq]: 20 } => ?status[eq]=active&limit[eq]=20
 */
function buildQueryString(params?: QueryParams): string {
  if (!params) return "";

  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        searchParams.append(key, value.join(","));
      } else {
        searchParams.append(key, String(value));
      }
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  const hasBody = options.body !== undefined && options.body !== null;
  const defaultHeaders: HeadersInit = hasBody
    ? { "Content-Type": "application/json" }
    : {};

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: "include", // Include cookies for session-based auth
  };

  try {
    const response = await fetch(url, config);

    // Handle non-2xx responses
    if (!response.ok) {
      // Try to parse error response
      let errorData: ErrorResponse | null = null;
      try {
        errorData = await response.json();
      } catch {
        // If JSON parsing fails, create a generic error
        throw new ApiError(
          response.status,
          "UNKNOWN_ERROR",
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      if (errorData?.error) {
        throw new ApiError(
          errorData.error.statusCode,
          errorData.error.code,
          errorData.error.message,
          errorData.error.details
        );
      }

      throw new ApiError(
        response.status,
        "UNKNOWN_ERROR",
        "An unknown error occurred"
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {
        data: null as any,
        paging: {
          offset: null,
          limit: null,
          total: null,
          totalPages: null,
          hasNext: null,
          hasPrev: null,
        },
      };
    }

    // Parse JSON response
    const data: ApiResponse<T> = await response.json();
    return data;
  } catch (error) {
    // Re-throw ApiError as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new ApiError(0, "NETWORK_ERROR", "Network request failed", {
        originalError: error.message,
      });
    }

    // Handle other errors
    throw new ApiError(
      0,
      "UNKNOWN_ERROR",
      error instanceof Error ? error.message : "An unknown error occurred"
    );
  }
}

/**
 * API Client with typed methods
 */
export const apiClient = {
  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: QueryParams): Promise<ApiResponse<T>> {
    const queryString = buildQueryString(params);
    return apiFetch<T>(`${endpoint}${queryString}`, {
      method: "GET",
    });
  },

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return apiFetch<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return apiFetch<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return apiFetch<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return apiFetch<T>(endpoint, {
      method: "DELETE",
    });
  },
};

/**
 * Helper to extract data from API response
 */
export function extractData<T>(response: ApiResponse<T>): T {
  return response.data as T;
}

/**
 * Helper to check if response contains array data
 */
export function isArrayData<T>(data: T | T[]): data is T[] {
  return Array.isArray(data);
}
