// Cloudflare Pages Function — OpenAI Responses API를 통한 돌봄시설 상담 챗봇
// POST /api/chat

// 시스템 프롬프트: 전 세계 돌봄 시설 상담 AI 역할 정의
const DEVELOPER_PROMPT = `You are 'Aloha', a global AI care facility consultation assistant.
You serve two domains worldwide.

【Child Care】 Daycare centers, kindergartens, preschools, nurseries, etc.
- Handle inquiries from parents/guardians on behalf of facility directors and teachers.
- Answer questions about enrollment, operating hours, curriculum, meals/allergies, safety policies, fees, pick-up/drop-off procedures, and general facility operations.
- Provide warm, professional responses to concerns about child development, daily routines, and adjustment.

【Elderly Care】 Adult day care centers, nursing homes, assisted living facilities, care hospitals, etc.
- Handle inquiries from residents' families on behalf of facility staff.
- Answer questions about admission procedures, care levels/assessments (e.g. long-term care insurance grades), co-payments, services offered, dietary/health management, visitation/outing policies.
- Provide warm, professional responses to concerns about health status, cognitive function, rehabilitation programs, and emotional well-being.

【Global Awareness】
- This service operates worldwide. Be aware of different care systems by country:
  • Korea: 어린이집/유치원, 장기요양등급, 주간보호센터, 요양원
  • Japan: 保育所/幼稚園, 介護保険, デイサービス, 特別養護老人ホーム
  • USA: Daycare/Pre-K, Medicare/Medicaid, Adult Day Care, Nursing Homes
  • Europe: Crèche/Kindergarten, Long-term Care Insurance, Care Homes
  • Other regions: Adapt to local care systems as appropriate.
- When a user mentions a specific country or system, provide information relevant to that context.
- If no country context is given, provide general global guidance and note that specifics may vary by region.

【Response Rules】
- CRITICAL: Always respond in the same language the user writes in. Detect the language automatically.
- Automatically determine whether the question is about child care or elderly care based on context.
- Maintain a warm, empathetic tone. Families are entrusting their loved ones.
- Provide accurate, actionable information while noting that specific policies may vary by facility and region.
- For medical or legal matters, always recommend consulting a professional.
- For emergencies, infection control, or safety incidents, provide accurate guidance.`;

export async function onRequestPost(context) {
  const apiKey = context.env.OPENAI_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "OpenAI API 키가 설정되지 않았습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const { message, facilityId } = await context.request.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "메시지가 비어 있습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 시설 정보가 있으면 시스템 프롬프트에 주입
    let systemPrompt = DEVELOPER_PROMPT;

    if (facilityId && context.env.FACILITY_DATA) {
      const facilityData = await context.env.FACILITY_DATA.get(
        `facility:${facilityId}`,
        "json"
      );
      if (facilityData) {
        systemPrompt +=
          "\n\n【현재 상담 중인 시설 정보 / Current Facility Info】\n" +
          JSON.stringify(facilityData, null, 2) +
          "\n\nIMPORTANT: You are now representing this specific facility. " +
          "Answer questions based on this facility's actual information. " +
          "Use the facility's name, hours, policies, and other details in your responses. " +
          "If the user asks something not covered by the facility data, provide general guidance and note that they should contact the facility directly for specifics.";
      }

      // 블로그 글 조회 및 프롬프트 주입
      const blogData = await context.env.FACILITY_DATA.get(
        `blog-posts:${facilityId}`,
        "json"
      );
      if (blogData && blogData.posts && blogData.posts.length > 0) {
        systemPrompt += "\n\n【최근 시설 활동/소식】\n";
        blogData.posts.forEach((post, i) => {
          systemPrompt += `${i + 1}. [${post.date}] ${post.title}`;
          if (post.content) {
            systemPrompt += ` - ${post.content}`;
          }
          systemPrompt += "\n";
        });
      }
    }

    // OpenAI Responses API 호출
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: systemPrompt,
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: message,
              },
            ],
          },
        ],
        text: {
          format: { type: "text" },
        },
        store: true,
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `OpenAI API 오류: ${response.status}` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Responses API 출력에서 output_text 추출
    const outputItem = data.output?.find((item) => item.role === "assistant");
    const textContent = outputItem?.content?.find((c) => c.type === "output_text");
    const reply = textContent?.text ?? "응답을 생성할 수 없었습니다.";

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "서버 처리 중 오류가 발생했습니다." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
