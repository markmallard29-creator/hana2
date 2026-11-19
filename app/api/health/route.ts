/** Liveness check for the host (Railway healthcheck). Public, says nothing sensitive. */
export async function GET() {
  return Response.json({ ok: true });
}
