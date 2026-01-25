// Core data models for the security report builder

// Evidence file structure
export interface EvidenceFile {
  id: string;
  name: string;
  type: string; // MIME type
  size: number;
  data: string; // base64 encoded data
  uploadedAt: string;
}

export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

export type AssessmentType =
  | 'Penetration Testing'
  | 'Threat Modeling'
  | 'Architecture Review'
  | 'Security Review'
  | 'Cloud Security Assessment'
  | 'Network Security Assessment';

export type AttackSurface = 'Web' | 'API' | 'Mobile' | 'Cloud' | 'Network' | 'Infrastructure';

export type AssetType = 'VM' | 'Load Balancer' | 'VPC' | 'IAM' | 'Storage' | 'Network Device' | 'Firewall' | 'Container' | 'Serverless';

export type CloudProvider = 'AWS' | 'Azure' | 'GCP' | 'On-Premise' | 'Hybrid';

export type ThreatCategory = 'Spoofing' | 'Tampering' | 'Repudiation' | 'Information Disclosure' | 'Denial of Service' | 'Elevation of Privilege';

export type LikelihoodLevel = 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';

export type ArchitectureConcern = 'Security' | 'Scalability' | 'Reliability' | 'Performance' | 'Maintainability' | 'Cost';

export type FindingStatus = 'Open' | 'In Progress' | 'Resolved' | 'Accepted Risk' | 'False Positive' | 'Fixed' | 'Reappeared' | 'Wont Fix';

export type TemplateType = 'enterprise' | 'startup' | 'developer' | 'compliance' | 'executive' | string;

export interface ServiceProviderProfile {
  id: string;
  companyName: string;
  logoUrl?: string;
  contactEmail: string;
  contactPhone?: string;
  website?: string;
  address?: string;
  legalDisclaimer: string;
  defaultSeverityModel: 'CVSS' | 'Custom';
  defaultRemediationTone: 'Technical' | 'Business' | 'Balanced';
  createdAt: string;
  updatedAt: string;
}

export interface ClientProfile {
  id: string;
  companyName: string;
  industry: string;
  techStack?: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  riskTolerance: 'Low' | 'Medium' | 'High';
  preferredReportDepth: 'Detailed' | 'Standard' | 'Summary';
  brandingRequirements?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Engagement Memory System - First-Class Entities
// ============================================================================

// Application - Separate from Engagement to allow multiple assessments
export interface Application {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  technologyStack?: string[]; // e.g., ["React", "Node.js", "PostgreSQL"]
  authModel?: string; // e.g., "OAuth 2.0", "SAML", "JWT"
  knownWeakAreas?: string[]; // Historical notes about risky components
  createdAt: string;
  updatedAt: string;
}

// Engineer - Track team members and their exposure
export interface EngineerExposure {
  vulnerabilityClasses: string[]; // e.g., ["IDOR", "XSS", "SQLi"]
  applicationTypes: string[]; // e.g., ["Web", "API", "Mobile"]
  authModels: string[]; // e.g., ["OAuth 2.0", "SAML"]
  totalEngagements: number;
  lastEngagementDate?: string;
}

export interface Engineer {
  id: string;
  name: string;
  email: string;
  role: string; // e.g., "Senior Security Engineer", "Penetration Tester"
  exposure: EngineerExposure;
  createdAt: string;
  updatedAt: string;
}

// Client User - External access with strict scoping
export interface ClientUser {
  id: string; // e.g., "user_client_123"
  clientId: string; // STRICT foreign key to ClientProfile
  email: string;
  name: string;
  role: 'client_admin' | 'client_viewer';
  status: 'invited' | 'active' | 'revoked';
  invitedBy: string; // Engineer ID
  invitedAt: string;
  lastLogin?: string;
  avatarUrl?: string;
  passwordHash?: string; // For credentials login
}

// Artifact - Knowledge documents, videos, transcripts
export type ArtifactType =
  | 'scope-document'
  | 'architecture-document'
  | 'previous-report'
  | 'walkthrough-video'
  | 'walkthrough-transcript'
  | 'evidence-screenshot'
  | 'evidence-network-trace'
  | 'remediation-plan'
  | 'remediation-verification'
  | 'architecture-notes'
  | 'annotation-engineer'
  | 'custom-document';

export type ArtifactScope = 'client' | 'application' | 'engagement';

export interface ArtifactMetadata {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  timestamps?: { time: number; text: string }[]; // For video transcripts
  [key: string]: any; // Allow custom metadata
}

export interface Artifact {
  id: string;
  type: ArtifactType;
  scope: ArtifactScope;
  scopeId: string; // Client ID, Application ID, or Engagement ID
  name: string;
  description?: string;
  content?: string; // Text content or transcript
  fileUrl?: string; // For binary files stored separately
  metadata: ArtifactMetadata;
  visibility: 'internal-only' | 'client-visible'; // DEFAULT: 'internal-only'
  sharedBy?: string; // Engineer ID
  sharedAt?: string;
  embedding?: number[]; // Deprecated: Legacy single embedding
  embeddings?: ArtifactEmbedding[]; // NEW: Chunked embeddings for large artifacts
  embeddingStatus?: 'pending' | 'processing' | 'completed' | 'failed'; // NEW: Track embedding state
  lastEmbedded?: string; // NEW: Timestamp of last embedding
  uploadedAt: string;
  updatedAt: string;
}

// NEW: Chunked embedding for semantic search
export interface ArtifactEmbedding {
  id: string;
  artifactId: string;
  chunkIndex: number; // Position in the artifact (0-indexed)
  embedding: number[]; // Vector: 384-dim for local model, 1536-dim for OpenAI
  content: string; // Text chunk (max 500 tokens)
  metadata: {
    tokenCount: number;
    startOffset: number; // Character offset in original content
    endOffset: number;
    createdAt: string;
  };
}

// NEW: Embedding service configuration
export interface EmbeddingConfig {
  model: string; // e.g., 'Xenova/all-MiniLM-L6-v2' for local, 'text-embedding-ada-002' for OpenAI
  chunkSize: 500; // Max tokens per chunk
  chunkOverlap: 50; // Token overlap between chunks for context preservation
  enabledArtifactTypes: ArtifactType[]; // Only embed these types
  batchSize: 10; // Max embeddings to process concurrently
}

// Knowledge Scope - For scoped retrieval
export type KnowledgeScope = 'client' | 'application' | 'engagement' | 'engineer';

export interface KnowledgeContext {
  scope: KnowledgeScope;
  scopeId: string;
  allowedScopes: string[]; // IDs that can be accessed in retrieval
}


export interface EngagementMetadata {
  engagementName: string;
  assessmentType: AssessmentType;
  startDate: string;
  endDate: string;
  testingMethodology: string;
  scope: string[];
  outOfScope: string[];
  assumptions: string[];
  limitations: string[];
  testingEnvironment?: string;
  toolsUsed?: string[];
}

export interface CVSSScore {
  version: '3.1' | '4.0';
  vector: string;
  baseScore: number;
  temporalScore?: number;
  environmentalScore?: number;
}

// ============================================================================
// Remediation Lineage System
// ============================================================================

export type RemediationType =
  | 'code-fix'
  | 'config-change'
  | 'infrastructure-update'
  | 'process-change'
  | 'compensating-control'
  | 'third-party-patch'
  | 'dependency-update'
  | 'architectural-change'
  | 'other';

export type RemediationOutcome =
  | 'successful'
  | 'partially-successful'
  | 'failed'
  | 'pending-verification'
  | 'reverted'
  | 'superseded';

export interface RemediationEvent {
  id: string;
  findingId: string;
  engagementId: string;
  type: RemediationType;

  // Core details
  description: string;
  implementedBy: string; // Engineer or ClientUser ID
  implementedAt: string;

  // Verification tracking
  verifiedAt?: string;
  verifiedBy?: string; // Engineer ID
  verificationEngagementId?: string; // Engagement where verification occurred
  outcome: RemediationOutcome;
  verificationNotes?: string;

  // Evidence
  evidence?: EvidenceFile[];

  // Effort tracking
  estimatedEffort?: string; // e.g., "2 hours", "1 day", "1 week"
  actualEffort?: string;

  // Metadata for intelligence
  metadata: {
    similarFindingsCount?: number; // How many similar findings this remediation could apply to
    reappeared?: boolean; // Did the finding reappear after this remediation?
    clientReported?: boolean; // Was this reported by client?
    automated?: boolean; // Was this an automated fix?
    [key: string]: any;
  };

  createdAt: string;
  updatedAt: string;
}

// Remediation suggestion from AI/historical analysis
export interface RemediationSuggestion {
  approach: string;
  type: RemediationType;
  successRate: number; // 0-1
  sampleSize: number; // How many historical attempts
  averageEffort?: string;
  warnings?: string[]; // Known failure modes
  examples?: {
    findingId: string;
    outcome: RemediationOutcome;
    notes: string;
  }[];
  confidence: 'high' | 'medium' | 'low';
}

// ============================================================================
// Retest Request System (Simpler workflow)
// ============================================================================

export type RetestStatus = 'pending' | 'assigned' | 'in-progress' | 'completed' | 'cancelled';

export interface RetestRequest {
  id: string;
  findingId: string;
  engagementId: string;
  clientId: string;

  // Request details
  requestedBy: string; // ClientUser ID
  requestedAt: string;
  clientNotes?: string; // Optional: "We've updated the authentication flow"

  // Assignment
  assignedTo?: string; // Engineer ID
  assignedAt?: string;

  // Status tracking
  status: RetestStatus;

  // Completion
  completedAt?: string;
  completedBy?: string; // Engineer ID
  retestNotes?: string; // Engineer's notes after retest

  // Result - updates the finding status when completed
  newFindingStatus?: FindingStatus; // 'Resolved', 'In Progress', etc.

  createdAt: string;
  updatedAt: string;
}

// Finding interface with discriminator and optional fields for all assessment types
// The findingType field determines which optional fields are relevant
export interface Finding {
  id: string;
  findingType: 'penetration' | 'threat-model' | 'architecture' | 'infrastructure';

  // Common fields (always required)
  title: string;
  severity: SeverityLevel;
  description: string;
  impact: string;
  remediation: string;
  status: FindingStatus;
  discoveryDate: string;
  discoveredBy?: string; // Engineer ID who discovered this finding
  createdAt: string;
  updatedAt: string;

  // Internal Notes (Hidden from Client)
  internalNotes?: string;

  // Penetration Testing fields (required when findingType === 'penetration' or 'infrastructure')
  category?: string;
  cvss?: CVSSScore;
  affectedAssets?: string[];
  attackSurface?: AttackSurface;
  authenticationRequired?: boolean;
  stepsToReproduce?: string;
  proofOfConcept?: string;
  evidenceReferences?: string[]; // Text references to evidence
  evidenceFiles?: EvidenceFile[]; // Uploaded evidence files (images, PDFs, etc.)
  cweIds?: string[];
  owaspCategories?: string[];

  // Infrastructure/Cloud/Network specific fields (required when findingType === 'infrastructure')
  assetType?: AssetType;
  cloudProvider?: CloudProvider;
  misconfigurationDetails?: string;
  exploitabilityContext?: string;
  blastRadius?: string;
  privilegeLevelRequired?: string;

  // Threat Modeling fields (required when findingType === 'threat-model')
  threatCategory?: ThreatCategory;
  affectedComponent?: string;
  attackScenario?: string;
  likelihood?: LikelihoodLevel;
  riskRating?: string;
  existingControls?: string[];
  recommendedMitigations?: string[];
  residualRisk?: string;

  // Architecture Review fields (required when findingType === 'architecture')
  designComponent?: string;
  concernCategory?: ArchitectureConcern;
  currentDesign?: string;
  riskAssessment?: string;
  recommendedDesignChanges?: string;
  implementationPriority?: 'Critical' | 'High' | 'Medium' | 'Low';

  // Remediation Lineage - track all fix attempts
  remediationHistory?: RemediationEvent[];
}

export type SectionType = 'standard' | 'custom';

export interface ReportSection {
  id: string; // 'executiveSummary', 'findings', or 'custom_123'
  title: string;
  type: SectionType;
  isVisible: boolean;
  isLocked?: boolean; // If true, cannot be removed/reordered (optional)
  content?: string; // For custom sections
  componentName?: string; // For standard sections to map to a React component
}

// Strictness level controls customization surface area
export type TemplateStrictnessLevel = 'standard' | 'flexible';

// Validation severity levels
export type ValidationSeverity = 'none' | 'warning' | 'error' | 'critical';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  severity: ValidationSeverity;
}

// Logo placement options
export type LogoPlacement = 'cover' | 'header' | 'footer' | 'cover-and-header';

// Cover Page specific configuration
export interface CoverSettings {
  title?: string;
  subtitle?: string;
  dateText?: string;
  footerText?: string;
  showClientLogo?: boolean;
  showProviderLogo?: boolean;
}

// Enhanced branding configuration with structured, restricted options
export interface BrandingConfig {
  // Logos
  clientLogoUrl?: string;
  providerLogoUrl?: string;
  logoPlacement?: LogoPlacement;

  // Colors - MUST be from approved palette (see constants.ts)
  primaryColor?: string; // Palette ID, not arbitrary hex
  secondaryColor?: string; // Palette ID, not arbitrary hex
  accentColor?: string; // Palette ID, not arbitrary hex

  // Text customization
  headerText?: string;
  footerText?: string;
  legalFooterText?: string;
  confidentialityNotice?: string;

  // Visual presentation options
  useEnhancedCover?: boolean; // Enhanced cover layout with logos
  coverSettings?: CoverSettings; // Default cover configuration
  showChartsInExecutiveSummary?: boolean; // Show severity/category charts
  showRiskMatrix?: boolean; // Show 2x2 risk matrix
}

// Findings presentation configuration (flexible mode only)
export interface FindingsPresentationConfig {
  layout: 'table' | 'narrative' | 'hybrid';
  severityOrdering: 'critical-first' | 'by-asset' | 'by-category';
  groupBy: 'severity' | 'asset' | 'category' | 'none';
  includeCharts: boolean;
  includeGraphs: boolean;
}

// Visual style configuration (flexible mode only)
export interface VisualStyleConfig {
  fontFamily: 'inter' | 'roboto' | 'opensans' | 'system'; // Restricted to approved fonts
  headingScale: 'comfortable' | 'compact' | 'spacious';
  spacingDensity: 'comfortable' | 'compact';
  pageSize: 'A4' | 'Letter';
  showPageNumbers: boolean;
  showHeaderFooter: boolean;
}

// Content control configuration
export interface ContentControlConfig {
  executiveSummaryDepth: 'high-level' | 'detailed';
  overallVerbosity: 'concise' | 'standard' | 'detailed';
  includeRemediationSteps: boolean;
  customBlocksAllowed: boolean;
}

export interface ReportTemplate {
  id: TemplateType;
  name: string;
  description: string;

  // Strictness level - controls which customization options are available
  strictnessLevel: TemplateStrictnessLevel;

  sections: ReportSection[]; // Ordered list of sections

  // Branding (available in both standard and flexible)
  branding?: BrandingConfig;

  // Content control (available in both standard and flexible)
  technicalVerbosity: 'High' | 'Medium' | 'Low';
  businessLanguageLevel: 'High' | 'Medium' | 'Low';
  includeCVSS: boolean;
  includeCWE: boolean;
  includeOWASP: boolean;
  contentControl?: ContentControlConfig;

  // Advanced options (flexible mode only)
  findingsPresentation?: FindingsPresentationConfig;
  visualStyle?: VisualStyleConfig;
}

export interface TeamMember {
  name: string;
  role: string;
  email?: string;
  qualifications?: string;
}

export interface EngagementContact {
  name: string;
  role: string;
  email: string;
  phone?: string;
  isPrimary?: boolean;
}



export interface ReportConfiguration {
  sections: ReportSection[]; // Overrides template defaults (order and visibility)
  executiveSummaryOverride?: string;
  conclusionOverride?: string;
  teamMembers?: TeamMember[];
  contacts?: EngagementContact[];
  includeTeamSection?: boolean;
  includeContactSection?: boolean;
  brandingOverride?: BrandingConfig;

  // New flexible overrides
  sectionOverrides?: Record<string, string>; // Map of Section ID -> Markdown Content
  visualStyleOverride?: Partial<VisualStyleConfig>; // Override template visual settings
  coverOverride?: CoverSettings;
}

// Alias for convenience
export type ReportConfig = ReportConfiguration;


export interface Engagement {
  id: string;
  serviceProviderId: string;
  clientId: string;
  applicationId: string; // NEW: Link to Application entity
  engineerIds: string[]; // NEW: Engineers working on this engagement
  parentEngagementId?: string; // NEW: Track previous assessment for same application
  metadata: EngagementMetadata;
  findings: Finding[];
  templateId: TemplateType;
  reportConfig?: ReportConfiguration; // New field for customization
  status: 'Draft' | 'In Progress' | 'Review' | 'Completed' | 'Delivered';
  version?: number; // 1, 2, 3...
  publishedVersions?: {
    version: number;
    publishedAt: string;
    publishedBy?: string;
    changeNotes?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  serviceProviders: ServiceProviderProfile[];
  clients: ClientProfile[];
  applications: Application[]; // NEW
  engineers: Engineer[]; // NEW
  artifacts: Artifact[]; // NEW
  engagements: Engagement[];
  templates: ReportTemplate[];
  clientUsers: ClientUser[]; // NEW
  currentEngagementId?: string;
}

// ============================================================================
// Component Registry - Track Application Components Across Findings
// ============================================================================

export type ComponentType =
  | 'endpoint'       // REST/GraphQL endpoints
  | 'service'        // Backend services/modules
  | 'database'       // Tables, collections
  | 'file'           // File systems, uploads
  | 'external-api'   // Third-party integrations
  | 'frontend'       // UI components
  | 'infrastructure' // Servers, containers
  | 'other';

export type TrustZone =
  | 'public'         // Internet-facing
  | 'authenticated'  // Requires login
  | 'internal'       // Internal services only
  | 'admin'          // Admin-only
  | 'database'       // Data layer
  | 'unknown';

export interface Component {
  id: string;
  applicationId: string; // Scope to application
  name: string; // e.g., "/api/users/login", "UserService", "users_table"
  type: ComponentType;
  trustZone: TrustZone;
  description?: string;
  metadata?: {
    technology?: string; // e.g., "Node.js", "PostgreSQL"
    framework?: string; // e.g., "Express", "React"
    authentication?: boolean;
    userInput?: boolean; // Does it handle user input?
  };
  findingIds: string[]; // Findings that mention this component
  firstSeen: string; // ISO date
  lastSeen: string; // ISO date
  createdAt: string;
  updatedAt: string;
}

export interface ComponentFinding {
  componentId: string;
  findingId: string;
  role: 'affected' | 'related' | 'remediation-target';
  extractionMethod: 'manual' | 'auto-ner' | 'auto-pattern';
  confidence: number; // 0-1
  linkedAt: string;
}

export interface ExtractedComponent {
  name: string;
  type: ComponentType;
  confidence: number;
  extractionMethod: 'auto-pattern' | 'auto-ner';
  context?: string; // Text snippet showing where it was found
  suggestedTrustZone?: TrustZone;
}

