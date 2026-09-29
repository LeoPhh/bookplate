// fetch() for the app's own API: an expired session sends the browser back
// to the sign-in page instead of failing quietly.
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
  return res;
}

export function putJson(path: string, body: unknown): Promise<Response> {
  return apiFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
