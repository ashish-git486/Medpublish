// Document extraction utilities for PDF and DOCX files
// Handles structured text extraction and scholarly metadata detection

import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

/**
 * Extract structured text from a DOCX file using mammoth.js
 * Preserves paragraph structure and basic formatting information
 */
export async function extractTextFromDOCX(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    
    // Use mammoth to extract raw text with paragraph structure
    const result = await mammoth.extractRawText({ 
      arrayBuffer,
      transformDocument: (doc) => {
        // Access document structure to preserve paragraph information
        return doc
      }
    })
    
    // Split into paragraphs while preserving structure
    const paragraphs = result.value.split('\n').map(p => p.trim()).filter(p => p.length > 0)
    
    return {
      success: true,
      text: result.value,
      paragraphs: paragraphs,
      messages: result.messages,
    }
  } catch (error) {
    return {
      success: false,
      text: '',
      paragraphs: [],
      error: error.message,
    }
  }
}

/**
 * Extract text from a PDF file using PDF.js
 */
export async function extractTextFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    
    let fullText = ''
    const numPages = pdf.numPages
    
    // Extract text from each page
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      
      // Get text items and join them
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
      
      fullText += pageText + '\n\n'
    }
    
    // Check if we got meaningful text (not just spaces)
    const cleanedText = fullText.trim()
    if (cleanedText.length < 50) {
      return {
        success: false,
        text: '',
        error: 'This PDF appears to contain scanned/image-only pages. Automatic text extraction was not available.',
        isScanned: true,
      }
    }
    
    return {
      success: true,
      text: cleanedText,
      numPages,
    }
  } catch (error) {
    return {
      success: false,
      text: '',
      error: error.message,
    }
  }
}

/**
 * Extract scholarly metadata from document text using structured analysis
 * Uses improved heuristics to detect title, authors, abstract, keywords, DOI, etc.
 */
export function extractScholarlyMetadata(text, paragraphs = null) {
  if (!text || text.trim().length === 0) {
    return {
      title: '',
      authors: '',
      abstract: '',
      keywords: '',
      doi: '',
      affiliations: '',
      references: '',
      correspondingAuthorName: '',
      correspondingAuthorEmail: '',
      journalName: '',
      volume: '',
      issue: '',
      pageRange: '',
      publicationDate: '',
      articleType: '',
      confidence: {},
    }
  }

  // Use provided paragraphs or derive from text
  const lines = paragraphs || text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  const confidence = {
    title: 'low',
    authors: 'low',
    abstract: 'low',
    keywords: 'low',
    doi: 'low',
    affiliations: 'low',
    references: 'low',
    correspondingAuthor: 'low',
    journal: 'low',
  }

  // Detect title (first substantial line that's not metadata)
  let title = detectTitle(lines, text)
  confidence.title = title.confidence
  title = title.value

  // Detect authors (usually after title, before abstract)
  let authors = detectAuthors(lines, text)
  confidence.authors = authors.confidence
  authors = authors.value

  // Detect affiliations (usually near authors)
  let affiliations = detectAffiliations(lines, text)
  confidence.affiliations = affiliations.confidence
  affiliations = affiliations.value

  // Detect corresponding author
  let correspondingAuthor = detectCorrespondingAuthor(text)
  confidence.correspondingAuthor = correspondingAuthor.confidence
  const correspondingAuthorName = correspondingAuthor.name
  const correspondingAuthorEmail = correspondingAuthor.email

  // Detect abstract
  let abstract = detectAbstract(text)
  confidence.abstract = abstract.confidence
  abstract = abstract.value

  // Detect keywords
  let keywords = detectKeywords(text)
  confidence.keywords = keywords.confidence
  keywords = keywords.value

  // Detect DOI
  let doi = detectDOI(text)
  confidence.doi = doi.confidence
  doi = doi.value

  // Detect journal name
  let journalName = detectJournalName(text)
  confidence.journal = journalName.confidence
  journalName = journalName.value

  // Detect publication metadata (volume, issue, pages)
  let publicationMetadata = detectPublicationMetadata(text)
  const volume = publicationMetadata.volume
  const issue = publicationMetadata.issue
  const pageRange = publicationMetadata.pageRange
  const publicationDate = publicationMetadata.publicationDate

  // Detect references section
  let references = detectReferences(text)
  confidence.references = references.confidence
  references = references.value

  // Detect article type
  let articleType = detectArticleType(text)

  return {
    title,
    authors,
    abstract,
    keywords,
    doi,
    affiliations,
    references,
    correspondingAuthorName,
    correspondingAuthorEmail,
    journalName,
    volume,
    issue,
    pageRange,
    publicationDate,
    articleType,
    confidence,
  }
}

/**
 * Detect document title using improved heuristics
 * Avoids metadata labels and scores candidates properly
 */
function detectTitle(lines, fullText) {
  const titleCandidates = []
  
  // Expanded list of non-title patterns to avoid
  const nonTitlePatterns = [
    /^(abstract|keywords|key words|introduction|background|methods|materials|results|discussion|conclusion|references|bibliography)$/i,
    /^(type of article|article type|authors|affiliations|corresponding author|correspondence)$/i,
    /^(doi|digital object identifier|journal|volume|issue|pages|page range)$/i,
    /^(received|accepted|published|submitted|revised)$/i,
    /^\d+$/, // Just numbers
    /^[©℗®]/, // Copyright symbols
    /^http/, // URLs
    /^@/, // Email-like
    /^\w+@\w+\.\w+$/, // Email
    /^(department|institute|university|hospital|college|school|center|laboratory)/i, // Institutional headers
  ]
  
  // Function to check if line is a non-title line
  function isNonTitleLine(line) {
    return nonTitlePatterns.some(pattern => pattern.test(line))
  }
  
  // Score each potential title candidate
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    const line = lines[i]
    
    // Skip if it's clearly not a title
    if (isNonTitleLine(line)) {
      continue
    }
    
    // Skip if it looks like a label followed by content
    if (/^(.+?)\s*:\s*.+$/.test(line) && line.split(':')[0].length < 50) {
      continue
    }
    
    // Basic title criteria
    if (line.length >= 10 && line.length <= 300 && /[a-zA-Z]/.test(line)) {
      let score = 0
      
      // Position scoring (earlier is better)
      score += Math.max(0, 10 - i) * 2
      
      // Length scoring (moderate length is better)
      if (line.length >= 20 && line.length <= 150) {
        score += 3
      } else if (line.length >= 10 && line.length < 20) {
        score += 1
      }
      
      // Capitalization scoring (mixed case is better than all caps)
      const upperRatio = (line.match(/[A-Z]/g) || []).length / line.length
      if (upperRatio > 0.1 && upperRatio < 0.7) {
        score += 4
      } else if (upperRatio >= 0.7) {
        score -= 2 // All caps is less likely to be title
      }
      
      // Content scoring (contains meaningful words)
      if (/\b(the|a|an|of|in|on|at|by|for|with|about|from|to)\b/i.test(line)) {
        score += 2
      }
      
      // Penalty for being mostly numbers or special characters
      if (/^[\d\s\-\.\(\)\[\]]+$/.test(line)) {
        score -= 10
      }
      
      // Penalty for common metadata patterns
      if (/\b(volume|vol|issue|no|pp|pages|doi|http)\b/i.test(line)) {
        score -= 5
      }
      
      titleCandidates.push({ line, score, index: i })
    }
  }
  
  // Sort by score and return the best candidate
  titleCandidates.sort((a, b) => b.score - a.score)
  
  if (titleCandidates.length > 0 && titleCandidates[0].score > 5) {
    return { value: titleCandidates[0].line, confidence: 'high' }
  } else if (titleCandidates.length > 0 && titleCandidates[0].score > 0) {
    return { value: titleCandidates[0].line, confidence: 'medium' }
  }
  
  // Very low confidence fallback
  if (lines.length > 0 && lines[0].length >= 5 && !isNonTitleLine(lines[0])) {
    return { value: lines[0], confidence: 'low' }
  }
  
  return { value: '', confidence: 'none' }
}

/**
 * Detect authors using improved heuristics
 * Separates author names from affiliations and markers
 */
function detectAuthors(lines, fullText) {
  const authorPatterns = [
    // Standard name patterns
    /^[A-Z][a-z]+ [A-Z][a-z]+(?:, [A-Z][a-z]+ [A-Z][a-z]+)*$/,
    // Names with superscript numbers (affiliation markers)
    /^[A-Z][a-z]+ [A-Z][a-z]+[¹²³⁴⁵⁶⁷⁸⁹⁰]+(?:, [A-Z][a-z]+ [A-Z][a-z]+[¹²³⁴⁵⁶⁷⁸⁹⁰]+)*$/,
    // Names with special characters (common in medical research)
    /^[A-Z][a-z]+[-][A-Z][a-z]+ [A-Z][a-z]+/,
    // Names with initials
    /^[A-Z][a-z]+ [A-Z]\. [A-Z]\./,
  ]
  
  const nonAuthorPatterns = [
    /^(abstract|keywords|key words|introduction|background|methods|materials|results|discussion|conclusion|references|bibliography)$/i,
    /^(type of article|article type|affiliations|corresponding author|correspondence)$/i,
    /^(doi|digital object identifier|journal|volume|issue|pages|page range)$/i,
    /^(department|institute|university|hospital|college|school|center|laboratory)/i,
    /^\d+\s+/, // Numbered lines
    /^[©℗®]/,
    /^http/,
  ]
  
  function isNonAuthorLine(line) {
    return nonAuthorPatterns.some(pattern => pattern.test(line))
  }
  
  let authorLines = []
  let inAuthorBlock = false
  let authorBlockEnded = false
  
  // Look for author block in early lines (typically after title, before abstract)
  for (let i = 1; i < Math.min(15, lines.length); i++) {
    const line = lines[i]
    
    // Stop if we hit major section headers
    if (/^(abstract|introduction|background|methods|keywords)/i.test(line)) {
      authorBlockEnded = true
      break
    }
    
    // Skip clearly non-author lines
    if (isNonAuthorLine(line)) {
      if (inAuthorBlock) {
        // We were in author block and hit a non-author line, end the block
        authorBlockEnded = true
        break
      }
      continue
    }
    
    // Check if this line could be author names
    let isAuthorLine = false
    
    // Check against patterns
    for (const pattern of authorPatterns) {
      if (pattern.test(line)) {
        isAuthorLine = true
        break
      }
    }
    
    // Also check for comma-separated names
    if (!isAuthorLine && line.includes(',')) {
      const parts = line.split(',')
      const validNames = parts.filter(part => /^[A-Z][a-z]+ [A-Z]?[a-z]*/.test(part.trim()))
      if (validNames.length >= 2 && validNames.length <= 12) {
        isAuthorLine = true
      }
    }
    
    // Check for "and" pattern
    if (!isAuthorLine && line.includes(' and ')) {
      const parts = line.split(' and ')
      const validNames = parts.filter(part => /^[A-Z][a-z]+ [A-Z]?[a-z]*/.test(part.trim()))
      if (validNames.length >= 2 && validNames.length <= 6) {
        isAuthorLine = true
      }
    }
    
    if (isAuthorLine) {
      inAuthorBlock = true
      authorLines.push(line)
    } else if (inAuthorBlock) {
      // We were collecting authors and hit a non-author line
      authorBlockEnded = true
      break
    }
  }
  
  // If we found author lines, clean and format them
  if (authorLines.length > 0) {
    // Join the lines and clean up
    let combinedAuthors = authorLines.join(', ')
    
    // Remove common markers and suffixes
    combinedAuthors = combinedAuthors
      .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰†*‡§¶]/g, '') // Remove superscript numbers and symbols
      .replace(/\s*,\s*,\s*/g, ', ') // Fix double commas
      .replace(/\s+and\s+/gi, ', ') // Normalize "and" to commas
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    // If the result looks reasonable, return it
    if (combinedAuthors.length > 5 && combinedAuthors.length < 500) {
      return { value: combinedAuthors, confidence: 'high' }
    }
  }
  
  return { value: '', confidence: 'none' }
}

/**
 * Detect abstract using improved heuristics
 * Detects heading and captures full text including structured abstracts
 */
function detectAbstract(text) {
  const abstractPatterns = [
    // Standard abstract with various section endings
    /abstract\s*:?\s*([\s\S]*?)(?=\n\s*(?:keywords|key words|index terms|introduction|background|methods|materials|results|discussion|conclusion|references|bibliography)\s*[:\n])/im,
    // Abstract ending at KEYWORDS
    /abstract\s*:?\s*([\s\S]*?)(?=\n\s*KEYWORDS\s*\n)/im,
    // Abstract ending at end of document (fallback)
    /abstract\s*:?\s*([\s\S]{50,2000})/im,
  ]
  
  for (const pattern of abstractPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      let abstract = match[1].trim()
      
      // Remove common artifacts and clean up
      abstract = abstract
        .replace(/^\n+/, '') // Remove leading newlines
        .replace(/\n+$/, '') // Remove trailing newlines
        .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
        .replace(/\s+/g, ' ') // Normalize whitespace (first pass)
        .replace(/\n\s+/g, '\n') // Remove leading spaces on lines
        .trim()
      
      // Remove structured abstract labels if present (but keep content)
      abstract = abstract
        .replace(/^(background|objective|methods|results|conclusion)\s*:\s*/gi, '')
        .replace(/\n(background|objective|methods|results|conclusion)\s*:\s*/gi, '\n')
      
      // Check if abstract is reasonable length
      if (abstract.length > 50 && abstract.length < 8000) {
        return { value: abstract, confidence: 'high' }
      }
    }
  }
  
  return { value: '', confidence: 'none' }
}

/**
 * Detect keywords using improved heuristics with normalization
 */
function detectKeywords(text) {
  const keywordPatterns = [
    // Various keyword label patterns
    /keywords?\s*:?\s*([^\n]+)/i,
    /key words\s*:?\s*([^\n]+)/i,
    /index terms\s*:?\s*([^\n]+)/i,
    /key\s*[-–]?\s*words\s*:?\s*([^\n]+)/i,
    // Multi-line keywords
    /keywords?\s*:?\s*([\s\S]*?)(?=\n\s*(?:introduction|background|methods|abstract|references))/im,
  ]
  
  for (const pattern of keywordPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      let keywords = match[1].trim()
      
      // Clean up and normalize separators
      keywords = keywords
        .replace(/;/g, ',') // Convert semicolons to commas
        .replace(/\./g, '') // Remove trailing periods
        .replace(/\n/g, ', ') // Convert newlines to commas
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/,\s*,/g, ',') // Fix double commas
        .replace(/,\s*and\s*/gi, ', ') // Normalize "and"
        .replace(/\s+and\s+/gi, ', ') // Normalize "and" with spaces
        .trim()
      
      // Remove common artifacts
      keywords = keywords
        .replace(/^[:\s,]+/, '') // Remove leading punctuation
        .replace(/[:\s,]+$/, '') // Remove trailing punctuation
      
      // Check if keywords are reasonable
      if (keywords.length > 5 && keywords.length < 800) {
        return { value: keywords, confidence: 'high' }
      }
    }
  }
  
  return { value: '', confidence: 'none' }
}

/**
 * Detect DOI using improved heuristics
 */
function detectDOI(text) {
  const doiPatterns = [
    /doi\s*:?\s*(10\.\d{4,}\/[^\s\n]+)/i,
    /https?:\/\/doi\.org\/(10\.\d{4,}\/[^\s\n]+)/i,
    /digital object identifier\s*:?\s*(10\.\d{4,}\/[^\s\n]+)/i,
    /(10\.\d{4,}\/[^\s\n]+)/,
  ]
  
  for (const pattern of doiPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      let doi = match[1].trim()
      // Clean up trailing punctuation
      doi = doi.replace(/[.,;:]$/, '')
      
      // Validate DOI format
      if (/^10\.\d{4,}\/[^\s]+$/.test(doi)) {
        return { value: doi, confidence: 'high' }
      }
    }
  }
  
  return { value: '', confidence: 'none' }
}

/**
 * Detect corresponding author information
 */
function detectCorrespondingAuthor(text) {
  const patterns = [
    // Various correspondence patterns
    /corresponding\s+(?:author|to)\s*:?\s*([^\n]+?)(?=\n|$)/i,
    /correspondence\s*:?\s*([^\n]+?)(?=\n|$)/i,
    /corresponding\s+(?:author|to)\s*[:\s]+([^\n]+)/i,
    // Email patterns within correspondence
    /(?:corresponding\s+author|correspondence)[\s\S]*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  ]
  
  let name = ''
  let email = ''
  let confidence = 'none'
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const captured = match[1] || match[0]
      
      // Extract email if present
      const emailMatch = captured.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
      if (emailMatch) {
        email = emailMatch[1]
        
        // Extract name (everything before the email)
        const namePart = captured.replace(email, '').replace(/[:\s,]*$/, '').trim()
        if (namePart.length > 2 && namePart.length < 100) {
          name = namePart
        }
        
        confidence = 'high'
        break
      }
    }
  }
  
  // If no email found, try to find just the corresponding author line
  if (!email) {
    const simpleMatch = text.match(/corresponding\s+(?:author|to)\s*:?\s*([^\n]+)/i)
    if (simpleMatch) {
      name = simpleMatch[1].trim()
      confidence = 'low'
    }
  }
  
  return { name, email, confidence }
}

/**
 * Detect journal name from document
 */
function detectJournalName(text) {
  const patterns = [
    // Common journal citation patterns
    /published\s+in\s+([A-Z][^\n]+?)(?:\s+\d{4}|$)/i,
    /journal\s+of\s+[^\n]+/i,
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Journal|Journal|Review|Bulletin|Annals|Archives|Proceedings)\b/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      let journal = match[1].trim()
      // Clean up
      journal = journal.replace(/\s+\d{4}.*/, '').replace(/[.,;:]$/, '').trim()
      
      if (journal.length > 5 && journal.length < 200) {
        return { value: journal, confidence: 'medium' }
      }
    }
  }
  
  return { value: '', confidence: 'none' }
}

/**
 * Detect publication metadata (volume, issue, pages, date)
 */
function detectPublicationMetadata(text) {
  let volume = ''
  let issue = ''
  let pageRange = ''
  let publicationDate = ''
  
  // Volume patterns
  const volumeMatch = text.match(/volume\s*:?\s*(\d+)/i) || 
                      text.match(/vol\.?\s*(\d+)/i) ||
                      text.match(/\b(\d+)\s*\(?\d+\)?\s*\(/) // "12(3)" pattern
  if (volumeMatch) {
    volume = volumeMatch[1]
  }
  
  // Issue patterns
  const issueMatch = text.match(/issue\s*:?\s*(\d+)/i) ||
                     text.match(/no\.?\s*(\d+)/i) ||
                     text.match(/\(\s*(\d+)\s*\)/) // "(3)" pattern
  if (issueMatch) {
    issue = issueMatch[1]
  }
  
  // Page range patterns
  const pageMatch = text.match(/pages?\s*:?\s*(\d+\s*[-–]\s*\d+)/i) ||
                    text.match(/pp\.?\s*:?\s*(\d+\s*[-–]\s*\d+)/i) ||
                    text.match(/p\.?\s*(\d+\s*[-–]\s*\d+)/i)
  if (pageMatch) {
    pageRange = pageMatch[1].replace(/\s+/g, '')
  }
  
  // Publication date patterns
  const dateMatch = text.match(/published\s*:?\s*(\d{4})/i) ||
                    text.match(/(\d{4})\s+[A-Za-z]+/i) ||
                    text.match(/[A-Za-z]+\s+(\d{4})/i)
  if (dateMatch) {
    const year = parseInt(dateMatch[1])
    if (year >= 1900 && year <= new Date().getFullYear() + 2) {
      publicationDate = `${year}-01-01`
    }
  }
  
  return { volume, issue, pageRange, publicationDate }
}

/**
 * Detect affiliations using improved heuristics
 * Captures all affiliations with numbering
 */
function detectAffiliations(lines, fullText) {
  const institutionalPatterns = [
    /university/i,
    /institute/i,
    /hospital/i,
    /college/i,
    /school/i,
    /department/i,
    /center/i,
    /laboratory/i,
    /faculty/i,
    /division/i,
    /clinic/i,
    /medical/i,
    /research/i,
  ]
  
  const nonAffiliationPatterns = [
    /^(abstract|keywords|key words|introduction|background|methods|materials|results|discussion|conclusion|references|bibliography)$/i,
    /^(type of article|article type|authors|corresponding author|correspondence)$/i,
    /^(doi|digital object identifier|journal|volume|issue|pages|page range)$/i,
    /^(received|accepted|published|submitted|revised)$/i,
  ]
  
  function isNonAffiliationLine(line) {
    return nonAffiliationPatterns.some(pattern => pattern.test(line))
  }
  
  const affiliations = []
  let inAffiliationBlock = false
  
  // Look for affiliations (typically after authors, before abstract)
  for (let i = 2; i < Math.min(20, lines.length); i++) {
    const line = lines[i]
    
    // Stop if we hit major section headers
    if (/^(abstract|introduction|background|methods|keywords)/i.test(line)) {
      break
    }
    
    // Skip clearly non-affiliation lines
    if (isNonAffiliationLine(line)) {
      if (inAffiliationBlock) {
        break
      }
      continue
    }
    
    // Check if line contains institutional indicators
    let isInstitutional = false
    for (const pattern of institutionalPatterns) {
      if (pattern.test(line)) {
        isInstitutional = true
        break
      }
    }
    
    // Also check for numbered affiliation patterns (common in medical papers)
    const numberedPattern = /^\d+\s+/.test(line) && line.length > 15
    
    if (isInstitutional || numberedPattern) {
      inAffiliationBlock = true
      
      // Clean up the affiliation line
      let cleanedLine = line
        .replace(/^\d+\s*/, '') // Remove leading numbers
        .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰†*‡§¶]/g, '') // Remove superscript markers
        .trim()
      
      if (cleanedLine.length > 10 && cleanedLine.length < 300) {
        affiliations.push(cleanedLine)
      }
    } else if (inAffiliationBlock && line.length > 15) {
      // Continuation of previous affiliation (multi-line affiliations)
      affiliations.push(line.trim())
    } else if (inAffiliationBlock) {
      // End of affiliation block
      break
    }
  }
  
  // If we found affiliations, format them with numbering
  if (affiliations.length > 0) {
    const formattedAffiliations = affiliations
      .map((aff, index) => `${index + 1} ${aff}`)
      .join('\n')
    
    return { value: formattedAffiliations, confidence: 'medium' }
  }
  
  return { value: '', confidence: 'none' }
}

/**
 * Detect references section with improved extraction
 * Captures complete references section
 */
function detectReferences(text) {
  const referencePatterns = [
    /references\s*$/im,
    /bibliography\s*$/im,
    /cited\s+references\s*$/im,
    /references\s*\n/im,
  ]
  
  for (const pattern of referencePatterns) {
    const match = text.match(pattern)
    if (match) {
      const referenceStart = match.index
      let references = text.substring(referenceStart).trim()
      
      // Remove the "References" header itself
      references = references.replace(/^references\s*\n*/i, '')
      references = references.replace(/^bibliography\s*\n*/i, '')
      
      // Clean up trailing content that might not be references
      // (like acknowledgments, author contributions, etc.)
      const nonReferencePatterns = [
        /\n\s*(?:acknowledgments|acknowledgements|author\s+contributions|conflicts\s+of\s+interest|ethics|funding|disclosure)\s*\n/i,
        /\n\s*(?:supplementary|appendix)\s*\n/i,
      ]
      
      for (const nonRefPattern of nonReferencePatterns) {
        const nonRefMatch = references.match(nonRefPattern)
        if (nonRefMatch) {
          references = references.substring(0, nonRefMatch.index).trim()
          break
        }
      }
      
      // Check if we got meaningful references
      if (references.length > 100 && references.length < 100000) {
        // Clean up formatting
        references = references
          .replace(/\n\s*\n\s*\n/g, '\n\n') // Normalize excessive newlines
          .replace(/^\s+|\s+$/gm, '') // Trim each line
          .trim()
        
        return { value: references, confidence: 'high' }
      }
    }
  }
  
  return { value: '', confidence: 'none' }
}

/**
 * Detect article type from text with improved accuracy
 * More conservative - requires explicit mention
 */
export function detectArticleType(text) {
  const typePatterns = [
    { pattern: /case\s+report|case\s+study|case\s+series/i, type: 'Case Report' },
    { pattern: /systematic\s+review|meta[-\s]?analysis|literature\s+review/i, type: 'Systematic Review' },
    { pattern: /review\s+article|review/i, type: 'Review Article' },
    { pattern: /editorial|commentary|opinion|perspective/i, type: 'Editorial' },
    { pattern: /letter\s+to\s+the\s+editor|correspondence|short\s+communication/i, type: 'Letter' },
    { pattern: /original\s+research|research\s+article|original\s+article/i, type: 'Original Research Article' },
    { pattern: /brief\s+communication|short\s+report/i, type: 'Short Communication' },
  ]
  
  // Only return a type if explicitly mentioned in the document
  for (const { pattern, type } of typePatterns) {
    if (pattern.test(text)) {
      return type
    }
  }
  
  return '' // Return empty if not confidently detected, require manual selection
}

/**
 * Detect publication year from text
 */
export function detectPublicationYear(text) {
  const yearPatterns = [
    /©\s*(\d{4})/,
    /(\d{4})\s+(?:by|published)/i,
    /published\s+(?:in|on)\s+(\d{4})/i,
  ]
  
  for (const pattern of yearPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const year = parseInt(match[1])
      if (year >= 1900 && year <= new Date().getFullYear() + 2) {
        return year.toString()
      }
    }
  }
  
  return ''
}