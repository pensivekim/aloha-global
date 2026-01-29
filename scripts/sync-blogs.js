#!/usr/bin/env node
// 로컬 블로그 동기화 스크립트
// Usage: node scripts/sync-blogs.js

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// 블로그 ID 추출 (https://blog.naver.com/blogId → blogId)
function extractBlogId(blogUrl) {
  const match = blogUrl.match(/blog\.naver\.com\/([^/?#]+)/)
  return match ? match[1] : null
}

// 최근 글 목록 가져오기 (PostTitleListAsync)
async function fetchPostList(blogId, count = 5) {
  const url = `https://blog.naver.com/PostTitleListAsync.naver?blogId=${blogId}&currentPage=1&countPerPage=${count}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`PostTitleListAsync failed: ${res.status}`)
  const text = await res.text()

  const posts = []
  const logNoRegex = /"logNo"\s*:\s*"?(\d+)"?/g
  const titleRegex = /"title"\s*:\s*"([^"]+)"/g
  const dateRegex = /"addDate"\s*:\s*"([^"]+)"/g

  const logNos = [...text.matchAll(logNoRegex)].map(m => m[1])
  const titles = [...text.matchAll(titleRegex)].map(m => m[1])
  const dates = [...text.matchAll(dateRegex)].map(m => m[1])

  for (let i = 0; i < logNos.length; i++) {
    posts.push({
      logNo: logNos[i],
      title: decodeURIComponent((titles[i] || '').replace(/\+/g, ' ')),
      date: dates[i] || '',
    })
  }
  return posts
}

// 글 본문 가져오기 (PostView.naver)
async function fetchPostContent(blogId, logNo) {
  const url = `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}&directAccess=false`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`PostView failed: ${res.status}`)
  const html = await res.text()

  // SE-* 클래스에서 텍스트 추출
  const textParts = []
  // se-text-paragraph 안의 span 텍스트 추출
  const spanRegex = /<span[^>]*class="se-fs-[^"]*"[^>]*>([\s\S]*?)<\/span>/g
  let match
  while ((match = spanRegex.exec(html)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
    if (text) textParts.push(text)
  }

  // 대체: se-module-text 안의 p 태그
  if (textParts.length === 0) {
    const pRegex = /<div class="se-module se-module-text[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/g
    while ((match = pRegex.exec(html)) !== null) {
      const text = match[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim()
      if (text) textParts.push(text)
    }
  }

  const fullText = textParts.join(' ')
  // 500자로 자르기 (토큰 절약)
  return fullText.length > 500 ? fullText.slice(0, 500) + '...' : fullText
}

// 동기화 주기: 3일 (밀리초)
const SYNC_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000

// 기존 블로그 캐시 로드
function loadExistingCache() {
  try {
    const content = fs.readFileSync(path.join(ROOT, 'blog-cache.json'), 'utf-8')
    return JSON.parse(content)
  } catch { return {} }
}

// 메인 동기화 로직
async function syncBlogs() {
  const force = process.argv.includes('--force')
  const facilitiesPath = path.join(ROOT, 'facilities.json')
  const facilities = JSON.parse(fs.readFileSync(facilitiesPath, 'utf-8'))

  const blogCache = loadExistingCache()

  for (const [facilityId, facility] of Object.entries(facilities)) {
    if (!facility.blog) continue

    const blogId = extractBlogId(facility.blog)
    if (!blogId) {
      console.log(`[${facilityId}] 블로그 ID 추출 실패: ${facility.blog}`)
      continue
    }

    // 3일 이내 동기화된 시설은 건너뛰기
    if (!force && blogCache[facilityId]?.lastSync) {
      const lastSync = new Date(blogCache[facilityId].lastSync).getTime()
      const elapsed = Date.now() - lastSync
      if (elapsed < SYNC_INTERVAL_MS) {
        const remainDays = ((SYNC_INTERVAL_MS - elapsed) / (24 * 60 * 60 * 1000)).toFixed(1)
        console.log(`[${facilityId}] 최근 동기화됨 — 다음 동기화까지 ${remainDays}일 남음 (--force로 강제 실행 가능)`)
        continue
      }
    }

    console.log(`[${facilityId}] 블로그 동기화 시작: ${blogId}`)

    try {
      const postList = await fetchPostList(blogId, 5)
      console.log(`  → ${postList.length}개 글 발견`)

      const posts = []
      for (const post of postList) {
        try {
          const content = await fetchPostContent(blogId, post.logNo)
          posts.push({
            title: post.title,
            date: post.date,
            content,
          })
          console.log(`  → "${post.title}" 본문 추출 완료`)
        } catch (err) {
          console.log(`  → "${post.title}" 본문 추출 실패: ${err.message}`)
          posts.push({
            title: post.title,
            date: post.date,
            content: '',
          })
        }
      }

      blogCache[facilityId] = {
        lastSync: new Date().toISOString(),
        posts,
      }
    } catch (err) {
      console.log(`[${facilityId}] 글 목록 조회 실패: ${err.message}`)
    }
  }

  const outputPath = path.join(ROOT, 'blog-cache.json')
  fs.writeFileSync(outputPath, JSON.stringify(blogCache, null, 2), 'utf-8')
  console.log(`\n블로그 캐시 저장 완료: ${outputPath}`)
}

syncBlogs().catch(err => {
  console.error('동기화 실패:', err)
  process.exit(1)
})
