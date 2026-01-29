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

// 로컬 개발용 시설 데이터 로드
function loadFacilities() {
  try {
    const content = fs.readFileSync(path.resolve(__dirname, 'facilities.json'), 'utf-8')
    return JSON.parse(content)
  } catch { return {} }
}

// 로컬 개발용 블로그 캐시 로드
function loadBlogCache() {
  try {
    const content = fs.readFileSync(path.resolve(__dirname, 'blog-cache.json'), 'utf-8')
    return JSON.parse(content)
  } catch { return {} }
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
      // 시설 정보 조회 API
      server.middlewares.use((req: any, res: any, next: any) => {
        const facilityMatch = req.url?.match(/^\/api\/facility\/([^/?]+)/)
        if (!facilityMatch) return next()

        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const facilityId = facilityMatch[1]
        const facilities = loadFacilities()
        const facility = facilities[facilityId]

        if (!facility) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: '시설을 찾을 수 없습니다.' }))
          return
        }

        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(facility))
      })

      // 관리자 API — 시설 CRUD (로컬 개발용)
      server.middlewares.use('/api/admin/facilities', async (req: any, res: any) => {
        // 로컬 개발 시에는 토큰 payload만 decode (서명 검증 생략)
        const authHeader = req.headers['authorization']
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Unauthorized' }))
          return
        }
        try {
          const token = authHeader.slice(7)
          const payloadB64 = token.split('.')[1]
          const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString())
          if (payload.email !== 'pensive.kim@gmail.com') {
            res.statusCode = 403
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Forbidden' }))
            return
          }
        } catch {
          res.statusCode = 401
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid token' }))
          return
        }

        const facilitiesPath = path.resolve(__dirname, 'facilities.json')

        if (req.method === 'GET') {
          const facilities = loadFacilities()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(facilities))
          return
        }

        if (req.method === 'POST') {
          let body = ''
          for await (const chunk of req) body += chunk
          const { id, data } = JSON.parse(body)
          if (!id || !data) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'id and data are required' }))
            return
          }
          const facilities = loadFacilities()
          facilities[id] = data
          fs.writeFileSync(facilitiesPath, JSON.stringify(facilities, null, 2), 'utf-8')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, id }))
          return
        }

        if (req.method === 'DELETE') {
          let body = ''
          for await (const chunk of req) body += chunk
          const { id } = JSON.parse(body)
          if (!id) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'id is required' }))
            return
          }
          const facilities = loadFacilities()
          delete facilities[id]
          fs.writeFileSync(facilitiesPath, JSON.stringify(facilities, null, 2), 'utf-8')
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, id }))
          return
        }

        res.statusCode = 405
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: 'Method not allowed' }))
      })

      // 블로그 동기화 API
      server.middlewares.use('/api/sync-blogs', async (req: any, res: any) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        const { execSync } = await import('child_process')
        try {
          execSync('node scripts/sync-blogs.js', { cwd: path.resolve(__dirname), stdio: 'inherit' })
          const blogCache = loadBlogCache()
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ ok: true, facilities: Object.keys(blogCache) }))
        } catch (err: any) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Sync failed', detail: err.message }))
        }
      })

      // 채팅 API
      server.middlewares.use('/api/chat', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        let body = ''
        for await (const chunk of req) body += chunk
        const { message, facilityId } = JSON.parse(body)

        if (!apiKey) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'OPENAI_API_KEY not set in .dev.vars' }))
          return
        }

        // 시설 정보가 있으면 시스템 프롬프트에 주입
        let systemPrompt = DEVELOPER_PROMPT

        if (facilityId) {
          const facilities = loadFacilities()
          const facilityData = facilities[facilityId]
          if (facilityData) {
            systemPrompt +=
              '\n\n【현재 상담 중인 시설 정보 / Current Facility Info】\n' +
              JSON.stringify(facilityData, null, 2) +
              '\n\nIMPORTANT: You are now representing this specific facility. ' +
              'Answer questions based on this facility\'s actual information. ' +
              'Use the facility\'s name, hours, policies, and other details in your responses. ' +
              'If the user asks something not covered by the facility data, provide general guidance and note that they should contact the facility directly for specifics.'
          }

          // 블로그 캐시에서 최근 글 주입
          const blogCache = loadBlogCache()
          const blogData = blogCache[facilityId]
          if (blogData && blogData.posts && blogData.posts.length > 0) {
            systemPrompt += '\n\n【최근 시설 활동/소식】\n'
            blogData.posts.forEach((post: any, i: number) => {
              systemPrompt += `${i + 1}. [${post.date}] ${post.title}`
              if (post.content) {
                systemPrompt += ` - ${post.content}`
              }
              systemPrompt += '\n'
            })
          }
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
                { role: 'developer', content: [{ type: 'input_text', text: systemPrompt }] },
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
