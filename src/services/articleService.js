// Combines the static mock articles, real published manuscripts, and published
// imported publications from Supabase so the public Library and Article Detail
// pages can treat all as one unified list. This is the only place that merge
// happens — pages should import from here instead of reaching into the separate
// services.
//
// NOTE: these functions are now async (they hit Supabase), unlike the old
// localStorage-only version. Callers must await them.

import { articles as mockArticles, getCategoryBySlug } from '../data/mockData.js'
import { getPublishedSubmissions } from './manuscriptService.js'
import { getPublishedPublications, getPublicationFile, getPublicationFileUrl, getPublicationById } from './publicationService.js'

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
    sourceType: 'manuscript',
    content: submission.content,
    keywords: submission.keywords,
    references: submission.references,
  }
}

/** Shape a published imported publication like a mock article. */
function publicationToArticle(publication, file = null, fileUrl = null) {
  // Only include published articles in the public library
  if (publication.publicationStatus !== 'published') {
    return null
  }

  return {
    id: publication.id,
    title: publication.title,
    abstract: publication.abstract,
    categorySlug: publication.category,
    authorName: publication.authors,
    authorAffiliation: publication.affiliations || 'Imported article',
    publishedAt: publication.publishedAt || publication.createdAt,
    articleType: publication.articleType,
    doi: publication.doi,
    openAccess: true,
    readTimeMinutes: 5, // Default for imported articles since we don't have content
    citationCount: 0,
    featured: false,
    isLocalSubmission: false,
    sourceType: 'imported',
    content: null, // Imported articles don't have full text content in the DB
    keywords: publication.keywords,
    references: null,
    publicationFile: fileUrl,
    fileName: file?.fileName,
    journalName: publication.journalName,
    volume: publication.volume,
    issue: publication.issue,
    pageRange: publication.pageRange,
    publicationDate: publication.publicationDate,
  }
}

/** Every article visible to the public: mock articles + published submissions + published imported publications. */
export async function getAllArticles() {
  const [publishedSubmissionsResult, publishedPublicationsResult] = await Promise.all([
    getPublishedSubmissions(),
    getPublishedPublications(),
  ])

  const manuscriptArticles = (publishedSubmissionsResult.data ?? []).map(submissionToArticle)
  
  // Get file information for all publications in parallel
  const publications = publishedPublicationsResult.data ?? []
  const publicationIds = publications.map(p => p.id)
  const filesData = await Promise.all(
    publicationIds.map(id => getPublicationFile(id))
  )
  
  // Get file URLs for publications that have files
  const fileUrlsData = await Promise.all(
    filesData.map(fileResult => {
      if (fileResult.data) {
        return getPublicationFileUrl(fileResult.data.storagePath)
      }
      return { data: null }
    })
  )
  
  // Convert publications to articles with their file information
  const publicationArticles = publications.map((publication, index) => {
    const file = filesData[index]?.data
    const fileUrl = fileUrlsData[index]?.data
    return publicationToArticle(publication, file, fileUrl)
  }).filter(article => article !== null) // Filter out null (non-published) articles

  return [...publicationArticles, ...manuscriptArticles, ...mockArticles]
}

/** Look up a single article by id, whether it's a mock article, submission, or publication. */
export async function getArticleById(id) {
  // First check if it's a publication directly
  const { data: publication } = await getPublicationById(id)
  if (publication && publication.publicationStatus === 'published') {
    // Get file information for this publication
    const { data: file } = await getPublicationFile(publication.id)
    const { data: fileUrl } = file ? await getPublicationFileUrl(file.storagePath) : { data: null }
    return publicationToArticle(publication, file, fileUrl)
  }

  // Fall back to the general search (for manuscripts and mock articles)
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
