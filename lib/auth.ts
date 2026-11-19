/** Cookie value for the single-password gate (works in Edge middleware and Node). */
export async function authToken(password: string) {
  const data = new TextEncoder().encode(`hana:${password}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
