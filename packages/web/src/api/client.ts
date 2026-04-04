const BASE = '/api' // proxied da Vite a localhost:3200 in dev

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, options)
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.data as T
}
