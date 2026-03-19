import type { BucketDefinition } from "@/types";

/**
 * 25 industry buckets + 1 General Industry fallback
 * These are hardcoded as the default taxonomy for lead enrichment.
 * Users can add custom buckets via Settings.
 *
 * KEYWORDS EXPANDED from 59K real classification strings (March 2026)
 */
export const DEFAULT_TAXONOMY: BucketDefinition[] = [
  {
    bucket_name: "Commercial Real Estate Investment & Development",
    description: "Firms focused on acquiring, developing, and investing in commercial property assets.",
    direct_ancestor: "Real Estate Services",
    root_category: "Real Estate",
    include: [
      "real estate investment", "real estate development", "commercial real estate developer",
      "REIT", "real estate capital", "property investment firm",
      "real estate fund", "multifamily development", "mixed-use development",
      "affordable housing development", "senior housing development",
      "real estate syndication", "opportunity zone", "real estate equity",
      "real estate portfolio", "commercial development", "industrial real estate",
      "self-storage", "build-to-rent", "workforce housing development",
      "urban redevelopment", "community revitalization", "real estate acquisition",
      "multifamily syndication", "housing development"
    ],
    exclude: ["residential real estate brokerage", "property management only", "real estate brokerage"],
    example_strings: [
      "Commercial real estate investment and development firm",
      "Real estate investment trust focused on industrial properties",
      "Affordable Housing Development and Community Revitalization",
      "Multifamily Syndication and Real Estate Investment"
    ]
  },
  {
    bucket_name: "Wealth Management & Financial Planning",
    description: "Advisory firms providing financial planning and investment management to individuals and families.",
    direct_ancestor: "Financial Services & Investment",
    root_category: "Financial Services",
    include: [
      "wealth management", "financial planning", "financial advisory",
      "family office", "retirement planning", "investment advisory",
      "asset management", "financial advisor", "fee-based", "fee-only",
      "fiduciary", "investment counsel", "wealth advisory", "private wealth",
      "endowment management", "trust company", "trust administration",
      "estate planning services", "high net worth", "HNW advisory",
      "active asset management", "portfolio management", "investment manager",
      "financial planner", "retirement plan", "pension fund",
      "comprehensive financial planning", "tax-efficient investing",
      "income planning", "succession planning"
    ],
    exclude: ["investment banking", "corporate finance", "fintech", "institutional asset management"],
    example_strings: [
      "Wealth management and financial planning for individuals",
      "Boutique wealth management firm",
      "Active Asset Management and Comprehensive Financial Planning",
      "Fee-Only Fiduciary Financial Advisory Firm"
    ]
  },
  {
    bucket_name: "Manufacturing & Industrial Services",
    description: "Companies involved in the B2B production of physical goods, industrial equipment, or materials.",
    direct_ancestor: "Industrial & Operations",
    root_category: "Industrial",
    include: [
      "manufacturing", "manufacturer", "industrial production", "fabrication",
      "machining", "OEM", "industrial automation", "industrial services",
      "industrial equipment", "carbon capture", "electrochemical",
      "chemical processing", "electrical manufacturing", "communication equipment",
      "electronics manufacturer", "semiconductor", "cnc machining",
      "precision machining", "metal fabrication", "plastics processing",
      "injection molding", "casting", "assembly services",
      "industrial supplies", "welding", "sheet metal",
      "packaging manufacturer", "nanofiber", "advanced materials",
      "aerospace component", "defense technology", "ammunition",
      "firearms manufacturer", "nuclear fuel", "nuclear technology",
      "lithium-ion battery", "battery manufacturer", "solar panel manufacturer",
      "photovoltaic", "wind turbine", "biorefinery", "biofuel",
      "food processing", "dairy processing", "grain processing",
      "textile manufacturer", "apparel manufacturer", "garment",
      "concrete", "aggregate", "asphalt", "lumber", "timber",
      "foam", "adhesive", "coating", "sealant", "gasket",
      "fastener", "bearing", "valve", "pump manufacturer",
      "compressor", "generator", "transformer", "conveyor",
      "hydraulic", "pneumatic", "filtration", "abrasive"
    ],
    exclude: ["software for manufacturing", "consulting for manufacturing", "consumer handmade goods"],
    example_strings: [
      "Custom metal fabrication and manufacturing",
      "Advanced Lithium-Ion Battery Materials and Manufacturing",
      "Precision Machining and Metrology Services",
      "Nanofiber Materials Manufacturer for Industrial Filtration"
    ]
  },
  {
    bucket_name: "Non-Profit & Trade Associations",
    description: "Organizations operating for public benefit, advocacy, or industry representation rather than profit.",
    direct_ancestor: "Non-Profit & Public Sector",
    root_category: "Non-Profit",
    include: [
      "non-profit", "not-for-profit", "foundation", "association",
      "advocacy organization", "charity", "nonprofit", "community land trust",
      "social enterprise", "community development", "youth development",
      "charitable", "501c", "financial literacy", "civic engagement",
      "political", "campaign", "government affairs", "public policy",
      "mission-driven", "community organization", "humanitarian",
      "faith-based", "church", "ministry", "religious organization",
      "social justice", "food bank", "shelter", "housing assistance",
      "community health", "free clinic", "food justice", "social change",
      "community organizing", "activism", "volunteer", "philanthropy",
      "conservation", "environmental advocacy", "animal welfare",
      "youth sports", "mentoring", "arts council", "cultural organization",
      "museum", "performing arts", "symphony", "opera",
      "veteran services", "senior services", "disability services",
      "community foundation", "community benefit", "public benefit",
      "grant-making", "grantee", "community action", "civic",
      "child welfare", "adoption", "foster care", "homelessness",
      "hunger relief", "disaster relief", "refugee",
      "interfaith", "outreach", "community support",
      "diaper bank", "blood bank", "eye bank", "organ donation",
      "cemetery", "memorial", "burial society"
    ],
    exclude: ["for-profit social enterprise", "commercial business"],
    example_strings: [
      "Nonprofit broadband advocacy organization",
      "Youth-Led Community Organizing for Food Justice",
      "501(c)(4) nonprofit advocacy organization",
      "Community Development Financial Institution"
    ]
  },
  {
    bucket_name: "Commercial Real Estate Brokerage & Advisory",
    description: "Intermediaries facilitating the buying, selling, and leasing of commercial properties.",
    direct_ancestor: "Real Estate Services",
    root_category: "Real Estate",
    include: [
      "commercial real estate brokerage", "tenant representation",
      "commercial leasing", "real estate advisory", "CRE broker",
      "investment sales", "commercial property sales",
      "retail leasing", "office leasing", "land brokerage",
      "commercial property advisory"
    ],
    exclude: ["residential real estate", "property management", "real estate investment"],
    example_strings: [
      "Commercial real estate brokerage firm",
      "Tenant representation and leasing advisory",
      "Commercial Property Agency for Sales, Lettings, Management & Valuations",
      "Investment Sales Brokerage for Commercial Properties"
    ]
  },
  {
    bucket_name: "Property Management Services",
    description: "Companies managing the day-to-day operations of residential or commercial properties for owners.",
    direct_ancestor: "Real Estate Services",
    root_category: "Real Estate",
    include: [
      "property management", "facility management", "association management",
      "HOA management", "asset management for real estate",
      "building management", "tenant management", "facilities maintenance",
      "janitorial", "community management", "condominium management",
      "manufactured home community", "mobile home park",
      "property maintenance", "building services"
    ],
    exclude: ["real estate sales", "proptech software"],
    example_strings: [
      "Full-service property management company",
      "Condominium Association Management",
      "Manufactured Home Community Management",
      "Commercial Building Facilities Management"
    ]
  },
  {
    bucket_name: "Private Equity & Investment Firm",
    description: "Firms that invest capital into private companies, often for buyouts, growth equity, or operational control.",
    direct_ancestor: "Financial Services & Investment",
    root_category: "Financial Services",
    include: [
      "private equity", "growth equity", "investment firm", "investment holding",
      "buyout firm", "capital partners", "mergers and acquisitions", "M&A",
      "secondary market", "portfolio company", "investment management",
      "private capital", "acquisition firm", "holding company",
      "private investment", "mezzanine capital", "direct lending",
      "private debt", "search fund", "independent sponsor",
      "fund of funds", "co-investment", "special situations",
      "distressed investing", "turnaround investment"
    ],
    exclude: ["venture capital", "wealth management personal", "real estate investment"],
    example_strings: [
      "Private equity firm specializing in lower middle market",
      "Acquisition-focused Private Equity Firm",
      "Growth Equity Investment Partner for Healthcare",
      "Middle Market Buyout and Investment Firm"
    ]
  },
  {
    bucket_name: "Legal Services & Law Firms",
    description: "Professional practices providing legal counsel and litigation services to businesses and individuals.",
    direct_ancestor: "Professional Services",
    root_category: "Business Services",
    include: [
      "law firm", "legal services", "attorney", "counsel", "litigation",
      "lawyer", "legal counsel", "legal advisory", "legal practice",
      "corporate law", "business law", "intellectual property law",
      "patent law", "trademark", "immigration law", "estate law",
      "family law", "criminal defense", "personal injury",
      "employment law", "labor law", "environmental law",
      "securities law", "bankruptcy law", "tax law", "real estate law",
      "healthcare law", "construction law", "maritime law",
      "government contracts law", "regulatory compliance law"
    ],
    exclude: ["legaltech", "court reporting"],
    example_strings: [
      "Full-service law firm",
      "Boutique litigation firm for business disputes",
      "Intellectual property and patent law firm",
      "Corporate and Securities Law Firm"
    ]
  },
  {
    bucket_name: "Venture Capital Firm",
    description: "Investment funds focused on early-stage and high-growth startup companies.",
    direct_ancestor: "Financial Services & Investment",
    root_category: "Financial Services",
    include: [
      "venture capital", "vc firm", "early stage investor", "seed fund",
      "angel investor", "startup investor", "venture fund",
      "startup accelerator", "incubator", "accelerator program",
      "venture studio", "startup studio", "pre-seed",
      "series a investor", "series b investor"
    ],
    exclude: ["private equity buyout", "wealth management"],
    example_strings: [
      "Early-stage venture capital firm",
      "AI startup incubator and early-stage investor",
      "AgTech Startup Accelerator and Innovation Network",
      "Venture Studio and VC Incubator"
    ]
  },
  {
    bucket_name: "Architecture, Engineering & Construction",
    description: "Firms providing design, engineering, and construction services for the built environment.",
    direct_ancestor: "Industrial & Operations",
    root_category: "Industrial",
    include: [
      "architecture", "civil engineering", "structural engineering",
      "general contractor", "construction management", "design-build",
      "remodeling", "renovation", "home improvement", "roofing",
      "plumbing", "HVAC", "building construction", "infrastructure development",
      "electrical contractor", "mechanical contractor",
      "landscape architecture", "interior design firm", "urban planning",
      "MEP engineering", "geotechnical", "environmental engineering",
      "surveying", "land surveying", "3D rendering services",
      "architectural visualization", "acoustical consulting",
      "fire protection engineering", "lighting design",
      "demolition", "excavation", "paving", "concrete contractor",
      "masonry", "drywall", "flooring contractor", "painting contractor",
      "glass and glazing", "elevator", "scaffolding",
      "AEC consulting", "building information modeling", "BIM"
    ],
    exclude: ["software for construction", "handyman only"],
    example_strings: [
      "Architecture and engineering firm",
      "Commercial General Contractor and Design-Build",
      "3D Architectural Visualization and Rendering Services",
      "Acoustical Consulting and Technology Engineering for Building Design"
    ]
  },
  {
    bucket_name: "Residential Real Estate Brokerage",
    description: "Agencies facilitating the sale and purchase of residential homes.",
    direct_ancestor: "Real Estate Services",
    root_category: "Real Estate",
    include: [
      "residential real estate", "home buying", "home selling",
      "luxury real estate", "residential brokerage", "realtor",
      "real estate agent", "home sales", "luxury homes",
      "residential property sales", "single family homes",
      "real estate team", "home valuation", "buyer agent"
    ],
    exclude: ["commercial real estate", "property management"],
    example_strings: [
      "Residential real estate brokerage",
      "Luxury home real estate group",
      "Online Luxury Real Estate Marketplace",
      "Residential Real Estate Team"
    ]
  },
  {
    bucket_name: "B2B Productivity & Operations SaaS",
    description: "Software platforms designed to improve general business workflows, operations, and productivity.",
    direct_ancestor: "Technology & Software",
    root_category: "SaaS / Software",
    include: [
      "b2b saas", "workflow automation", "productivity software",
      "collaboration platform", "enterprise software", "management platform",
      "trade-in", "trade in solutions", "refurbished", "ecommerce platform",
      "inventory management", "fleet management", "field service software",
      "work order", "scheduling software", "time tracking",
      "document management", "compliance software", "quality management",
      "ERP software", "procurement software", "contract management",
      "visitor management software", "access control software",
      "event management platform", "registration platform"
    ],
    exclude: ["fintech saas", "proptech saas", "martech saas"],
    example_strings: [
      "B2B SaaS platform for workflow automation",
      "AI-driven Field Service Software Platform",
      "Visitor Management Software for Commercial Properties",
      "Enterprise Compliance and Quality Management Software"
    ]
  },
  {
    bucket_name: "IT Consulting & Managed Services",
    description: "Providers of IT infrastructure management, cybersecurity, and technology strategy.",
    direct_ancestor: "Technology & Software",
    root_category: "Business Services",
    include: [
      "it consulting", "managed services", "msp", "cybersecurity services",
      "technology consulting", "systems integration", "cybersecurity",
      "information security", "network security", "ICS security",
      "industrial cybersecurity", "it support", "it infrastructure",
      "cloud consulting", "it staffing", "it outsourcing",
      "data center", "network engineering", "voip",
      "unified communications", "it solutions provider",
      "managed security", "SOC", "penetration testing",
      "disaster recovery", "backup solutions", "it governance"
    ],
    exclude: ["saas product", "digital marketing"],
    example_strings: [
      "Managed IT Services and Cybersecurity",
      "IT Consulting for Federal Government Agencies",
      "Managed Security Services and SOC Provider",
      "Cloud Consulting and Infrastructure Management"
    ]
  },
  {
    bucket_name: "Branding, Creative & PR Agency",
    description: "Agencies focused on brand identity, design, communications, and public relations.",
    direct_ancestor: "Marketing & Creative Services",
    root_category: "Agencies",
    include: [
      "branding agency", "creative agency", "pr agency", "public relations",
      "strategic communications", "design studio", "personal branding",
      "branding", "creative services", "brand strategy",
      "communications agency", "media relations", "brand identity",
      "graphic design", "package design", "packaging design",
      "animation studio", "video production", "film production",
      "production company", "motion graphics", "visual effects",
      "content creation studio", "photography studio",
      "brand consulting", "reputation management",
      "crisis communications", "corporate communications",
      "event production", "experiential marketing"
    ],
    exclude: ["digital marketing", "seo agency", "web development"],
    example_strings: [
      "Creative Branding and Design Studio",
      "2D Animation Studio for Original Content Creation",
      "3D Animation and Rendering Services for Marketing",
      "Full-Service PR and Strategic Communications Agency"
    ]
  },
  {
    bucket_name: "Data, Analytics & AI SaaS",
    description: "Software platforms specialized in data processing, business intelligence, and artificial intelligence applications.",
    direct_ancestor: "Technology & Software",
    root_category: "SaaS / Software",
    include: [
      "data analytics", "ai platform", "business intelligence",
      "machine learning software", "big data", "enterprise ai",
      "ai adoption", "artificial intelligence", "ai solutions",
      "predictive analytics", "data science", "computer vision",
      "natural language processing", "nlp", "deep learning",
      "generative ai", "ai-powered", "ai-driven", "agentic ai",
      "ai automation", "robotic process automation", "rpa",
      "data management platform", "data engineering",
      "conversational ai", "chatbot platform", "ai agent"
    ],
    exclude: ["data entry services", "general it consulting"],
    example_strings: [
      "AI-powered Data Analytics Platform",
      "Agentic AI Platform for Enterprise Operations Automation",
      "Predictive Analytics and Business Intelligence SaaS",
      "AI-driven process automation platform"
    ]
  },
  {
    bucket_name: "Accounting, Audit & Tax Services",
    description: "Professional firms providing financial record-keeping, auditing, and tax preparation services.",
    direct_ancestor: "Professional Services",
    root_category: "Business Services",
    include: [
      "accounting firm", "cpa", "tax services", "audit firm",
      "bookkeeping", "accounting", "tax preparation", "auditing",
      "certified public accountant", "tax advisory", "financial accounting",
      "tax consulting", "tax compliance", "forensic accounting",
      "business valuation", "assurance services", "payroll services",
      "fractional cfo", "outsourced cfo", "controller services",
      "accounting outsourcing", "back-office outsourcing",
      "tax planning", "tax filing", "tax relief",
      "accountancy", "chartered accountant", "audit and assurance"
    ],
    exclude: ["accounting software only", "wealth management advisory"],
    example_strings: [
      "Certified Public Accounting Firm for SMBs",
      "Accounting and Tax Advisory Services for Small Businesses",
      "Forensic Accounting and Business Valuation Services",
      "Outsourced CFO and Controller Services for Middle Market"
    ]
  },
  {
    bucket_name: "Logistics & Supply Chain Services",
    description: "Companies managing the transportation, storage, and flow of goods.",
    direct_ancestor: "Industrial & Operations",
    root_category: "Industrial",
    include: [
      "logistics", "supply chain management", "freight forwarding",
      "transportation services", "3pl", "warehousing",
      "fulfillment services", "cross docking", "intermodal",
      "trucking", "freight brokerage", "cold chain",
      "last mile delivery", "white glove delivery",
      "customs brokerage", "global trade", "import export",
      "cargo", "shipping", "drayage", "courier",
      "moving company", "relocation services"
    ],
    exclude: ["supply chain software only"],
    example_strings: [
      "3PL Warehousing and Fulfillment Services",
      "Global Freight Forwarding and Customs Brokerage",
      "Temperature-Controlled 3PL Warehousing and Logistics",
      "Full Truckload and Intermodal Logistics Services"
    ]
  },
  {
    bucket_name: "Digital Marketing & SEO Agency",
    description: "Agencies focused on online traffic generation, SEO, paid media, and performance marketing.",
    direct_ancestor: "Marketing & Creative Services",
    root_category: "Agencies",
    include: [
      "digital marketing", "seo agency", "performance marketing",
      "paid media", "ppc agency", "internet marketing",
      "social media marketing", "content marketing", "email marketing",
      "growth marketing", "demand generation", "inbound marketing",
      "affiliate marketing", "influencer marketing",
      "conversion rate optimization", "marketing consultancy",
      "lead generation", "digital advertising", "media buying",
      "programmatic advertising", "marketing agency"
    ],
    exclude: ["pr agency only", "traditional advertising only", "branding agency only"],
    example_strings: [
      "Full-Service Digital Marketing Agency",
      "SEO and Content Marketing Services for B2B",
      "Performance Marketing and Lead Generation Agency",
      "Social Media Marketing for E-commerce Brands"
    ]
  },
  {
    bucket_name: "Management & Strategy Consulting",
    description: "Firms advising leadership on high-level business strategy, operations, and organizational improvement.",
    direct_ancestor: "Professional Services",
    root_category: "Business Services",
    include: [
      "management consulting", "strategy consulting", "business consulting",
      "operational consulting", "business advisory",
      "organizational development", "change management",
      "executive coaching", "leadership development",
      "process improvement", "lean consulting", "six sigma",
      "supply chain consulting", "operations consulting",
      "transformation consulting", "business transformation",
      "advisory firm", "consulting firm", "strategic advisory",
      "turnaround consulting", "restructuring advisory",
      "interim management", "fractional cxo"
    ],
    exclude: ["financial advisory", "it consulting", "marketing consulting"],
    example_strings: [
      "Management Consulting for Growth Companies",
      "Strategic Business Advisory for Mid-Market",
      "Organizational Development and Change Management",
      "Advisory Services for Business Growth and Transactions"
    ]
  },
  {
    bucket_name: "FinTech & Financial Services SaaS",
    description: "Software platforms serving the financial industry or providing financial tools.",
    direct_ancestor: "Technology & Software",
    root_category: "SaaS / Software",
    include: [
      "fintech", "financial software", "banking platform",
      "payment processing", "financial technology", "bank", "banking",
      "credit union", "lending", "community bank", "commercial bank",
      "mortgage", "credit", "loan", "neobank", "digital banking",
      "payment gateway", "payment solution", "blockchain",
      "cryptocurrency", "defi", "regtech", "wealthtech",
      "insurtech", "open banking", "core banking",
      "savings platform", "investment platform",
      "foreign exchange", "forex", "remittance",
      "buy now pay later", "bnpl", "merchant services",
      "point of sale", "pos system"
    ],
    exclude: ["investment firm management", "wealth management advisory", "real estate investment"],
    example_strings: [
      "Community Bank and Lending Institution",
      "Digital Banking Platform for Small Businesses",
      "Payment Processing Gateway and Merchant Services",
      "AI-Powered Lending and Credit Decisioning Platform"
    ]
  },
  {
    bucket_name: "Staffing, Recruiting & HR Services",
    description: "Agencies providing talent acquisition, temporary staffing, and HR consulting.",
    direct_ancestor: "Professional Services",
    root_category: "Business Services",
    include: [
      "recruiting", "staffing agency", "executive search",
      "talent acquisition", "hr consulting", "staffing",
      "recruitment", "headhunter", "human resources",
      "peo", "employer of record", "workforce solutions",
      "temp agency", "talent management", "outplacement",
      "career services", "career coaching", "resume services",
      "background check", "pre-employment screening",
      "payroll outsourcing", "benefits administration",
      "hr technology", "workforce development"
    ],
    exclude: ["hr software only", "job board only"],
    example_strings: [
      "Executive Search and Recruiting Firm",
      "Technical Staffing and Workforce Solutions",
      "HR Consulting and PEO Services",
      "Accounting and Finance Executive Recruitment"
    ]
  },
  {
    bucket_name: "Real Estate Tech (PropTech) SaaS",
    description: "Software platforms designed specifically for the real estate and property management industries.",
    direct_ancestor: "Technology & Software",
    root_category: "SaaS / Software",
    include: [
      "proptech", "property management software", "real estate technology",
      "real estate platform", "real estate software", "mls platform",
      "listing platform", "real estate marketplace",
      "lease management software", "tenant screening software",
      "real estate crm", "real estate data"
    ],
    exclude: ["real estate brokerage service", "property management service only"],
    example_strings: [
      "PropTech SaaS for Property Management",
      "Real Estate Data Analytics Platform",
      "Dynamic Real Estate Platform Development",
      "International Real Estate MLS Platform"
    ]
  },
  {
    bucket_name: "Web & Software Development Agency",
    description: "Service firms building custom websites, mobile apps, and software solutions for clients.",
    direct_ancestor: "Technology & Software",
    root_category: "Agencies",
    include: [
      "web development", "app development", "software development agency",
      "custom software", "web design agency", "mobile app development",
      "full-stack development", "frontend development",
      "ecommerce development", "shopify development",
      "wordpress development", "ui/ux design", "ux design agency",
      "digital product development", "offshore development",
      "nearshore development", "software outsourcing",
      "game development studio", "3D development studio"
    ],
    exclude: ["saas product company", "it managed services only"],
    example_strings: [
      "Custom Software Development Agency",
      "AI-First Custom Software Development and Product Design",
      "Web and Mobile App Development Services",
      "3D Design and Game Development Studio"
    ]
  },
  {
    bucket_name: "Insurance Services & Brokerage",
    description: "Intermediaries selling insurance products to businesses and individuals.",
    direct_ancestor: "Financial Services & Investment",
    root_category: "Financial Services",
    include: [
      "insurance brokerage", "insurance agency", "risk management",
      "commercial insurance", "insurance advisor", "insurance services",
      "employee benefits", "workers compensation", "liability insurance",
      "property insurance", "casualty insurance", "surety bond",
      "title insurance", "health insurance broker",
      "life insurance", "group benefits", "benefits consulting",
      "insurance carrier", "underwriting", "claims management",
      "actuarial", "actuary", "loss control",
      "captive insurance", "self-insured", "reinsurance"
    ],
    exclude: ["insurtech software only"],
    example_strings: [
      "Commercial Insurance Brokerage and Risk Management",
      "Employee Benefits and Insurance Consulting",
      "Actuarial Consulting for Property & Casualty Insurance",
      "Workers Compensation and Liability Insurance Services"
    ]
  },
  {
    bucket_name: "Marketing & Sales (MarTech) SaaS",
    description: "Software tools for marketing automation, CRM, ad-tech, and sales enablement.",
    direct_ancestor: "Technology & Software",
    root_category: "SaaS / Software",
    include: [
      "martech", "marketing automation", "crm software",
      "sales enablement", "adtech", "advertising technology",
      "customer data platform", "cdp", "marketing platform",
      "sales platform", "customer engagement", "loyalty platform",
      "email platform", "sms marketing platform",
      "marketing analytics", "attribution platform"
    ],
    exclude: ["digital marketing agency service", "sales consulting"],
    example_strings: [
      "Marketing Automation SaaS Platform",
      "Customer Data Platform for Enterprise",
      "Sales Enablement and CRM Solution",
      "Advertising Analytics Platform for Media"
    ]
  },
  {
    bucket_name: "Healthcare & Medical Services",
    description: "Organizations providing clinical care, medical services, and health-related professional services.",
    direct_ancestor: "Healthcare",
    root_category: "Healthcare",
    include: [
      "healthcare", "medical", "hospital", "clinic", "patient care",
      "telemedicine", "health services", "medical device",
      "pharmaceutical", "biotech", "clinical", "nursing",
      "mental health", "therapy", "dental", "optometry",
      "veterinary", "wellness", "behavioral health",
      "home health", "hospice", "urgent care", "ambulance",
      "laboratory", "diagnostics", "radiology", "pathology",
      "rehabilitation", "physical therapy", "occupational therapy",
      "speech therapy", "chiropractic", "acupuncture",
      "dermatology", "cardiology", "oncology", "orthopedic",
      "pediatric", "geriatric", "obstetric", "gynecology",
      "urology", "neurology", "gastroenterology",
      "aba therapy", "autism", "substance abuse",
      "addiction treatment", "eating disorder",
      "senior care", "assisted living", "memory care",
      "skilled nursing", "long-term care", "senior living",
      "medical staffing", "locum tenens", "travel nursing",
      "medical billing", "revenue cycle management"
    ],
    exclude: ["healthcare software only", "health insurance only"],
    example_strings: [
      "Academic Medical Center with Patient Care and Research",
      "ABA Therapy Provider for Children with Autism",
      "Senior Living Real Estate Development and Management",
      "Behavioral Health and Substance Abuse Treatment Center"
    ]
  },
  // Bucket 26: General Industry (fallback for unclassified or ambiguous records)
  {
    bucket_name: "General Industry",
    description: "Catch-all bucket for records that do not clearly align with any of the 25 defined industry buckets. Includes ambiguous, insufficient, or novel classifications that require manual review.",
    direct_ancestor: "Unclassified",
    root_category: "General",
    include: [],
    exclude: [],
    example_strings: [
      "Unclear or generic business description",
      "Multi-industry conglomerate",
      "Business services not otherwise classified",
      "Site Error", "Scrape Error"
    ]
  }
];

/**
 * Get the full taxonomy including default + custom buckets
 */
export function getFullTaxonomy(customBuckets: BucketDefinition[] = []): BucketDefinition[] {
  return [...DEFAULT_TAXONOMY, ...customBuckets];
}

/**
 * Get the unique root categories from the taxonomy
 */
export function getRootCategories(taxonomy: BucketDefinition[] = DEFAULT_TAXONOMY): string[] {
  const roots = new Set<string>();
  for (const bucket of taxonomy) {
    if (bucket.root_category) {
      roots.add(bucket.root_category);
    }
  }
  return Array.from(roots);
}

/**
 * Get the unique ancestor categories from the taxonomy
 */
export function getAncestorCategories(taxonomy: BucketDefinition[] = DEFAULT_TAXONOMY): string[] {
  const ancestors = new Set<string>();
  for (const bucket of taxonomy) {
    if (bucket.direct_ancestor) {
      ancestors.add(bucket.direct_ancestor);
    }
  }
  return Array.from(ancestors);
}

/**
 * Find the bucket definition by name
 */
export function findBucket(name: string, taxonomy: BucketDefinition[] = DEFAULT_TAXONOMY): BucketDefinition | undefined {
  return taxonomy.find(
    (b) => b.bucket_name.toLowerCase() === name.toLowerCase()
  );
}
