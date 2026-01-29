// Cloudflare Pages Function — 네이버 블로그 동기화
// GET /api/sync-blogs?key=YOUR_SECRET_KEY

// 블로그 ID 추출
function extractBlogId(blogUrl) {
  const match = blogUrl.match(/blog\.naver\.com\/([^/?#]+)/);
  return match ? match[1] : null;
}

// 최근 글 목록 가져오기
async function fetchPostList(blogId, count = 5) {
  const url = `https://blog.naver.com/PostTitleListAsync.naver?blogId=${blogId}&currentPage=1&countPerPage=${count}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`PostTitleListAsync failed: ${res.status}`);
  const text = await res.text();

  const posts = [];
  const logNoRegex = /"logNo"\s*:\s*"?(\d+)"?/g;
  const titleRegex = /"title"\s*:\s*"([^"]+)"/g;
  const dateRegex = /"addDate"\s*:\s*"([^"]+)"/g;

  const logNos = [...text.matchAll(logNoRegex)].map((m) => m[1]);
  const titles = [...text.matchAll(titleRegex)].map((m) => m[1]);
  const dates = [...text.matchAll(dateRegex)].map((m) => m[1]);

  for (let i = 0; i < logNos.length; i++) {
    posts.push({
      logNo: logNos[i],
      title: decodeURIComponent((titles[i] || "").replace(/\+/g, " ")),
      date: dates[i] || "",
    });
  }
  return posts;
}

// 글 본문 가져오기
async function fetchPostContent(blogId, logNo) {
  const url = `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}&directAccess=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`PostView failed: ${res.status}`);
  const html = await res.text();

  const textParts = [];
  const spanRegex =
    /<span[^>]*class="se-fs-[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
  let match;
  while ((match = spanRegex.exec(html)) !== null) {
    const text = match[1]
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    if (text) textParts.push(text);
  }

  if (textParts.length === 0) {
    const pRegex =
      /<div class="se-module se-module-text[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g;
    while ((match = pRegex.exec(html)) !== null) {
      const text = match[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();
      if (text) textParts.push(text);
    }
  }

  const fullText = textParts.join(" ");
  return fullText.length > 500 ? fullText.slice(0, 500) + "..." : fullText;
}

// 동기화 주기: 3일 (밀리초)
const SYNC_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

export async function onRequestGet(context) {
  // 간단한 비밀키 인증
  const url = new URL(context.request.url);
  const key = url.searchParams.get("key");
  const force = url.searchParams.get("force") === "true";
  const syncKey = context.env.SYNC_KEY;

  if (syncKey && key !== syncKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!context.env.FACILITY_DATA) {
    return new Response(
      JSON.stringify({ error: "FACILITY_DATA KV not bound" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // KV에서 시설 목록 조회 (facility:* 키들)
    const listResult = await context.env.FACILITY_DATA.list({
      prefix: "facility:",
    });

    const results = {};

    for (const key of listResult.keys) {
      const facilityId = key.name.replace("facility:", "");
      const facility = await context.env.FACILITY_DATA.get(
        key.name,
        "json"
      );

      if (!facility || !facility.blog) continue;

      const blogId = extractBlogId(facility.blog);
      if (!blogId) continue;

      // 3일 이내 동기화된 시설은 건너뛰기
      if (!force) {
        const existing = await context.env.FACILITY_DATA.get(
          `blog-posts:${facilityId}`,
          "json"
        );
        if (existing && existing.lastSync) {
          const elapsed = Date.now() - new Date(existing.lastSync).getTime();
          if (elapsed < SYNC_INTERVAL_MS) {
            results[facilityId] = { status: "skipped", reason: "synced recently" };
            continue;
          }
        }
      }

      try {
        const postList = await fetchPostList(blogId, 5);
        const posts = [];

        for (const post of postList) {
          try {
            const content = await fetchPostContent(blogId, post.logNo);
            posts.push({
              title: post.title,
              date: post.date,
              content,
            });
          } catch {
            posts.push({
              title: post.title,
              date: post.date,
              content: "",
            });
          }
        }

        const blogData = {
          lastSync: new Date().toISOString(),
          posts,
        };

        // KV에 블로그 데이터 저장
        await context.env.FACILITY_DATA.put(
          `blog-posts:${facilityId}`,
          JSON.stringify(blogData)
        );

        results[facilityId] = { postsCount: posts.length, status: "ok" };
      } catch (err) {
        results[facilityId] = { status: "error", error: err.message };
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Sync failed", detail: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
