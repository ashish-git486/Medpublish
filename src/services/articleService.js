// Combines the static mock articles with real, editor-approved manuscripts
// from Supabase so the public Library and Article Detail pages can treat
// both as one list. This is the only place that merge happens — pages
// should import from here instead of reaching into mockData.js and
// manuscriptService.js separately.
//
// NOTE: these functions are now async (they hit Supabase), unlike the old
// localStorage-only version. Callers must await them.

import { articles as mockArticles, getCategoryBySlug } from '../data/mockData.js'
import { getPublishedSubmissions } from './manuscriptService.js'

const WORDS_PER_MINUTE = 200

function estimateReadTime(content) {
  const wordCount = content?.trim().split(/\s+/).filter(Boolean).length ?? 0
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE))
}

/** Shape an approved manuscript submission like a mock article. */
function submissionToArticle(submission) {
  return {
    id: submission.id,
    title: submission.title,
    abstract: submission.abstract,
    categorySlug: submission.categorySlug,
    authorName: submission.authors,
    authorAffiliation: submission.institution || 'Independent submission',
    publishedAt: submission.reviewedAt ?? submission.submittedAt,
    articleType: submission.articleType,
    doi: null,
    openAccess: true,
    readTimeMinutes: estimateReadTime(submission.content),
    citationCount: 0,
    featured: false,
    isLocalSubmission: true,
    content: submission.content,
    keywords: submission.keywords,
    references: submission.references,
  }
}

/** Every article visible to the public: mock articles + approved submissions. */
export async function getAllArticles() {
  const { data: publishedSubmissions } = await getPublishedSubmissions()
  const liveArticles = (publishedSubmissions ?? []).map(submissionToArticle)
  return [...liveArticles, ...mockArticles]
}

/** Look up a single article by id, whether it's a mock article or a submission. */
export async function getArticleById(id) {
  const allArticles = await getAllArticles()
  return allArticles.find((article) => article.id === id)
}

export async function getAllArticlesByCategory(slug) {
  const allArticles = await getAllArticles()
  return allArticles.filter((article) => article.categorySlug === slug)
}

export async function searchAllArticles(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const allArticles = await getAllArticles()
  return allArticles.filter((article) => {
    const category = getCategoryBySlug(article.categorySlug)
    return (
      article.title.toLowerCase().includes(q) ||
      article.authorName.toLowerCase().includes(q) ||
      (category && category.name.toLowerCase().includes(q))
    )
  })
}
