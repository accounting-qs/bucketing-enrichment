import type { BucketDefinition } from "@/types";

/**
 * Refactored Default Taxonomy — 3-Level Hierarchy
 *
 * root_category   = parent_bucket   (primary business identity)
 * direct_ancestor = child_bucket    (service/technology segment)
 * bucket_name     = sub_child_bucket (specific leaf classification)
 *
 * Classification principle:
 *   Always assign based on the company's PRIMARY business identity.
 *   Never mix industry verticals, service models, and tech types at the same level.
 *
 * Parent buckets:
 *   Technology Services | Software & SaaS | Agencies |
 *   Professional & Business Services | Financial Services |
 *   Real Estate | Industrial & Operations | Healthcare |
 *   Non-Profit / Associations | General Industry
 */
export const DEFAULT_TAXONOMY: BucketDefinition[] = [

  // ─────────────────────────────────────────────────────────────────────────
  // PARENT: Technology Services
  // Children: IT Services | Cybersecurity | AI & Automation |
  //           Cloud & DevOps | Data & Analytics | Other Tech
  // ─────────────────────────────────────────────────────────────────────────

  {
    bucket_name: "Managed IT Services",
    description: "MSPs and IT outsourcing firms that manage client infrastructure, systems, and helpdesk operations on an ongoing basis.",
    direct_ancestor: "IT Services",
    root_category: "Technology Services",
    include: [
      "managed services provider", "msp", "managed it", "it managed services",
      "it support", "helpdesk", "it outsourcing", "it infrastructure",
      "network management", "remote monitoring", "endpoint management",
      "it operations", "it managed", "managed network", "managed support",
      "it service management", "itsm", "service desk", "desktop support",
      "field technical support", "it solutions provider",
    ],
    exclude: [
      "saas product", "digital marketing", "cybersecurity consulting only",
      "cloud-native software", "software development",
    ],
    example_strings: [
      "Managed IT Services and Helpdesk Support",
      "MSP for Small and Mid-Market Businesses",
      "IT Outsourcing and Remote Monitoring Solutions",
      "Full-Service Managed IT and Infrastructure Partner",
    ],
  },
  {
    bucket_name: "IT Consulting",
    description: "Technology strategy and advisory firms helping organizations plan, architect, and optimize their IT environments.",
    direct_ancestor: "IT Services",
    root_category: "Technology Services",
    include: [
      "it consulting", "technology consulting", "it strategy", "it advisory",
      "technology strategy", "systems integration", "it transformation",
      "digital transformation consulting", "enterprise architecture",
      "it governance", "it assessment", "technology roadmap",
      "it program management", "cto advisory", "fractional cto",
    ],
    exclude: [
      "managed it services", "saas product", "digital marketing",
      "cybersecurity firm", "software development agency",
    ],
    example_strings: [
      "IT Consulting and Technology Strategy for Enterprises",
      "Systems Integration and IT Advisory Services",
      "Digital Transformation Consulting Firm",
      "Fractional CTO and Technology Road-Map Services",
    ],
  },
  {
    bucket_name: "IT Support & Staffing",
    description: "Firms focused on IT staffing, augmentation, and break-fix technical support services.",
    direct_ancestor: "IT Services",
    root_category: "Technology Services",
    include: [
      "it staffing", "tech staffing", "technology staffing",
      "it staff augmentation", "it contractors", "break-fix",
      "on-site support", "it technician", "hardware support",
      "technology recruitment", "it talent",
    ],
    exclude: [
      "managed it services", "it consulting", "software development",
    ],
    example_strings: [
      "IT Staffing and Tech Augmentation Services",
      "Break-Fix and On-Site IT Support Provider",
      "Technology Staff Augmentation for Enterprises",
    ],
  },
  {
    bucket_name: "Network & Infrastructure Services",
    description: "Specialists in network design, installation, cabling, unified communications, and physical IT infrastructure.",
    direct_ancestor: "IT Services",
    root_category: "Technology Services",
    include: [
      "network engineering", "network infrastructure", "network design",
      "structured cabling", "voip", "unified communications", "ucaas",
      "data center services", "server infrastructure", "storage solutions",
      "wireless networking", "lan wan", "sd-wan", "network solutions",
      "telecommunications", "fiber optic", "networking contractor",
    ],
    exclude: [
      "saas product", "digital marketing", "cybersecurity software only",
    ],
    example_strings: [
      "Network Design and Infrastructure Deployment",
      "VoIP and Unified Communications Provider",
      "Data Center and Server Infrastructure Services",
      "Structured Cabling and Wireless Networking",
    ],
  },

  // ── Child: Cybersecurity ──

  {
    bucket_name: "Cybersecurity Services",
    description: "Pure-play cybersecurity service firms providing assessments, SOC, MSSP, and security consulting.",
    direct_ancestor: "Cybersecurity",
    root_category: "Technology Services",
    include: [
      "cybersecurity", "information security", "infosec", "cyber defense",
      "managed security services", "mssp", "SOC", "security operations center",
      "penetration testing", "pen testing", "vulnerability assessment",
      "red team", "blue team", "threat intelligence", "incident response",
      "security consulting", "cyber consulting", "network security",
      "endpoint security", "zero trust", "security compliance",
      "ICS security", "OT security", "industrial cybersecurity",
      "cyber risk", "security awareness training", "phishing simulation",
      "firewall management", "siem management",
    ],
    exclude: [
      "cybersecurity saas product", "it managed services",
      "software development", "digital marketing",
    ],
    example_strings: [
      "Cybersecurity Consulting and Managed Security Services",
      "SOC as a Service and Incident Response Provider",
      "Penetration Testing and Vulnerability Assessment Firm",
      "Industrial Cybersecurity and OT Security Services",
    ],
  },
  {
    bucket_name: "Cybersecurity Software / SaaS",
    description: "Companies that build and sell cybersecurity software products, platforms, or SaaS tools.",
    direct_ancestor: "Cybersecurity",
    root_category: "Technology Services",
    include: [
      "cybersecurity platform", "security software", "endpoint protection platform",
      "identity and access management", "iam platform", "privileged access",
      "pam solution", "dlp software", "data loss prevention platform",
      "siem platform", "soar platform", "security automation",
      "cyber threat platform", "vulnerability management software",
      "deception technology", "security analytics platform",
    ],
    exclude: [
      "cybersecurity consulting service", "managed security service",
      "non-security software",
    ],
    example_strings: [
      "AI-Powered Cybersecurity SaaS Platform",
      "Endpoint Protection and Identity Management Software",
      "SIEM and SOAR Platform for Enterprise Security",
      "Vulnerability Management SaaS Tool",
    ],
  },

  // ── Child: AI & Automation ──

  {
    bucket_name: "AI & Automation Services",
    description: "Consulting and service firms deploying AI, machine learning, or intelligent automation for client business processes.",
    direct_ancestor: "AI & Automation",
    root_category: "Technology Services",
    include: [
      "ai consulting", "ai services", "ai agency", "ai automation",
      "intelligent automation", "robotic process automation", "rpa services",
      "machine learning consulting", "data science consulting",
      "ai implementation", "generative ai consulting", "llm consulting",
      "agentic ai services", "ai strategy", "ai integration",
      "automation consulting", "process automation services",
      "conversational ai services", "chatbot development",
      "computer vision services", "nlp consulting",
    ],
    exclude: [
      "ai saas product", "pure software company", "digital marketing agency",
    ],
    example_strings: [
      "AI Automation Agency for Business Process Optimization",
      "Generative AI Consulting and Implementation Services",
      "RPA and Intelligent Automation Services",
      "Machine Learning Consulting for Enterprises",
    ],
  },
  {
    bucket_name: "AI SaaS",
    description: "Companies that build and sell AI-powered software products or platforms as a service.",
    direct_ancestor: "AI & Automation",
    root_category: "Technology Services",
    include: [
      "ai platform", "ai-powered platform", "ai saas", "agentic ai platform",
      "enterprise ai", "generative ai platform", "llm platform",
      "ai-driven software", "ai product", "machine learning platform",
      "deep learning platform", "ai data platform", "conversational ai platform",
      "ai co-pilot", "ai assistant platform",
    ],
    exclude: [
      "ai consulting service", "digital marketing", "it managed services",
    ],
    example_strings: [
      "Agentic AI Platform for Enterprise Operations Automation",
      "Generative AI SaaS for Content and Knowledge Management",
      "AI-Powered Predictive Analytics Platform",
      "Enterprise AI Co-Pilot Software",
    ],
  },

  // ── Child: Cloud & DevOps ──

  {
    bucket_name: "Cloud Services",
    description: "Firms providing cloud migration, cloud architecture, cloud managed services, and multi-cloud consulting.",
    direct_ancestor: "Cloud & DevOps",
    root_category: "Technology Services",
    include: [
      "cloud consulting", "cloud migration", "cloud managed services",
      "cloud infrastructure", "cloud architecture", "aws consulting",
      "azure consulting", "gcp consulting", "multi-cloud", "hybrid cloud",
      "cloud optimization", "cloud security", "cloud transformation",
      "cloud partner", "managed cloud", "cloud operations",
    ],
    exclude: [
      "cloud software product", "saas product", "digital marketing",
    ],
    example_strings: [
      "AWS Cloud Migration and Managed Services Partner",
      "Multi-Cloud Architecture and DevOps Consulting",
      "Cloud Transformation and Infrastructure Services",
      "Hybrid Cloud and Azure Consulting Firm",
    ],
  },
  {
    bucket_name: "DevOps & Software Engineering Services",
    description: "Firms specializing in DevOps practices, CI/CD, platform engineering, and developer tooling services.",
    direct_ancestor: "Cloud & DevOps",
    root_category: "Technology Services",
    include: [
      "devops consulting", "devops services", "devsecops", "ci/cd",
      "platform engineering", "site reliability engineering", "sre",
      "kubernetes consulting", "container management", "infrastructure as code",
      "terraform", "ansible", "deployment automation", "developer platform",
      "gitops", "microservices architecture",
    ],
    exclude: [
      "saas product", "digital marketing", "it support",
    ],
    example_strings: [
      "DevOps Consulting and CI/CD Pipeline Engineering",
      "Platform Engineering and Kubernetes Services",
      "SRE and Infrastructure Automation Services",
      "DevSecOps and Container Orchestration Consulting",
    ],
  },

  // ── Child: Data & Analytics ──

  {
    bucket_name: "Data & Analytics Services",
    description: "Service firms providing data engineering, analytics consulting, BI implementation, and data strategy.",
    direct_ancestor: "Data & Analytics",
    root_category: "Technology Services",
    include: [
      "data consulting", "data engineering", "data analytics consulting",
      "business intelligence consulting", "bi implementation",
      "data strategy", "data governance", "data management consulting",
      "data warehouse", "etl services", "data pipeline",
      "analytics consulting", "data architecture", "data lake",
      "reporting services", "dashboard services",
    ],
    exclude: [
      "analytics saas product", "ai saas", "it managed services",
    ],
    example_strings: [
      "Data Engineering and Analytics Consulting Firm",
      "Business Intelligence and Data Visualization Services",
      "Data Strategy and Governance Advisory",
      "ETL Pipeline and Data Warehouse Implementation",
    ],
  },
  {
    bucket_name: "Data / Analytics SaaS",
    description: "Software platforms for business intelligence, data analytics, and reporting sold as a service.",
    direct_ancestor: "Data & Analytics",
    root_category: "Technology Services",
    include: [
      "data analytics platform", "business intelligence software",
      "analytics saas", "bi platform", "big data platform",
      "reporting platform", "data visualization platform",
      "data management platform", "predictive analytics platform",
      "data science platform", "decision intelligence platform",
    ],
    exclude: [
      "ai saas", "data consulting services", "digital marketing",
    ],
    example_strings: [
      "Predictive Analytics and Business Intelligence SaaS",
      "Data Visualization and Reporting Platform",
      "Enterprise Data Management and Analytics Software",
      "Self-Serve Analytics SaaS Platform",
    ],
  },

  // ── Child: Other Tech ──

  {
    bucket_name: "Other Technology Services",
    description: "Technology service firms that don't clearly fit IT Services, Cybersecurity, AI, Cloud, or Data sub-categories.",
    direct_ancestor: "Other Tech",
    root_category: "Technology Services",
    include: [
      "technology services", "tech services", "it solutions",
      "technology solutions", "digital solutions", "tech company",
      "emerging technology", "innovation lab", "r&d services",
      "iot services", "blockchain services", "ar vr services",
      "low-code no-code", "technology partner",
    ],
    exclude: [
      "saas product", "digital marketing agency",
      "manufacturing", "general industry",
    ],
    example_strings: [
      "Emerging Technology Solutions and Innovation Lab",
      "IoT and Connected Device Services",
      "Blockchain Development and Implementation Services",
      "AR/VR Technology Services for Enterprises",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARENT: Software & SaaS
  // Children: General Software | Enterprise Software | Software Platforms | Vertical SaaS
  // ─────────────────────────────────────────────────────────────────────────

  {
    bucket_name: "General Software",
    description: "Independent software vendors (ISVs) building and selling general-purpose software products.",
    direct_ancestor: "General Software",
    root_category: "Software & SaaS",
    include: [
      "software company", "isv", "software product", "software vendor",
      "software solutions", "software platform", "saas company",
      "b2b saas", "cloud software", "application software",
    ],
    exclude: [
      "it consulting", "digital marketing agency", "technology services",
      "fintech saas", "proptech saas", "martech saas",
    ],
    example_strings: [
      "B2B SaaS Company for Workflow Automation",
      "General-Purpose Cloud Software Platform",
      "Independent Software Vendor for SMBs",
    ],
  },
  {
    bucket_name: "Enterprise Software",
    description: "Software companies building ERP, HRMS, CRM, and other large-scale enterprise-grade systems.",
    direct_ancestor: "Enterprise Software",
    root_category: "Software & SaaS",
    include: [
      "erp software", "enterprise resource planning", "hris software",
      "enterprise platform", "enterprise saas", "crm platform",
      "supply chain software", "procurement software", "contract management software",
      "compliance software", "quality management software",
      "field service software", "inventory management software",
      "fleet management software", "document management software",
      "ecommerce platform", "order management system",
    ],
    exclude: [
      "it consulting", "staffing", "fintech saas", "proptech saas",
    ],
    example_strings: [
      "Enterprise ERP and Supply Chain Management Software",
      "HRIS and Workforce Management Platform",
      "Enterprise CRM for Mid-Market Companies",
      "Contract Lifecycle Management SaaS",
    ],
  },
  {
    bucket_name: "B2B Productivity & Ops Software",
    description: "SaaS platforms improving general business workflows, scheduling, and productivity.",
    direct_ancestor: "Software Platforms",
    root_category: "Software & SaaS",
    include: [
      "productivity software", "workflow automation software", "collaboration platform",
      "project management software", "scheduling software", "time tracking software",
      "work order software", "visitor management software",
      "event management platform", "registration platform",
      "knowledge management software", "internal communications platform",
    ],
    exclude: [
      "fintech saas", "proptech saas", "martech saas",
      "it consulting", "digital marketing",
    ],
    example_strings: [
      "B2B SaaS Platform for Workflow Automation",
      "Project Management and Collaboration Software",
      "Visitor Management Software for Commercial Properties",
      "Event Registration and Management Platform",
    ],
  },
  {
    bucket_name: "FinTech SaaS",
    description: "Software platforms serving financial services — payments, lending, banking, and financial technology products.",
    direct_ancestor: "Vertical SaaS",
    root_category: "Software & SaaS",
    include: [
      "fintech", "financial technology", "payment processing",
      "banking platform", "digital banking", "neobank",
      "payment gateway", "payment solution", "lending platform",
      "credit platform", "loan origination software", "mortgage software",
      "insurtech", "wealthtech", "regtech", "open banking",
      "core banking software", "blockchain platform", "cryptocurrency platform",
      "buy now pay later", "bnpl", "merchant services platform",
      "point of sale software", "remittance platform",
    ],
    exclude: [
      "investment management firm", "insurance brokerage service",
      "accounting firm", "it consulting",
    ],
    example_strings: [
      "Digital Banking Platform for Small Businesses",
      "Payment Processing Gateway and Merchant Services SaaS",
      "AI-Powered Lending and Credit Decisioning Platform",
      "InsurTech SaaS for Commercial Insurance",
    ],
  },
  {
    bucket_name: "PropTech SaaS",
    description: "Software platforms purpose-built for real estate, property management, and the built environment.",
    direct_ancestor: "Vertical SaaS",
    root_category: "Software & SaaS",
    include: [
      "proptech", "property management software", "real estate platform",
      "real estate software", "real estate technology", "mls platform",
      "listing platform", "real estate marketplace", "lease management software",
      "tenant screening software", "real estate crm", "real estate data platform",
      "rental management software", "commercial real estate software",
    ],
    exclude: [
      "real estate brokerage service", "property management service",
      "it consulting",
    ],
    example_strings: [
      "PropTech SaaS for Property Management Firms",
      "Real Estate Data and Analytics Platform",
      "Tenant Screening and Lease Management Software",
      "Commercial Real Estate CRM and Deal Management SaaS",
    ],
  },
  {
    bucket_name: "MarTech SaaS",
    description: "Software tools for marketing automation, CRM, advertising technology, and sales enablement.",
    direct_ancestor: "Vertical SaaS",
    root_category: "Software & SaaS",
    include: [
      "martech", "marketing automation", "marketing platform",
      "crm software", "sales enablement platform", "adtech",
      "advertising technology", "customer data platform", "cdp",
      "email platform", "sms marketing platform",
      "marketing analytics", "attribution platform",
      "loyalty platform", "customer engagement platform",
    ],
    exclude: [
      "digital marketing agency service", "sales consulting",
      "it consulting",
    ],
    example_strings: [
      "Marketing Automation SaaS Platform",
      "Customer Data Platform for Enterprise Marketers",
      "Sales Enablement and CRM Software",
      "Advertising Analytics and Attribution Platform",
    ],
  },
  {
    bucket_name: "HR / Recruiting SaaS",
    description: "Software platforms for talent acquisition, applicant tracking, HR management, and workforce analytics.",
    direct_ancestor: "Vertical SaaS",
    root_category: "Software & SaaS",
    include: [
      "hr software", "hris saas", "ats platform", "applicant tracking",
      "talent management platform", "recruiting software", "hr tech",
      "workforce management software", "payroll software",
      "employee engagement platform", "performance management software",
      "benefits administration software", "onboarding software",
      "learning management system", "lms",
    ],
    exclude: [
      "staffing agency service", "hr consulting service",
      "it consulting",
    ],
    example_strings: [
      "Applicant Tracking System for Mid-Market HR Teams",
      "HR SaaS for Workforce Management",
      "Employee Engagement and Performance Management Platform",
      "Payroll and Benefits Administration Software",
    ],
  },
  {
    bucket_name: "Healthcare SaaS",
    description: "Software platforms built for healthcare providers, payers, or life sciences organizations.",
    direct_ancestor: "Vertical SaaS",
    root_category: "Software & SaaS",
    include: [
      "health tech", "healthtech", "healthcare software", "health software",
      "ehr software", "electronic health records", "emr platform",
      "practice management software", "patient management software",
      "telehealth platform", "medical billing software",
      "revenue cycle management software", "pharmacy software",
      "clinical trials software", "population health platform",
      "care management software", "health data platform",
    ],
    exclude: [
      "healthcare services", "clinic", "hospital", "medical staffing",
      "health insurance brokerage",
    ],
    example_strings: [
      "EHR and Practice Management Software for Clinics",
      "Telehealth SaaS Platform",
      "Revenue Cycle Management Software for Health Systems",
      "Population Health Analytics Platform",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARENT: Agencies
  // Children: Digital Marketing Agency | SEO Agency | Branding / PR Agency |
  //           Web Development Agency | Software Development Agency | Creative / Design Agency
  // ─────────────────────────────────────────────────────────────────────────

  {
    bucket_name: "Digital Marketing Agency",
    description: "Agencies focused on online traffic, paid media, performance marketing, and demand generation.",
    direct_ancestor: "Digital Marketing Agency",
    root_category: "Agencies",
    include: [
      "digital marketing agency", "performance marketing", "paid media agency",
      "ppc agency", "internet marketing", "social media marketing agency",
      "content marketing agency", "email marketing agency",
      "growth marketing", "demand generation agency", "inbound marketing",
      "affiliate marketing", "influencer marketing agency",
      "digital advertising agency", "media buying agency",
      "programmatic advertising", "marketing agency",
    ],
    exclude: [
      "pr agency only", "traditional advertising", "branding agency only",
      "seo only", "web development only",
    ],
    example_strings: [
      "Full-Service Digital Marketing Agency",
      "Performance Marketing and Lead Generation Agency",
      "Social Media and Paid Ads Agency for E-Commerce",
      "B2B Demand Generation and Growth Marketing",
    ],
  },
  {
    bucket_name: "SEO Agency",
    description: "Agencies specializing in organic search strategy, technical SEO, link building, and content SEO.",
    direct_ancestor: "SEO Agency",
    root_category: "Agencies",
    include: [
      "seo agency", "search engine optimization", "seo services",
      "technical seo", "link building agency", "content seo",
      "local seo", "enterprise seo", "seo consulting",
    ],
    exclude: ["digital marketing", "paid media", "web development only"],
    example_strings: [
      "SEO and Organic Search Agency",
      "Technical SEO and Link Building Services",
      "Enterprise SEO Consulting Agency",
      "Local SEO and Content Strategy Services",
    ],
  },
  {
    bucket_name: "Branding & PR Agency",
    description: "Agencies providing brand identity, strategic communications, and public relations services.",
    direct_ancestor: "Branding / PR Agency",
    root_category: "Agencies",
    include: [
      "branding agency", "brand identity agency", "pr agency", "public relations",
      "strategic communications", "brand strategy", "brand consulting",
      "communications agency", "media relations", "reputation management",
      "crisis communications", "corporate communications",
      "personal branding", "thought leadership",
    ],
    exclude: [
      "digital marketing agency", "seo agency", "web development",
      "graphic design studio only",
    ],
    example_strings: [
      "Brand Strategy and Identity Agency",
      "PR and Strategic Communications Firm",
      "Corporate Communications and Reputation Management",
      "Personal Branding and Thought Leadership Agency",
    ],
  },
  {
    bucket_name: "Creative & Design Agency",
    description: "Studios and agencies providing creative services: design, video production, animation, and content creation.",
    direct_ancestor: "Creative / Design Agency",
    root_category: "Agencies",
    include: [
      "creative agency", "design studio", "graphic design agency",
      "animation studio", "video production company", "film production",
      "production company", "motion graphics", "visual effects", "vfx",
      "content creation studio", "photography studio",
      "package design", "packaging design",
      "experiential marketing", "event production",
      "creative studio", "creative services",
    ],
    exclude: [
      "digital marketing only", "pr agency only", "web development",
    ],
    example_strings: [
      "Creative Branding and Design Studio",
      "2D/3D Animation Studio for Marketing and Entertainment",
      "Video Production and Content Creation Agency",
      "Experiential Marketing and Event Production",
    ],
  },
  {
    bucket_name: "Web Development Agency",
    description: "Agencies building websites, e-commerce stores, and frontend digital experiences for clients.",
    direct_ancestor: "Web Development Agency",
    root_category: "Agencies",
    include: [
      "web development agency", "web design agency", "website agency",
      "frontend development agency", "ecommerce development",
      "shopify development", "wordpress development",
      "website design", "digital experience agency",
      "ui/ux design agency", "ux design agency",
    ],
    exclude: [
      "saas product company", "software development (custom backend)",
      "it managed services",
    ],
    example_strings: [
      "Web Design and Development Agency",
      "E-Commerce Website Development (Shopify/WordPress)",
      "UI/UX Design and Front-End Development Agency",
      "Digital Experience and Website Agency",
    ],
  },
  {
    bucket_name: "Software Development Agency",
    description: "Custom software development shops and nearshore/offshore studios building bespoke applications and digital products.",
    direct_ancestor: "Software Development Agency",
    root_category: "Agencies",
    include: [
      "software development agency", "custom software development",
      "app development agency", "mobile app development agency",
      "full-stack development agency", "digital product development",
      "offshore software development", "nearshore development",
      "software outsourcing", "bespoke software",
      "product development studio", "game development studio",
    ],
    exclude: [
      "saas product company", "it managed services",
      "web design only",
    ],
    example_strings: [
      "Custom Software Development Agency",
      "AI-First Custom Software and Product Design Studio",
      "Nearshore Mobile App Development",
      "Web and Mobile App Development Services",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARENT: Professional & Business Services
  // Children: Consulting | Accounting & Tax | Legal Services | Staffing / Recruiting / HR
  // ─────────────────────────────────────────────────────────────────────────

  {
    bucket_name: "Management & Strategy Consulting",
    description: "Firms advising leadership on business strategy, operations, and organizational transformation.",
    direct_ancestor: "Consulting",
    root_category: "Professional & Business Services",
    include: [
      "management consulting", "strategy consulting", "business consulting",
      "operational consulting", "business advisory", "organizational development",
      "change management", "process improvement", "lean consulting", "six sigma",
      "operations consulting", "transformation consulting", "business transformation",
      "advisory firm", "strategic advisory", "consulting firm",
      "turnaround consulting", "restructuring advisory",
      "interim management", "fractional cxo", "executive coaching",
      "leadership development", "supply chain consulting",
    ],
    exclude: [
      "financial advisory", "it consulting", "marketing consulting",
      "accounting firm",
    ],
    example_strings: [
      "Management Consulting for Growth Companies",
      "Strategic Business Advisory for Mid-Market",
      "Organizational Development and Change Management",
      "Fractional CXO and Interim Management Services",
    ],
  },
  {
    bucket_name: "Accounting & Tax Services",
    description: "CPA firms, bookkeeping, tax preparation, and outsourced finance services.",
    direct_ancestor: "Accounting & Tax",
    root_category: "Professional & Business Services",
    include: [
      "accounting firm", "cpa", "tax services", "audit firm",
      "bookkeeping", "accounting", "tax preparation", "auditing",
      "certified public accountant", "tax advisory", "financial accounting",
      "tax consulting", "tax compliance", "forensic accounting",
      "business valuation", "assurance services", "payroll services",
      "fractional cfo", "outsourced cfo", "controller services",
      "accounting outsourcing", "back-office outsourcing",
      "tax planning", "tax filing", "tax relief",
      "accountancy", "chartered accountant", "audit and assurance",
    ],
    exclude: [
      "accounting software only", "wealth management advisory",
      "financial services investment firm",
    ],
    example_strings: [
      "Certified Public Accounting Firm for SMBs",
      "Accounting and Tax Advisory Services",
      "Forensic Accounting and Business Valuation Services",
      "Outsourced CFO and Controller Services",
    ],
  },
  {
    bucket_name: "Legal Services & Law Firms",
    description: "Professional practices providing legal counsel and litigation services to businesses and individuals.",
    direct_ancestor: "Legal Services",
    root_category: "Professional & Business Services",
    include: [
      "law firm", "legal services", "attorney", "counsel", "litigation",
      "lawyer", "legal counsel", "legal advisory", "legal practice",
      "corporate law", "business law", "intellectual property law",
      "patent law", "trademark", "immigration law", "estate law",
      "family law", "criminal defense", "personal injury",
      "employment law", "labor law", "environmental law",
      "securities law", "bankruptcy law", "tax law", "real estate law",
      "healthcare law", "construction law", "government contracts law",
      "regulatory compliance law",
    ],
    exclude: ["legaltech software", "court reporting"],
    example_strings: [
      "Full-Service Law Firm for Corporate Clients",
      "Boutique Litigation Firm for Business Disputes",
      "Intellectual Property and Patent Law Firm",
      "Employment and Labor Law Practice",
    ],
  },
  {
    bucket_name: "Staffing & Recruiting",
    description: "Agencies providing talent acquisition, executive search, and temporary staffing.",
    direct_ancestor: "Staffing / Recruiting / HR",
    root_category: "Professional & Business Services",
    include: [
      "recruiting", "staffing agency", "executive search",
      "talent acquisition", "staffing", "recruitment",
      "headhunter", "temp agency", "talent management",
      "outplacement", "career services", "peo", "employer of record",
      "workforce solutions", "background check", "pre-employment screening",
      "hr outsourcing", "workforce development",
    ],
    exclude: [
      "hr software only", "job board only", "hr consulting only",
    ],
    example_strings: [
      "Executive Search and Recruiting Firm",
      "Technical Staffing and Workforce Solutions",
      "Employer of Record and PEO Services",
      "Accounting and Finance Executive Recruitment",
    ],
  },
  {
    bucket_name: "HR Consulting",
    description: "Firms providing human resources advisory, HR strategy, benefits consulting, and people operations.",
    direct_ancestor: "Staffing / Recruiting / HR",
    root_category: "Professional & Business Services",
    include: [
      "hr consulting", "human resources consulting", "people strategy",
      "hr advisory", "benefits consulting", "compensation consulting",
      "organizational design", "de&i consulting", "employee relations consulting",
      "payroll consulting", "hr outsourcing", "hr transformation",
    ],
    exclude: [
      "staffing agency", "hr software only", "recruiting only",
    ],
    example_strings: [
      "HR Consulting and People Strategy Advisory",
      "Benefits Design and Compensation Consulting",
      "Organizational Design and DE&I Consulting",
      "HR Transformation and Outsourcing Services",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARENT: Financial Services
  // Children: Wealth & Investment | Private Equity & VC | Banking & Lending |
  //           Insurance | Accounting & Finance (see above)
  // ─────────────────────────────────────────────────────────────────────────

  {
    bucket_name: "Wealth Management & Financial Planning",
    description: "Advisory firms providing financial planning and investment management to individuals and families.",
    direct_ancestor: "Wealth & Investment",
    root_category: "Financial Services",
    include: [
      "wealth management", "financial planning", "financial advisory",
      "family office", "retirement planning", "investment advisory",
      "asset management", "financial advisor", "fee-based", "fee-only",
      "fiduciary", "investment counsel", "wealth advisory", "private wealth",
      "endowment management", "trust company", "trust administration",
      "estate planning services", "high net worth", "HNW advisory",
      "portfolio management", "investment manager", "financial planner",
      "retirement plan", "pension fund", "comprehensive financial planning",
      "tax-efficient investing", "income planning", "succession planning",
    ],
    exclude: [
      "investment banking", "corporate finance", "fintech saas",
      "private equity buyout",
    ],
    example_strings: [
      "Wealth Management and Financial Planning for Individuals",
      "Fee-Only Fiduciary Financial Advisory Firm",
      "Boutique Family Office and Private Wealth Management",
      "Retirement Planning and Investment Counsel",
    ],
  },
  {
    bucket_name: "Private Equity & Investment Firm",
    description: "Firms investing capital into private companies for buyouts, growth equity, or operational control.",
    direct_ancestor: "Wealth & Investment",
    root_category: "Financial Services",
    include: [
      "private equity", "growth equity", "investment firm", "investment holding",
      "buyout firm", "capital partners", "mergers and acquisitions", "M&A",
      "secondary market", "portfolio company", "private capital",
      "acquisition firm", "holding company", "mezzanine capital",
      "direct lending", "private debt", "search fund", "independent sponsor",
      "fund of funds", "co-investment", "special situations",
      "distressed investing", "turnaround investment",
    ],
    exclude: [
      "venture capital", "wealth management personal", "real estate investment trust",
    ],
    example_strings: [
      "Private Equity Firm Specializing in Lower Middle Market",
      "Acquisition-Focused Private Equity Firm",
      "Growth Equity Investment Partner for Healthcare",
      "Middle Market Buyout and Investment Firm",
    ],
  },
  {
    bucket_name: "Venture Capital Firm",
    description: "Investment funds focused on early-stage and high-growth startup companies.",
    direct_ancestor: "Wealth & Investment",
    root_category: "Financial Services",
    include: [
      "venture capital", "vc firm", "early stage investor", "seed fund",
      "angel investor", "startup investor", "venture fund",
      "startup accelerator", "incubator", "accelerator program",
      "venture studio", "startup studio", "pre-seed",
      "series a investor", "series b investor",
    ],
    exclude: ["private equity buyout", "wealth management personal"],
    example_strings: [
      "Early-Stage Venture Capital Firm",
      "AI Startup Incubator and Early-Stage Investor",
      "AgTech Startup Accelerator and Innovation Network",
      "Venture Studio and VC Incubator",
    ],
  },
  {
    bucket_name: "Banking & Lending",
    description: "Traditional financial institutions, community banks, credit unions, and non-bank lenders.",
    direct_ancestor: "Banking & Lending",
    root_category: "Financial Services",
    include: [
      "bank", "banking", "community bank", "credit union", "commercial bank",
      "savings bank", "thrift", "mortgage", "mortgage lender",
      "lending", "loan", "credit", "sba lender", "cdfi",
      "non-bank lender", "private lender", "hard money lender",
      "commercial lending", "business lending",
    ],
    exclude: [
      "fintech saas", "payment software", "banking platform software",
    ],
    example_strings: [
      "Community Bank and Lending Institution",
      "Credit Union Serving Local Members",
      "Commercial Mortgage and Real Estate Lending",
      "SBA Lender and Small Business Finance",
    ],
  },
  {
    bucket_name: "Insurance Services & Brokerage",
    description: "Intermediaries selling insurance products and risk management services to businesses and individuals.",
    direct_ancestor: "Insurance",
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
      "captive insurance", "reinsurance",
    ],
    exclude: ["insurtech software only"],
    example_strings: [
      "Commercial Insurance Brokerage and Risk Management",
      "Employee Benefits and Insurance Consulting",
      "Actuarial Consulting for Property and Casualty",
      "Workers Compensation and Liability Insurance Services",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARENT: Real Estate
  // ─────────────────────────────────────────────────────────────────────────

  {
    bucket_name: "Commercial Real Estate Investment & Development",
    description: "Firms acquiring, developing, and investing in commercial property assets.",
    direct_ancestor: "CRE Investment & Development",
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
      "multifamily syndication", "housing development",
    ],
    exclude: [
      "residential real estate brokerage", "property management only",
      "real estate brokerage", "proptech software",
    ],
    example_strings: [
      "Commercial Real Estate Investment and Development Firm",
      "Affordable Housing Development and Community Revitalization",
      "Multifamily Syndication and Real Estate Investment",
      "REIT Focused on Industrial and Logistics Properties",
    ],
  },
  {
    bucket_name: "Commercial Real Estate Brokerage & Advisory",
    description: "Intermediaries facilitating the buying, selling, and leasing of commercial properties.",
    direct_ancestor: "CRE Brokerage & Services",
    root_category: "Real Estate",
    include: [
      "commercial real estate brokerage", "tenant representation",
      "commercial leasing", "real estate advisory", "CRE broker",
      "investment sales", "commercial property sales",
      "retail leasing", "office leasing", "land brokerage",
      "commercial property advisory",
    ],
    exclude: [
      "residential real estate", "property management", "real estate investment",
    ],
    example_strings: [
      "Commercial Real Estate Brokerage Firm",
      "Tenant Representation and Leasing Advisory",
      "Investment Sales Brokerage for Commercial Properties",
    ],
  },
  {
    bucket_name: "Property Management Services",
    description: "Companies managing the day-to-day operations of residential or commercial properties.",
    direct_ancestor: "CRE Brokerage & Services",
    root_category: "Real Estate",
    include: [
      "property management", "facility management", "association management",
      "HOA management", "building management", "tenant management",
      "facilities maintenance", "janitorial services", "community management",
      "condominium management", "manufactured home community",
      "property maintenance", "building services", "facilities management",
    ],
    exclude: ["real estate sales", "proptech software"],
    example_strings: [
      "Full-Service Property Management Company",
      "Condominium and HOA Association Management",
      "Manufactured Home Community Management",
      "Commercial Building Facilities Management",
    ],
  },
  {
    bucket_name: "Residential Real Estate Brokerage",
    description: "Agencies facilitating the sale and purchase of residential homes.",
    direct_ancestor: "Residential Real Estate",
    root_category: "Real Estate",
    include: [
      "residential real estate", "home buying", "home selling",
      "luxury real estate", "residential brokerage", "realtor",
      "real estate agent", "home sales", "luxury homes",
      "residential property sales", "single family homes",
      "real estate team", "home valuation", "buyer agent",
    ],
    exclude: ["commercial real estate", "property management"],
    example_strings: [
      "Residential Real Estate Brokerage",
      "Luxury Home Real Estate Group",
      "Residential Real Estate Team",
      "Online Luxury Real Estate Marketplace",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARENT: Industrial & Operations
  // ─────────────────────────────────────────────────────────────────────────

  {
    bucket_name: "Manufacturing & Industrial Services",
    description: "Companies involved in B2B production of physical goods, industrial equipment, or materials.",
    direct_ancestor: "Manufacturing",
    root_category: "Industrial & Operations",
    include: [
      "manufacturing", "manufacturer", "industrial production", "fabrication",
      "machining", "OEM", "industrial services", "industrial equipment",
      "electrochemical", "chemical processing", "electrical manufacturing",
      "electronics manufacturer", "semiconductor", "cnc machining",
      "precision machining", "metal fabrication", "plastics processing",
      "injection molding", "casting", "assembly services", "industrial supplies",
      "welding", "sheet metal", "packaging manufacturer",
      "nanofiber", "advanced materials", "aerospace component",
      "defense technology", "ammunition", "firearms manufacturer",
      "nuclear technology", "lithium-ion battery", "battery manufacturer",
      "solar panel manufacturer", "photovoltaic", "wind turbine",
      "biorefinery", "biofuel", "food processing", "dairy processing",
      "grain processing", "textile manufacturer", "apparel manufacturer",
      "concrete", "aggregate", "asphalt", "lumber", "timber",
      "foam", "adhesive", "coating", "sealant", "gasket", "fastener",
      "bearing", "valve", "pump manufacturer", "compressor", "generator",
      "transformer", "conveyor", "hydraulic", "pneumatic", "filtration",
    ],
    exclude: [
      "software for manufacturing", "consulting for manufacturing",
      "consumer handmade goods",
    ],
    example_strings: [
      "Custom Metal Fabrication and Manufacturing",
      "Advanced Lithium-Ion Battery Materials and Manufacturing",
      "Precision Machining and Metrology Services",
      "Solar Panel Manufacturer and Renewable Energy Equipment",
    ],
  },
  {
    bucket_name: "Architecture, Engineering & Construction",
    description: "Firms providing design, engineering, and construction services for the built environment.",
    direct_ancestor: "AEC & Construction",
    root_category: "Industrial & Operations",
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
      "glass and glazing", "elevator", "scaffolding", "AEC consulting",
      "building information modeling", "BIM",
    ],
    exclude: ["software for construction", "handyman only"],
    example_strings: [
      "Architecture and Engineering Firm",
      "Commercial General Contractor and Design-Build",
      "3D Architectural Visualization and Rendering Services",
      "Acoustical Consulting and Technology Engineering",
    ],
  },
  {
    bucket_name: "Logistics & Supply Chain Services",
    description: "Companies managing the transportation, storage, and flow of goods.",
    direct_ancestor: "Logistics & Supply Chain",
    root_category: "Industrial & Operations",
    include: [
      "logistics", "supply chain management", "freight forwarding",
      "transportation services", "3pl", "warehousing",
      "fulfillment services", "cross docking", "intermodal",
      "trucking", "freight brokerage", "cold chain",
      "last mile delivery", "white glove delivery",
      "customs brokerage", "global trade", "import export",
      "cargo", "shipping", "drayage", "courier",
      "moving company", "relocation services",
    ],
    exclude: ["supply chain software only"],
    example_strings: [
      "3PL Warehousing and Fulfillment Services",
      "Global Freight Forwarding and Customs Brokerage",
      "Temperature-Controlled Logistics and Cold Chain",
      "Full Truckload and Intermodal Transportation",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARENT: Healthcare
  // ─────────────────────────────────────────────────────────────────────────

  {
    bucket_name: "Healthcare & Medical Services",
    description: "Organizations providing clinical care, medical services, and health-related professional services.",
    direct_ancestor: "Clinical & Medical",
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
    ],
    exclude: [
      "healthcare software only", "health insurance only",
      "medical staffing only",
    ],
    example_strings: [
      "Academic Medical Center with Patient Care",
      "ABA Therapy Provider for Children with Autism",
      "Behavioral Health and Substance Abuse Treatment Center",
      "Physical Therapy and Rehabilitation Clinic",
    ],
  },
  {
    bucket_name: "Medical Staffing & Revenue Cycle",
    description: "Firms specializing in healthcare staffing, medical billing, and revenue cycle management services.",
    direct_ancestor: "Clinical & Medical",
    root_category: "Healthcare",
    include: [
      "medical staffing", "locum tenens", "travel nursing",
      "healthcare staffing", "medical billing", "revenue cycle management",
      "rcm services", "medical coding", "prior authorization",
      "healthcare outsourcing",
    ],
    exclude: [
      "healthcare software only", "general staffing",
    ],
    example_strings: [
      "Locum Tenens and Medical Staffing Agency",
      "Medical Billing and Revenue Cycle Management Services",
      "Travel Nursing Staffing Agency",
      "Healthcare RCM Outsourcing Partner",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARENT: Non-Profit / Associations
  // ─────────────────────────────────────────────────────────────────────────

  {
    bucket_name: "Non-Profit & Trade Associations",
    description: "Organizations operating for public benefit, advocacy, or industry representation rather than profit.",
    direct_ancestor: "Non-Profit & Associations",
    root_category: "Non-Profit / Associations",
    include: [
      "non-profit", "not-for-profit", "foundation", "association",
      "advocacy organization", "charity", "nonprofit", "community land trust",
      "social enterprise", "community development", "youth development",
      "charitable", "501c", "financial literacy nonprofit",
      "civic engagement", "political organization", "campaign nonprofit",
      "government affairs", "public policy", "mission-driven",
      "community organization", "humanitarian", "faith-based", "church",
      "ministry", "religious organization", "social justice",
      "food bank", "shelter", "housing assistance", "community health",
      "free clinic", "food justice", "community organizing",
      "volunteer organization", "philanthropy", "conservation",
      "environmental advocacy", "animal welfare", "youth sports",
      "mentoring", "arts council", "cultural organization",
      "museum", "performing arts", "symphony", "opera",
      "veteran services", "senior services", "disability services",
      "community foundation", "grant-making", "community action",
      "child welfare", "adoption", "foster care", "homelessness",
      "hunger relief", "disaster relief", "refugee",
      "trade association", "industry association", "professional association",
    ],
    exclude: ["for-profit social enterprise", "commercial business"],
    example_strings: [
      "Nonprofit Broadband Advocacy Organization",
      "Youth-Led Community Organizing for Food Justice",
      "501(c)(3) Human Services Nonprofit",
      "Industry Trade Association for Construction",
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PARENT: General Industry — Fallback buckets
  // ─────────────────────────────────────────────────────────────────────────

  {
    bucket_name: "General Industry",
    description: "Catch-all for companies that operate across industries or don't clearly align with any defined bucket. Requires manual review.",
    direct_ancestor: "Unclassified",
    root_category: "General Industry",
    include: [],
    exclude: [],
    example_strings: [
      "Unclear or generic business description",
      "Multi-industry conglomerate",
      "Business services not otherwise classified",
    ],
  },
  {
    bucket_name: "Needs Manual Review",
    description: "Records with ambiguous, contradictory, or low-signal descriptions that need a human to classify.",
    direct_ancestor: "Manual Review",
    root_category: "General Industry",
    include: [],
    exclude: [],
    example_strings: [
      "Company description too vague to classify",
      "Multiple unrelated industries mentioned equally",
      "Description conflicts with known company type",
    ],
  },
  {
    bucket_name: "Error / Failed Enrichment",
    description: "Records where enrichment returned an error, empty value, or scrape failure.",
    direct_ancestor: "Error",
    root_category: "General Industry",
    include: [],
    exclude: [],
    example_strings: [
      "Site Error", "Scrape Error", "Crawl Error",
      "null", "n/a", "error", "",
    ],
  },
];

/**
 * Get the full taxonomy including default + custom buckets
 */
export function getFullTaxonomy(customBuckets: BucketDefinition[] = []): BucketDefinition[] {
  return [...DEFAULT_TAXONOMY, ...customBuckets];
}

/**
 * Get the unique root categories (parent_buckets) from the taxonomy
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
 * Get the unique ancestor categories (child_buckets) from the taxonomy
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
 * Find the bucket definition by name (sub_child_bucket)
 */
export function findBucket(name: string, taxonomy: BucketDefinition[] = DEFAULT_TAXONOMY): BucketDefinition | undefined {
  return taxonomy.find(
    (b) => b.bucket_name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get all buckets under a given parent (root_category)
 */
export function getBucketsByParent(parent: string, taxonomy: BucketDefinition[] = DEFAULT_TAXONOMY): BucketDefinition[] {
  return taxonomy.filter((b) => b.root_category === parent);
}

/**
 * Get all buckets under a given child category (direct_ancestor)
 */
export function getBucketsByChild(child: string, taxonomy: BucketDefinition[] = DEFAULT_TAXONOMY): BucketDefinition[] {
  return taxonomy.filter((b) => b.direct_ancestor === child);
}
