export async function responseJson<T>(response: Response): Promise<T> {
  if (response.status === 401)
    throw new Error("Your session has expired. Sign in again.");
  const value = await response.json();
  if (!response.ok) {
    const error = value?.error;
    throw new Error(
      typeof error === "string"
        ? error
        : (error?.message ?? "The request failed."),
    );
  }
  return value as T;
}
