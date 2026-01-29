// Cloudflare Pages Function — Admin Facility CRUD
// JWT verification using Google public keys (no Firebase Admin SDK)

const ADMIN_EMAIL = "pensive.kim@gmail.com";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts = null;
let certsExpiry = 0;

async function getGoogleCerts() {
  if (cachedCerts && Date.now() < certsExpiry) return cachedCerts;
  const res = await fetch(GOOGLE_CERTS_URL);
  const certs = await res.json();
  const cacheControl = res.headers.get("cache-control") || "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  certsExpiry = Date.now() + (maxAgeMatch ? parseInt(maxAgeMatch[1]) * 1000 : 3600000);
  cachedCerts = certs;
  return certs;
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0))).buffer;
}

async function importPublicKey(pem) {
  const der = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    "x509",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyFirebaseToken(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");

  const headerStr = new TextDecoder().decode(base64UrlDecode(parts[0]));
  const header = JSON.parse(headerStr);
  const payloadStr = new TextDecoder().decode(base64UrlDecode(parts[1]));
  const payload = JSON.parse(payloadStr);

  // Check expiry
  if (payload.exp && payload.exp < Date.now() / 1000) {
    throw new Error("Token expired");
  }

  // Verify signature using Google certs
  const certs = await getGoogleCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error("Unknown signing key");

  const key = await importPublicKey(cert);
  const data = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const signature = base64UrlDecode(parts[2]);

  const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
  if (!valid) throw new Error("Invalid signature");

  return payload;
}

async function authenticate(request) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verifyFirebaseToken(token);
    if (payload.email !== ADMIN_EMAIL) return null;
    return payload;
  } catch {
    return null;
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// GET — list all facilities
export async function onRequestGet(context) {
  const admin = await authenticate(context.request);
  if (!admin) return json({ error: "Unauthorized" }, 401);

  try {
    const list = await context.env.FACILITY_DATA.list({ prefix: "facility:" });
    const facilities = {};
    for (const key of list.keys) {
      const id = key.name.replace("facility:", "");
      const data = await context.env.FACILITY_DATA.get(key.name, "json");
      if (data) facilities[id] = data;
    }
    return json(facilities);
  } catch (err) {
    return json({ error: "Failed to list facilities" }, 500);
  }
}

// POST — create or update a facility
export async function onRequestPost(context) {
  const admin = await authenticate(context.request);
  if (!admin) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await context.request.json();
    const { id, data } = body;
    if (!id || !data) return json({ error: "id and data are required" }, 400);

    await context.env.FACILITY_DATA.put(`facility:${id}`, JSON.stringify(data));
    return json({ ok: true, id });
  } catch (err) {
    return json({ error: "Failed to save facility" }, 500);
  }
}

// DELETE — remove a facility
export async function onRequestDelete(context) {
  const admin = await authenticate(context.request);
  if (!admin) return json({ error: "Unauthorized" }, 401);

  try {
    const body = await context.request.json();
    const { id } = body;
    if (!id) return json({ error: "id is required" }, 400);

    await context.env.FACILITY_DATA.delete(`facility:${id}`);
    return json({ ok: true, id });
  } catch (err) {
    return json({ error: "Failed to delete facility" }, 500);
  }
}
