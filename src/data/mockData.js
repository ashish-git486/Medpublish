// Mock data for the MedPublish prototype.
//
// IMPORTANT: All articles, authors, and affiliations below are entirely
// fictional sample content created for UI development. They do not
// represent real published research.
//
// Field names are deliberately chosen to mirror the future Supabase schema
// (see PROJECT_CONTEXT.md) so that swapping this file for real queries
// later should not require changes to the components that consume it:
//   articles.categorySlug  -> resources.category_id (FK to categories.id)
//   articles.publishedAt   -> resources.published_at
//   articles.articleType   -> resources.article_type
//   articles.featured      -> resources.featured (boolean flag/query filter)

export const categories = [
  {
    id: 'cat-cardiology',
    slug: 'cardiology',
    name: 'Cardiology',
    description: 'Cardiovascular disease, imaging, and interventional research.',
    icon: 'pulse',
  },
  {
    id: 'cat-oncology',
    slug: 'oncology',
    name: 'Oncology',
    description: 'Cancer biology, therapeutics, and clinical oncology.',
    icon: 'cell',
  },
  {
    id: 'cat-neurology',
    slug: 'neurology',
    name: 'Neurology',
    description: 'Neurological disorders, neuroimaging, and cognitive science.',
    icon: 'brain',
  },
  {
    id: 'cat-public-health',
    slug: 'public-health',
    name: 'Public Health',
    description: 'Epidemiology, health policy, and population outcomes.',
    icon: 'globe',
  },
  {
    id: 'cat-infectious-diseases',
    slug: 'infectious-diseases',
    name: 'Infectious Diseases',
    description: 'Pathogens, antimicrobial resistance, and outbreak response.',
    icon: 'virus',
  },
  {
    id: 'cat-medical-education',
    slug: 'medical-education',
    name: 'Medical Education',
    description: 'Curriculum design, clinical training, and pedagogy.',
    icon: 'cap',
  },
]

export const articles = [
  {
    id: 'art-001',
    slug: 'ai-assisted-detection-early-pancreatic-lesions',
    title:
      'AI-Assisted Detection of Early-Stage Pancreatic Lesions in Contrast-Enhanced CT',
    abstract:
      'A retrospective multi-center study evaluating a deep learning model for identifying early pancreatic lesions, showing improved sensitivity over radiologist-only review in a 2,400-scan validation cohort.',
    categorySlug: 'oncology',
    authorName: 'Dr. Amara N. Chen',
    authorAffiliation: 'Dept. of Radiology, Ashcombe University Medical Center',
    publishedAt: '2026-04-18',
    articleType: 'Original Research',
    doi: '10.5555/medpublish.2026.0418',
    openAccess: true,
    readTimeMinutes: 9,
    citationCount: 12,
    featured: true,
  },
  {
    id: 'art-002',
    slug: 'wearable-ecg-arrhythmia-screening-primary-care',
    title:
      'Wearable ECG Screening for Undiagnosed Atrial Fibrillation in Primary Care Populations',
    abstract:
      'This prospective cohort study assesses the diagnostic yield of consumer wearable ECG devices for detecting undiagnosed atrial fibrillation among adults over 65 in a primary care setting.',
    categorySlug: 'cardiology',
    authorName: 'Dr. Femi Okafor',
    authorAffiliation: 'Division of Cardiology, Lindenbrook General Hospital',
    publishedAt: '2026-05-02',
    articleType: 'Clinical Study',
    doi: '10.5555/medpublish.2026.0502',
    openAccess: true,
    readTimeMinutes: 7,
    citationCount: 8,
    featured: true,
  },
  {
    id: 'art-003',
    slug: 'pediatric-neuroimaging-biomarkers-developmental-delay',
    title:
      'Neuroimaging Biomarkers for Early Identification of Developmental Delay in Infants',
    abstract:
      'Using diffusion MRI in a longitudinal infant cohort, this study identifies white-matter connectivity patterns associated with later diagnosis of developmental delay, suggesting a window for earlier intervention.',
    categorySlug: 'neurology',
    authorName: 'Dr. Priya Ramaswamy',
    authorAffiliation: 'Child Neurology Unit, Northgate Children\u2019s Hospital',
    publishedAt: '2026-03-11',
    articleType: 'Original Research',
    doi: '10.5555/medpublish.2026.0311',
    openAccess: true,
    readTimeMinutes: 11,
    citationCount: 15,
    featured: true,
  },
  {
    id: 'art-004',
    slug: 'genomic-surveillance-antimicrobial-resistance-network',
    title:
      'A Genomic Surveillance Network for Tracking Antimicrobial Resistance Across Regional Hospitals',
    abstract:
      'This report describes the design and first-year findings of a shared genomic surveillance network spanning fourteen hospitals, aimed at early detection of emerging antimicrobial resistance patterns.',
    categorySlug: 'infectious-diseases',
    authorName: 'Dr. Elias Voss',
    authorAffiliation: 'Center for Infectious Disease Epidemiology, Calder Institute',
    publishedAt: '2026-05-20',
    articleType: 'Surveillance Report',
    doi: '10.5555/medpublish.2026.0520',
    openAccess: true,
    readTimeMinutes: 10,
    citationCount: 6,
    featured: true,
  },
  {
    id: 'art-005',
    slug: 'community-health-worker-hypertension-management-rural',
    title:
      'Community Health Worker-Led Hypertension Management in Rural Primary Care',
    abstract:
      'A cluster-randomized trial evaluating whether trained community health workers can safely manage routine hypertension follow-up, easing physician workload without compromising blood pressure control outcomes.',
    categorySlug: 'public-health',
    authorName: 'Dr. Grace Muthoni',
    authorAffiliation: 'Department of Global Health, Rift Valley Health Sciences Institute',
    publishedAt: '2026-02-27',
    articleType: 'Randomized Trial',
    doi: '10.5555/medpublish.2026.0227',
    openAccess: true,
    readTimeMinutes: 8,
    citationCount: 9,
    featured: false,
  },
  {
    id: 'art-006',
    slug: 'case-based-curriculum-reform-clinical-reasoning',
    title:
      'Case-Based Curriculum Reform and Its Effect on Clinical Reasoning Scores',
    abstract:
      'Comparing two cohorts of third-year medical students, this study finds a measurable improvement in clinical reasoning assessment scores following a shift to case-based, team-taught curriculum design.',
    categorySlug: 'medical-education',
    authorName: 'Dr. Marcus Webb',
    authorAffiliation: 'Office of Medical Education, Ashcombe University',
    publishedAt: '2026-01-15',
    articleType: 'Educational Research',
    doi: '10.5555/medpublish.2026.0115',
    openAccess: true,
    readTimeMinutes: 6,
    citationCount: 4,
    featured: false,
  },
  {
    id: 'art-007',
    slug: 'remote-monitoring-heart-failure-readmission',
    title:
      'Remote Physiological Monitoring and 30-Day Readmission in Heart Failure Patients',
    abstract:
      'This study examines whether daily remote monitoring of weight and blood pressure after discharge reduces 30-day readmission rates among patients hospitalized for decompensated heart failure.',
    categorySlug: 'cardiology',
    authorName: 'Dr. Sofia Bianchi',
    authorAffiliation: 'Heart Failure Program, Lindenbrook General Hospital',
    publishedAt: '2026-06-03',
    articleType: 'Clinical Study',
    doi: '10.5555/medpublish.2026.0603',
    openAccess: true,
    readTimeMinutes: 8,
    citationCount: 3,
    featured: false,
  },
]

export function getFeaturedArticles() {
  return articles.filter((article) => article.featured)
}

export function getLatestArticles(excludeFeatured = true) {
  const pool = excludeFeatured
    ? articles.filter((article) => !article.featured)
    : articles
  return [...pool].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
  )
}

export function getCategoryBySlug(slug) {
  return categories.find((category) => category.slug === slug)
}

export function searchArticles(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []

  return articles.filter((article) => {
    const category = getCategoryBySlug(article.categorySlug)
    return (
      article.title.toLowerCase().includes(q) ||
      article.authorName.toLowerCase().includes(q) ||
      (category && category.name.toLowerCase().includes(q))
    )
  })
}
