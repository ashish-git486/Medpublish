import { useState, useEffect } from 'react'
import { authorGuidelinesContent } from '../data/authorGuidelinesContent.js'

function AuthorGuidelinesPage() {
  const [activeSection, setActiveSection] = useState('')
  const [openFaq, setOpenFaq] = useState(null)
  const [mobileTocOpen, setMobileTocOpen] = useState(false)

  // Table of contents sections
  const tocSections = [
    { id: 'before-you-submit', label: 'Before You Submit' },
    { id: 'article-types', label: 'Article Types' },
    { id: 'authorship', label: 'Authorship' },
    { id: 'corresponding-author', label: 'Corresponding Author' },
    { id: 'manuscript-file', label: 'Manuscript File' },
    { id: 'manuscript-structure', label: 'Manuscript Structure' },
    { id: 'title', label: 'Title' },
    { id: 'abstract', label: 'Abstract' },
    { id: 'keywords', label: 'Keywords' },
    { id: 'introduction', label: 'Introduction' },
    { id: 'methods', label: 'Methods' },
    { id: 'reporting-guidelines', label: 'Reporting Guidelines' },
    { id: 'results', label: 'Results' },
    { id: 'discussion', label: 'Discussion' },
    { id: 'conclusion', label: 'Conclusion' },
    { id: 'ethics', label: 'Ethics' },
    { id: 'funding', label: 'Funding' },
    { id: 'conflict-of-interest', label: 'Conflict of Interest' },
    { id: 'data-availability', label: 'Data Availability' },
    { id: 'author-contributions', label: 'Author Contributions' },
    { id: 'acknowledgements', label: 'Acknowledgements' },
    { id: 'ai-disclosure', label: 'AI Disclosure' },
    { id: 'references', label: 'References' },
    { id: 'tables', label: 'Tables' },
    { id: 'figures', label: 'Figures' },
    { id: 'copyright-permissions', label: 'Copyright & Permissions' },
    { id: 'originality', label: 'Originality' },
    { id: 'peer-review', label: 'Peer Review' },
    { id: 'blind-review', label: 'Blind Review' },
    { id: 'submission-process', label: 'Submission Process' },
    { id: 'faq', label: 'FAQ' },
  ]

  // Handle scroll-based active section highlighting
  useEffect(() => {
    const handleScroll = () => {
      const sections = tocSections.map(s => document.getElementById(s.id)).filter(Boolean)
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        const rect = section.getBoundingClientRect()
        if (rect.top <= 150) {
          setActiveSection(tocSections[i].id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      const offset = 120
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
    }
  }

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      {/* Page Header */}
      <div className="mb-12">
        <h1 className="font-serif text-4xl font-semibold text-ink sm:text-5xl">
          {authorGuidelinesContent.header.title}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">
          {authorGuidelinesContent.header.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-4">
        {/* Sticky Table of Contents - Desktop */}
        <aside className="hidden lg:block lg:col-span-1">
          <div className="sticky top-24">
            <h3 className="font-mono text-xs uppercase tracking-wide text-teal-700">
              Contents
            </h3>
            <nav className="mt-4 space-y-1">
              {tocSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={`block w-full text-left text-sm transition-colors ${
                    activeSection === section.id
                      ? 'font-medium text-teal-700'
                      : 'text-slate-600 hover:text-teal-700'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Mobile Table of Contents Dropdown */}
          <div className="mb-8 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTocOpen(!mobileTocOpen)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 text-left"
            >
              <span className="font-medium text-ink">Jump to section</span>
              <span className="text-slate-400">{mobileTocOpen ? '−' : '+'}</span>
            </button>
            {mobileTocOpen && (
              <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                {tocSections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => {
                      scrollToSection(section.id)
                      setMobileTocOpen(false)
                    }}
                    className="block w-full rounded px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Before You Submit Checklist */}
          <section id="before-you-submit" className="mb-16 scroll-mt-28">
            <div className="rounded-xl border-2 border-teal-100 bg-teal-50/50 p-6">
              <h2 className="font-serif text-2xl font-semibold text-ink">
                {authorGuidelinesContent.beforeYouSubmit.title}
              </h2>
              <p className="mt-2 text-slate-600">
                {authorGuidelinesContent.beforeYouSubmit.description}
              </p>
              <ul className="mt-4 space-y-2">
                {authorGuidelinesContent.beforeYouSubmit.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full border-2 border-teal-300 bg-white flex items-center justify-center">
                      <span className="text-xs text-teal-600">✓</span>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Article Types */}
          <section id="article-types" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.articleTypes.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.articleTypes.description}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {authorGuidelinesContent.articleTypes.types.map((type) => (
                <div
                  key={type.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="font-serif text-lg font-semibold text-ink">
                    {type.name}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">{type.description}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Authorship */}
          <section id="authorship" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.authorship.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.authorship.description}
            </p>
            <div className="mt-6 space-y-6">
              {authorGuidelinesContent.authorship.criteria.map((criterion, index) => (
                <div key={index}>
                  <h3 className="font-serif text-lg font-semibold text-ink">
                    {criterion.title}
                  </h3>
                  <ul className="mt-2 space-y-1">
                    {criterion.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Corresponding Author */}
          <section id="corresponding-author" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.correspondingAuthor.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.correspondingAuthor.description}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-ink">
                  Responsibilities
                </h3>
                <ul className="mt-3 space-y-2">
                  {authorGuidelinesContent.correspondingAuthor.responsibilities.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-ink">
                  Recommended Information
                </h3>
                <ul className="mt-3 space-y-2">
                  {authorGuidelinesContent.correspondingAuthor.recommendedInfo.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Manuscript File */}
          <section id="manuscript-file" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.manuscriptFile.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.manuscriptFile.description}
            </p>
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-ink">
                  {authorGuidelinesContent.manuscriptFile.formats.main.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {authorGuidelinesContent.manuscriptFile.formats.main.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {authorGuidelinesContent.manuscriptFile.formats.main.formats.map((format) => (
                    <span
                      key={format}
                      className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700"
                    >
                      {format}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-ink">
                  {authorGuidelinesContent.manuscriptFile.formats.supplementary.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {authorGuidelinesContent.manuscriptFile.formats.supplementary.description}
                </p>
                <ul className="mt-3 space-y-1">
                  {authorGuidelinesContent.manuscriptFile.formats.supplementary.examples.map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Manuscript Structure */}
          <section id="manuscript-structure" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.manuscriptStructure.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.manuscriptStructure.description}
            </p>
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <ol className="space-y-2">
                {authorGuidelinesContent.manuscriptStructure.sections.map((section, index) => (
                  <li key={index} className="flex items-start gap-3 text-sm text-slate-700">
                    <span className="mt-0.5 h-6 w-6 flex-shrink-0 rounded-full bg-teal-100 text-center text-xs font-medium text-teal-700 flex items-center justify-center">
                      {index + 1}
                    </span>
                    {section}
                  </li>
                ))}
              </ol>
              <p className="mt-4 text-xs italic text-slate-500">
                {authorGuidelinesContent.manuscriptStructure.note}
              </p>
            </div>
          </section>

          {/* Title */}
          <section id="title" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.title.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.title.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.title.guidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {guideline}
                </li>
              ))}
            </ul>
          </section>

          {/* Abstract */}
          <section id="abstract" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.abstract.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.abstract.description}
            </p>
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-ink">
                  {authorGuidelinesContent.abstract.structure.research.title}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {authorGuidelinesContent.abstract.structure.research.items.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-serif text-lg font-semibold text-ink">
                  {authorGuidelinesContent.abstract.structure.other.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {authorGuidelinesContent.abstract.structure.other.description}
                </p>
              </div>
            </div>
          </section>

          {/* Keywords */}
          <section id="keywords" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.keywords.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.keywords.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.keywords.guidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {guideline}
                </li>
              ))}
            </ul>
          </section>

          {/* Introduction */}
          <section id="introduction" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.introduction.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.introduction.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.introduction.guidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {guideline}
                </li>
              ))}
            </ul>
          </section>

          {/* Methods */}
          <section id="methods" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.methods.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.methods.description}
            </p>
            <div className="mt-6 space-y-4">
              {authorGuidelinesContent.methods.subsections.map((subsection, index) => (
                <div key={index} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-serif text-lg font-semibold text-ink">
                    {subsection.title}
                  </h3>
                  <ul className="mt-3 space-y-1">
                    {subsection.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Reporting Guidelines */}
          <section id="reporting-guidelines" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.reportingGuidelines.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.reportingGuidelines.description}
            </p>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {authorGuidelinesContent.reportingGuidelines.guidelines.map((guideline) => (
                <div
                  key={guideline.name}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="font-mono text-sm font-semibold text-teal-700">
                    {guideline.name}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{guideline.description}</div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs italic text-slate-500">
              {authorGuidelinesContent.reportingGuidelines.note}
            </p>
          </section>

          {/* Results */}
          <section id="results" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.results.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.results.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.results.guidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {guideline}
                </li>
              ))}
            </ul>
          </section>

          {/* Discussion */}
          <section id="discussion" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.discussion.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.discussion.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.discussion.guidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {guideline}
                </li>
              ))}
            </ul>
          </section>

          {/* Conclusion */}
          <section id="conclusion" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.conclusion.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.conclusion.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.conclusion.guidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {guideline}
                </li>
              ))}
            </ul>
          </section>

          {/* Ethics */}
          <section id="ethics" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.ethics.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.ethics.description}
            </p>
            <div className="mt-6 space-y-4">
              {authorGuidelinesContent.ethics.subsections.map((subsection, index) => (
                <div key={index} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-serif text-lg font-semibold text-ink">
                    {subsection.title}
                  </h3>
                  <ul className="mt-3 space-y-1">
                    {subsection.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {/* Funding */}
          <section id="funding" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.funding.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.funding.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.funding.requirements.map((requirement, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {requirement}
                </li>
              ))}
            </ul>
          </section>

          {/* Conflict of Interest */}
          <section id="conflict-of-interest" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.conflictOfInterest.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.conflictOfInterest.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.conflictOfInterest.types.map((type, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {type}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs italic text-slate-500">
              {authorGuidelinesContent.conflictOfInterest.note}
            </p>
          </section>

          {/* Data Availability */}
          <section id="data-availability" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.dataAvailability.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.dataAvailability.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.dataAvailability.examples.map((example, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {example}
                </li>
              ))}
            </ul>
          </section>

          {/* Author Contributions */}
          <section id="author-contributions" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.authorContributions.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.authorContributions.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {authorGuidelinesContent.authorContributions.roles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700"
                >
                  {role}
                </span>
              ))}
            </div>
          </section>

          {/* Acknowledgements */}
          <section id="acknowledgements" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.acknowledgements.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.acknowledgements.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.acknowledgements.examples.map((example, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {example}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs italic text-slate-500">
              {authorGuidelinesContent.acknowledgements.note}
            </p>
          </section>

          {/* AI Disclosure */}
          <section id="ai-disclosure" className="mb-16 scroll-mt-28">
            <div className="rounded-xl border-2 border-gold-200 bg-gold-50/50 p-6">
              <h2 className="font-serif text-2xl font-semibold text-ink">
                {authorGuidelinesContent.aiDisclosure.title}
              </h2>
              <p className="mt-2 text-slate-600">
                {authorGuidelinesContent.aiDisclosure.description}
              </p>
              <ul className="mt-4 space-y-2">
                {authorGuidelinesContent.aiDisclosure.policies.map((policy, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gold-500" />
                    {policy}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* References */}
          <section id="references" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.references.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.references.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.references.guidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {guideline}
                </li>
              ))}
            </ul>
          </section>

          {/* Tables */}
          <section id="tables" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.tables.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.tables.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.tables.guidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {guideline}
                </li>
              ))}
            </ul>
          </section>

          {/* Figures */}
          <section id="figures" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.figures.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.figures.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.figures.guidelines.map((guideline, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {guideline}
                </li>
              ))}
            </ul>
          </section>

          {/* Copyright & Permissions */}
          <section id="copyright-permissions" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.copyrightPermissions.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.copyrightPermissions.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.copyrightPermissions.requirements.map((requirement, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {requirement}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs italic text-slate-500">
              {authorGuidelinesContent.copyrightPermissions.note}
            </p>
          </section>

          {/* Originality */}
          <section id="originality" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.originality.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.originality.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.originality.policies.map((policy, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {policy}
                </li>
              ))}
            </ul>
          </section>

          {/* Peer Review */}
          <section id="peer-review" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.peerReview.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.peerReview.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.peerReview.process.map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Blind Review */}
          <section id="blind-review" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.blindReview.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.blindReview.description}
            </p>
            <ul className="mt-4 space-y-2">
              {authorGuidelinesContent.blindReview.removals.map((removal, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-teal-600" />
                  {removal}
                </li>
              ))}
            </ul>
          </section>

          {/* Submission Process */}
          <section id="submission-process" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.submissionProcess.title}
            </h2>
            <p className="mt-2 text-slate-600">
              {authorGuidelinesContent.submissionProcess.description}
            </p>
            <div className="mt-6 space-y-4">
              {authorGuidelinesContent.submissionProcess.steps.map((step) => (
                <div key={step.step} className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-teal-600 font-serif text-lg font-semibold text-white">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-serif text-lg font-semibold text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="mb-16 scroll-mt-28">
            <h2 className="font-serif text-2xl font-semibold text-ink">
              {authorGuidelinesContent.faq.title}
            </h2>
            <div className="mt-6 space-y-3">
              {authorGuidelinesContent.faq.questions.map((faq, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <span className="font-medium text-ink">{faq.question}</span>
                    <span className="ml-4 flex-shrink-0 text-slate-400">
                      {openFaq === index ? '−' : '+'}
                    </span>
                  </button>
                  {openFaq === index && (
                    <div className="border-t border-slate-200 p-4 text-sm text-slate-600">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

export default AuthorGuidelinesPage