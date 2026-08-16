import { isAxiosError } from 'axios';

// The engine's ErrorResponse body is { error: string } (ApiErrorExtensions.cs).
// Falls back to a caller-supplied message for network failures, unparseable
// bodies, or non-axios errors, rather than surfacing axios's raw
// "Request failed with status code 4xx" text to the user.
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as { error?: string } | undefined;
    if (data?.error) return data.error;
  }
  return fallback;
}
