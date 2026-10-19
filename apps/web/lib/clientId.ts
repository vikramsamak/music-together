const CLIENT_ID_KEY = "mt.clientId";

export function getClientId(): string {
  let id: string | null = null;
  try {
    id = localStorage.getItem(CLIENT_ID_KEY);
  } catch {
    // fall through to generate
  }
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem(CLIENT_ID_KEY, id);
    } catch {
      // private mode: ephemeral id is fine
    }
  }
  return id;
}
