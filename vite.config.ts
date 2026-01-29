import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// .dev.vars에서 OPENAI_API_KEY 읽기 (로컬 개발용)
function loadDevVars() {
  try {
    const content = fs.readFileSync(path.resolve(__dirname, '.dev.vars'), 'utf-8')
    const match = content.match(/OPENAI_API_KEY=(.+)/)
    return match ? match[1].trim() : ''
  } catch { return '' }
}

// 시스템 프롬프트 (functions/api/chat.js와 동일)
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
- For emergencies, infection control, or safety incidents, provide accurate guidance.`

// 로컬 개발용 API 미들웨어 Vite 플러그인
function devApiPlugin() {
  const apiKey = loadDevVars()
  return {
    name: 'dev-api',
    configureServer(server: any) {
      server.middlewares.use('/api/chat', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        for await (const chunk of req) body += chunk
        const { message } = JSON.parse(body)

        if (!apiKey) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'OPENAI_API_KEY not set in .dev.vars' }))
          return
        }

        try {
          const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4.1-mini',
              input: [
                { role: 'developer', content: [{ type: 'input_text', text: DEVELOPER_PROMPT }] },
                { role: 'user', content: [{ type: 'input_text', text: message }] },
              ],
              text: { format: { type: 'text' } },
              store: true,
            }),
          })

          if (!response.ok) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: `OpenAI API error: ${response.status}` }))
            return
          }

          const data = await response.json() as any
          const outputItem = data.output?.find((item: any) => item.role === 'assistant')
          const textContent = outputItem?.content?.find((c: any) => c.type === 'output_text')
          const reply = textContent?.text ?? 'No response generated.'

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ reply }))
        } catch (err) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Server error' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApiPlugin()],
})
