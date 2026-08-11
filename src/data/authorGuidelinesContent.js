/**
 * Author Guidelines Content Configuration
 * 
 * This structured content is designed to be future-proof for admin configuration.
 * Each section can be made editable from a CMS without requiring frontend redesign.
 */

export const authorGuidelinesContent = {
  meta: {
    title: 'Author Guidelines',
    description: 'Instructions for preparing and submitting manuscripts to MedPublish, including article types, manuscript structure, ethics, authorship, reporting guidelines, references, figures and submission requirements.',
  },
  
  header: {
    title: 'Author Guidelines',
    subtitle: 'Please review these requirements carefully before submitting your manuscript to MedPublish.',
  },

  beforeYouSubmit: {
    title: 'Before You Submit',
    description: 'Review this checklist to ensure your manuscript is ready for submission.',
    items: [
      'The manuscript is original and is not simultaneously under consideration elsewhere.',
      'All listed authors have approved the manuscript and its submission.',
      'The corresponding author has been identified and can be contacted.',
      'The manuscript follows the appropriate article-type requirements.',
      'The manuscript contains all required sections for its article type.',
      'Ethical approval information is provided where applicable.',
      'Funding information is disclosed.',
      'Conflicts of interest are disclosed.',
      'Data availability information is provided where applicable.',
      'Appropriate reporting guidelines have been followed where applicable.',
      'References have been checked for completeness and consistency.',
      'Figures and tables are properly labelled and cited in the text.',
      'Permissions have been obtained for copyrighted material.',
      'Required supplementary documents are included.',
    ],
  },

  articleTypes: {
    title: 'Article Types',
    description: 'MedPublish accepts the following types of manuscripts.',
    types: [
      {
        id: 'original-research',
        name: 'Original Research',
        description: 'For original studies generating or analyzing research data.',
      },
      {
        id: 'review-article',
        name: 'Review Article',
        description: 'For systematic, narrative, scoping, or other scholarly reviews.',
      },
      {
        id: 'systematic-review',
        name: 'Systematic Review / Meta-analysis',
        description: 'For evidence-synthesis studies following recognized methodological standards.',
      },
      {
        id: 'case-report',
        name: 'Case Report',
        description: 'For clinically significant individual or small-series case reports.',
      },
      {
        id: 'short-communication',
        name: 'Short Communication',
        description: 'For concise research findings that warrant rapid communication.',
      },
      {
        id: 'letter',
        name: 'Letter / Correspondence',
        description: 'For concise scholarly correspondence or commentary.',
      },
      {
        id: 'editorial',
        name: 'Editorial / Commentary',
        description: 'For invited or editorial scholarly perspectives.',
      },
      {
        id: 'protocol',
        name: 'Protocol / Study Protocol',
        description: 'For research protocols where appropriate.',
      },
    ],
  },

  authorship: {
    title: 'Authorship',
    description: 'Authors should have made meaningful contributions to the work.',
    criteria: [
      {
        title: 'Substantial Contributions',
        items: [
          'Conception or design of the work, or data acquisition, analysis, or interpretation',
          'Drafting the work or revising it critically for important intellectual content',
          'Final approval of the version to be published',
          'Agreement to be accountable for all aspects of the work',
        ],
      },
      {
        title: 'Authorship Requirements',
        items: [
          'All eligible authors should be listed at submission',
          'All authors should approve the submitted version',
          'Authorship changes after submission require editorial approval',
          'Contributors who do not qualify for authorship may be acknowledged instead',
        ],
      },
      {
        title: 'AI Authorship Policy',
        items: [
          'AI systems cannot be listed as authors',
          'Authors remain responsible for accuracy, originality, and integrity of AI-assisted work',
          'Substantive use of AI tools should be disclosed where required by policy',
        ],
      },
    ],
  },

  correspondingAuthor: {
    title: 'Corresponding Author',
    description: 'One author should be designated as corresponding author.',
    responsibilities: [
      'Communication with the editorial office',
      'Coordinating co-author approval',
      'Responding to editorial queries',
      'Coordinating revisions',
      'Confirming submission information',
      'Communicating with the journal during production and publication',
    ],
    recommendedInfo: [
      'Full name',
      'Institutional affiliation',
      'Email address',
      'Country',
      'Optional telephone or contact information',
    ],
  },

  manuscriptFile: {
    title: 'Manuscript File',
    description: 'Prepare your manuscript files according to these specifications.',
    formats: {
      main: {
        title: 'Main Manuscript',
        description: 'Contains the article itself.',
        formats: ['DOCX', 'PDF'],
      },
      supplementary: {
        title: 'Supplementary Files',
        description: 'May include additional supporting materials.',
        examples: [
          'Cover letter',
          'Reporting checklist',
          'Supplementary tables',
          'Supplementary figures',
          'Datasets',
          'Appendices',
          'Other supporting materials',
        ],
      },
    },
  },

  manuscriptStructure: {
    title: 'Manuscript Structure',
    description: 'For Original Research articles, include the following sections where applicable.',
    sections: [
      'Title',
      'Authors and affiliations',
      'Abstract',
      'Keywords',
      'Introduction',
      'Methods',
      'Results',
      'Discussion',
      'Conclusions',
      'Acknowledgements',
      'Funding',
      'Conflict of Interest',
      'Ethical Approval',
      'Data Availability',
      'Author Contributions',
      'References',
      'Tables',
      'Figures and Figure Legends',
      'Supplementary Material (where applicable)',
    ],
    note: 'Not every article type requires every section. Adjust structure according to your article type requirements.',
  },

  title: {
    title: 'Title',
    description: 'Your title should be:',
    guidelines: [
      'Concise and descriptive',
      'Specific to the study',
      'Avoid unnecessary abbreviations',
      'Accurately represent the study',
      'Avoid unsupported claims',
      'Help readers and indexing services understand the article',
    ],
  },

  abstract: {
    title: 'Abstract',
    description: 'Abstract requirements depend on article type.',
    structure: {
      research: {
        title: 'For Research Articles',
        items: ['Background', 'Objective', 'Methods', 'Results', 'Conclusions'],
      },
      other: {
        title: 'For Other Article Types',
        description: 'Abstract structure may differ. Authors should follow the word limit specified for their article type.',
      },
    },
  },

  keywords: {
    title: 'Keywords',
    description: 'Provide relevant scientific keywords to help indexing and discovery.',
    guidelines: [
      'Use relevant scientific terminology',
      'Avoid unnecessarily broad terms',
      'Prefer established terminology',
      'Use approximately 3–8 keywords unless article type specifies otherwise',
    ],
  },

  introduction: {
    title: 'Introduction',
    description: 'The introduction should:',
    guidelines: [
      'Establish background and context',
      'Identify the knowledge gap or problem',
      'Explain the rationale for the study',
      'Clearly state the objective or research question',
      'Avoid unnecessary extensive literature review',
    ],
  },

  methods: {
    title: 'Methods',
    description: 'Methods should contain enough information for appropriate evaluation and, where applicable, reproducibility.',
    subsections: [
      {
        title: 'Study Design and Setting',
        items: ['Study design', 'Study setting', 'Participants or sample', 'Eligibility criteria'],
      },
      {
        title: 'Interventions and Outcomes',
        items: ['Interventions or exposures', 'Outcomes measured', 'Data collection procedures'],
      },
      {
        title: 'Statistical Analysis',
        items: ['Statistical methods', 'Software used', 'Sample-size considerations'],
      },
      {
        title: 'Materials and Procedures',
        items: ['Protocols used', 'Materials', 'Relevant laboratory procedures'],
      },
      {
        title: 'Human Research Ethics',
        items: [
          'Ethics committee or IRB approval',
          'Informed consent where applicable',
          'Privacy and confidentiality protections',
          'Appropriate handling of identifiable information',
        ],
      },
      {
        title: 'Animal Research Ethics',
        items: [
          'Institutional approval',
          'Relevant animal welfare requirements',
          'Appropriate reporting standards',
        ],
      },
    ],
  },

  reportingGuidelines: {
    title: 'Reporting Guidelines',
    description: 'Authors should use appropriate reporting standards for their study design.',
    guidelines: [
      { name: 'CONSORT', description: 'Randomized trials' },
      { name: 'STROBE', description: 'Observational studies' },
      { name: 'PRISMA', description: 'Systematic reviews and meta-analyses' },
      { name: 'STARD', description: 'Diagnostic accuracy studies' },
      { name: 'CARE', description: 'Case reports' },
      { name: 'ARRIVE', description: 'Animal research' },
      { name: 'SRQR / COREQ', description: 'Qualitative research where applicable' },
    ],
    note: 'Authors should consult the appropriate reporting guideline for their study design.',
  },

  results: {
    title: 'Results',
    description: 'Present your findings clearly and logically.',
    guidelines: [
      'Follow a logical sequence',
      'Report primary findings clearly',
      'Distinguish between primary and secondary outcomes',
      'Avoid unnecessary duplication between text, tables, and figures',
      'Provide appropriate statistical information',
      'Avoid excessive interpretation of results',
    ],
  },

  discussion: {
    title: 'Discussion',
    description: 'Interpret your findings in context.',
    guidelines: [
      'Interpret the findings',
      'Compare with existing literature',
      'Discuss implications and significance',
      'Address strengths and limitations',
      'Avoid unsupported conclusions',
      'Distinguish findings from speculation',
    ],
  },

  conclusion: {
    title: 'Conclusion',
    description: 'Conclusions should directly follow from the evidence presented.',
    guidelines: [
      'Be concise and focused',
      'Avoid exaggerated claims',
      'Clearly state the main implications',
      'Suggest future directions where appropriate',
    ],
  },

  ethics: {
    title: 'Ethics',
    description: 'Ethical considerations are critical for research publication.',
    subsections: [
      {
        title: 'Human Participants',
        items: [
          'Ethics committee or IRB approval must be obtained',
          'Informed consent must be obtained where applicable',
          'Privacy and confidentiality must be protected',
          'Identifiable information must be handled appropriately',
        ],
      },
      {
        title: 'Animal Research',
        items: [
          'Institutional approval must be obtained',
          'Relevant animal welfare requirements must be followed',
          'Appropriate reporting standards must be used',
        ],
      },
      {
        title: 'Clinical Trials',
        items: [
          'Registration information must be provided',
          'Registry name and registration number',
          'Prospective registration where required',
        ],
      },
    ],
  },

  funding: {
    title: 'Funding',
    description: 'Authors must disclose all sources of funding.',
    requirements: [
      'Funding source must be disclosed',
      'Grant numbers should be provided where applicable',
      'Role of the funder should be described where appropriate',
      'If no funding was received, authors should explicitly state this',
    ],
  },

  conflictOfInterest: {
    title: 'Conflict of Interest',
    description: 'Authors must disclose any conflicts of interest.',
    types: [
      'Financial relationships',
      'Institutional conflicts',
      'Personal relationships',
      'Intellectual property conflicts',
      'Other circumstances that could influence interpretation',
    ],
    note: 'Absence of conflicts should also be explicitly stated.',
  },

  dataAvailability: {
    title: 'Data Availability',
    description: 'Authors should provide an appropriate data availability statement where applicable.',
    examples: [
      'Data is publicly available in a specified repository',
      'Data is available upon reasonable request',
      'Data is restricted due to privacy or ethical constraints',
      'No datasets were generated',
      'Data is contained within the article or supplementary material',
    ],
  },

  authorContributions: {
    title: 'Author Contributions',
    description: 'Authors should describe individual contributions where appropriate.',
    roles: [
      'Conceptualization',
      'Methodology',
      'Investigation',
      'Data curation',
      'Formal analysis',
      'Writing — original draft',
      'Writing — review & editing',
      'Supervision',
      'Project administration',
    ],
  },

  acknowledgements: {
    title: 'Acknowledgements',
    description: 'Contributors who do not meet authorship criteria may be acknowledged.',
    examples: [
      'Technical assistance',
      'Administrative assistance',
      'Writing assistance',
      'Institutional support',
    ],
    note: 'Where appropriate, authors should obtain permission from individuals being acknowledged.',
  },

  aiDisclosure: {
    title: 'AI and Generative AI Disclosure',
    description: 'MedPublish has specific policies regarding AI use in manuscript preparation.',
    policies: [
      'AI tools cannot be listed as authors',
      'Authors remain fully responsible for the manuscript',
      'AI-generated material must be checked for accuracy',
      'Substantive use of AI tools should be disclosed where required by policy',
      'AI tools should not be used to fabricate data, citations, images, results, or research claims',
      'Confidential manuscript or reviewer material must not be uploaded to external AI systems',
    ],
  },

  references: {
    title: 'References',
    description: 'References should be accurate and consistently formatted.',
    guidelines: [
      'Every cited reference should appear in the reference list',
      'Every listed reference should be cited where appropriate',
      'Use a consistent citation style',
      'Include DOI or URL where available',
      'Verify author names, journal titles, year, volume, issue, and pages/article numbers',
      'Follow the journal\'s selected reference style',
    ],
  },

  tables: {
    title: 'Tables',
    description: 'Present data clearly in tables.',
    guidelines: [
      'Number tables consecutively',
      'Provide descriptive titles',
      'Define abbreviations in footnotes',
      'Include appropriate units',
      'Provide footnotes where necessary',
      'Avoid duplicating information unnecessarily between text and tables',
    ],
  },

  figures: {
    title: 'Figures',
    description: 'Figures should be clear and publication-quality.',
    guidelines: [
      'Number figures consecutively',
      'Provide figure legends',
      'Ensure figures are cited in the text',
      'Use sufficient resolution for publication',
      'Obtain permission for previously published material',
      'Clearly identify multi-panel figures',
    ],
  },

  copyrightPermissions: {
    title: 'Copyright and Permissions',
    description: 'Authors are responsible for obtaining permission to reproduce copyrighted material.',
    requirements: [
      'Previously published figures',
      'Tables',
      'Copyrighted images',
      'Lengthy quotations',
      'Third-party material',
    ],
    note: 'Authors should retain evidence of permission where applicable.',
  },

  originality: {
    title: 'Originality and Duplicate Submission',
    description: 'MedPublish requires original submissions.',
    policies: [
      'Authors must not submit the same manuscript simultaneously to multiple journals',
      'Authors must disclose relevant prior publication',
      'Preprints and conference abstracts should be disclosed where appropriate',
      'Related manuscripts should be disclosed',
    ],
  },

  peerReview: {
    title: 'Peer Review Process',
    description: 'Understanding the peer review process.',
    process: [
      'Manuscripts may undergo editorial screening before peer review',
      'Editors may request revisions based on screening',
      'Peer review may be single or double anonymized depending on journal policy',
      'Reviewers are selected based on expertise and absence of conflicts of interest',
      'Authors may be asked to suggest reviewers where the workflow supports it',
    ],
  },

  blindReview: {
    title: 'Blind Review Preparation',
    description: 'If anonymized review is required, prepare your manuscript accordingly.',
    removals: [
      'Author names',
      'Affiliations',
      'Identifying acknowledgements',
      'Obvious self-identifying statements where appropriate',
      'Metadata that exposes author identity',
    ],
  },

  submissionProcess: {
    title: 'Submission Process',
    description: 'Follow these steps to submit your manuscript.',
    steps: [
      {
        step: 1,
        title: 'Prepare',
        description: 'Read Author Guidelines and choose the correct article type.',
      },
      {
        step: 2,
        title: 'Prepare Files',
        description: 'Prepare the manuscript and required supplementary files.',
      },
      {
        step: 3,
        title: 'Submit',
        description: 'Upload manuscript and metadata through MedPublish.',
      },
      {
        step: 4,
        title: 'Editorial Screening',
        description: 'Editors assess scope, completeness, and basic suitability.',
      },
      {
        step: 5,
        title: 'Peer Review',
        description: 'Where applicable, reviewers evaluate the manuscript.',
      },
      {
        step: 6,
        title: 'Revision',
        description: 'Authors respond to editorial and reviewer requests.',
      },
      {
        step: 7,
        title: 'Acceptance',
        description: 'Accepted manuscripts proceed toward production.',
      },
      {
        step: 8,
        title: 'Production',
        description: 'Final article preparation, metadata verification, and publication.',
      },
    ],
  },

  faq: {
    title: 'Frequently Asked Questions',
    questions: [
      {
        question: 'What file format should I submit?',
        answer: 'We accept DOCX and PDF formats for the main manuscript. Supplementary files can include various formats depending on the content type.',
      },
      {
        question: 'Can I submit a previously published manuscript?',
        answer: 'No. Manuscripts must be original and not previously published, except for preprints or conference abstracts which should be disclosed.',
      },
      {
        question: 'Can I submit a manuscript under consideration elsewhere?',
        answer: 'No. Manuscripts must not be simultaneously under consideration elsewhere.',
      },
      {
        question: 'Who can be listed as an author?',
        answer: 'Individuals who have made substantial contributions to conception, design, data acquisition/analysis, drafting, or revision, and who approve the final version and agree to be accountable.',
      },
      {
        question: 'What should the corresponding author do?',
        answer: 'The corresponding author is responsible for communication with the editorial office, coordinating co-author approval, responding to queries, and managing revisions.',
      },
      {
        question: 'Do I need ethical approval?',
        answer: 'Yes, for research involving human participants or animals, ethical approval from an appropriate committee or IRB is required.',
      },
      {
        question: 'Do I need to disclose funding?',
        answer: 'Yes, all sources of funding must be disclosed. If no funding was received, this should be explicitly stated.',
      },
      {
        question: 'Do I need to disclose conflicts of interest?',
        answer: 'Yes, all conflicts of interest must be disclosed. Absence of conflicts should also be explicitly stated.',
      },
      {
        question: 'Can I use AI tools while preparing my manuscript?',
        answer: 'AI tools can be used for assistance but cannot be listed as authors. Authors remain responsible for all content. Substantive AI use should be disclosed where required.',
      },
      {
        question: 'What happens after submission?',
        answer: 'Your manuscript will undergo editorial screening. If it passes screening, it will be sent for peer review where appropriate.',
      },
      {
        question: 'What happens after acceptance?',
        answer: 'Accepted manuscripts proceed to production for final preparation, metadata verification, and publication.',
      },
      {
        question: 'How should I prepare figures and tables?',
        answer: 'Number figures and tables consecutively, provide descriptive titles and legends, ensure they are cited in the text, and use sufficient resolution for figures.',
      },
    ],
  },
}
