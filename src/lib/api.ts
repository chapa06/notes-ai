const API_URL = "/api";

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem("notes_hub_token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("notes_hub_token");
    window.location.reload();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || "Request failed");
  }

  return response.status === 204 ? null : response.json();
}
