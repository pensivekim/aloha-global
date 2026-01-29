// Cloudflare Pages Function — 시설 정보 조회
// GET /api/facility/:id

export async function onRequestGet(context) {
  const facilityId = context.params.id;

  if (!facilityId) {
    return new Response(
      JSON.stringify({ error: "시설 ID가 필요합니다." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const data = await context.env.FACILITY_DATA.get(`facility:${facilityId}`, "json");

    if (!data) {
      return new Response(
        JSON.stringify({ error: "시설을 찾을 수 없습니다." }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "시설 정보 조회 중 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
