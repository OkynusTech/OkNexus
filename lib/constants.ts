import { ReportTemplate, SeverityLevel } from './types';

// Severity levels in order of criticality
export const SEVERITY_LEVELS: SeverityLevel[] = [
    'Critical',
    'High',
    'Medium',
    'Low',
    'Informational',
];

export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
    Critical: 'bg-red-600 text-white',
    High: 'bg-orange-600 text-white',
    Medium: 'bg-yellow-600 text-white',
    Low: 'bg-blue-600 text-white',
    Informational: 'bg-gray-600 text-white',
};

// Common finding categories
export const FINDING_CATEGORIES = [
    'Authentication',
    'Authorization',
    'Session Management',
    'Cryptography',
    'Input Validation',
    'Output Encoding',
    'Error Handling',
    'Logging and Monitoring',
    'Data Protection',
    'API Security',
    'Configuration',
    'Business Logic',
    'File Upload',
    'Injection',
    'Cross-Site Scripting (XSS)',
    'Cross-Site Request Forgery (CSRF)',
    'Security Misconfiguration',
    'Sensitive Data Exposure',
    'XML External Entities (XXE)',
    'Broken Access Control',
    'Security Headers',
    'Transport Security',
    'Other',
];

// Common CWE mappings
export const COMMON_CWES = [
    { id: 'CWE-79', name: 'Cross-site Scripting (XSS)' },
    { id: 'CWE-89', name: 'SQL Injection' },
    { id: 'CWE-78', name: 'OS Command Injection' },
    { id: 'CWE-22', name: 'Path Traversal' },
    { id: 'CWE-352', name: 'Cross-Site Request Forgery (CSRF)' },
    { id: 'CWE-434', name: 'Unrestricted Upload of File with Dangerous Type' },
    { id: 'CWE-502', name: 'Deserialization of Untrusted Data' },
    { id: 'CWE-287', name: 'Improper Authentication' },
    { id: 'CWE-798', name: 'Use of Hard-coded Credentials' },
    { id: 'CWE-862', name: 'Missing Authorization' },
    { id: 'CWE-863', name: 'Incorrect Authorization' },
    { id: 'CWE-200', name: 'Exposure of Sensitive Information' },
    { id: 'CWE-522', name: 'Insufficiently Protected Credentials' },
    { id: 'CWE-326', name: 'Inadequate Encryption Strength' },
    { id: 'CWE-327', name: 'Use of a Broken or Risky Cryptographic Algorithm' },
];

// OWASP Top 10 2021
export const OWASP_TOP_10 = [
    'A01:2021 - Broken Access Control',
    'A02:2021 - Cryptographic Failures',
    'A03:2021 - Injection',
    'A04:2021 - Insecure Design',
    'A05:2021 - Security Misconfiguration',
    'A06:2021 - Vulnerable and Outdated Components',
    'A07:2021 - Identification and Authentication Failures',
    'A08:2021 - Software and Data Integrity Failures',
    'A09:2021 - Security Logging and Monitoring Failures',
    'A10:2021 - Server-Side Request Forgery (SSRF)',
];

// Testing methodologies
export const TESTING_METHODOLOGIES = [
    'OWASP Testing Guide',
    'PTES (Penetration Testing Execution Standard)',
    'NIST SP 800-115',
    'OSSTMM (Open Source Security Testing Methodology Manual)',
    'Custom Methodology',
];

// STRIDE Threat Categories
export const STRIDE_CATEGORIES = [
    'Spoofing',
    'Tampering',
    'Repudiation',
    'Information Disclosure',
    'Denial of Service',
    'Elevation of Privilege',
];

// Asset Types for Infrastructure/Cloud/Network
export const ASSET_TYPES = [
    'VM',
    'Load Balancer',
    'VPC',
    'IAM',
    'Storage',
    'Network Device',
    'Firewall',
    'Container',
    'Serverless',
];

// Cloud Providers
export const CLOUD_PROVIDERS = [
    'AWS',
    'Azure',
    'GCP',
    'On-Premise',
    'Hybrid',
];

// Attack Surfaces
export const ATTACK_SURFACES = [
    'Web',
    'API',
    'Mobile',
    'Cloud',
    'Network',
    'Infrastructure',
];

// Likelihood Levels
export const LIKELIHOOD_LEVELS = [
    'Very Low',
    'Low',
    'Medium',
    'High',
    'Very High',
];

// Architecture Concerns
export const ARCHITECTURE_CONCERNS = [
    'Security',
    'Scalability',
    'Reliability',
    'Performance',
    'Maintainability',
    'Cost',
];

// Report templates configuration

// Approved color palette for professional, print-safe reports
// Phase 1: Only palette colors allowed (no arbitrary hex)
export const BRAND_COLOR_PALETTE = {
    // Professional blues - Primary branding
    deepBlue: { id: 'deep-blue', hex: '#1E40AF', name: 'Deep Blue' },
    royalBlue: { id: 'royal-blue', hex: '#2563EB', name: 'Royal Blue' },
    brightBlue: { id: 'bright-blue', hex: '#3B82F6', name: 'Bright Blue' },
    skyBlue: { id: 'sky-blue', hex: '#60A5FA', name: 'Sky Blue' },

    // Professional grays - Secondary/neutral
    charcoal: { id: 'charcoal', hex: '#1F2937', name: 'Charcoal' },
    slate: { id: 'slate', hex: '#374151', name: 'Slate' },
    graphite: { id: 'graphite', hex: '#4B5563', name: 'Graphite' },
    ash: { id: 'ash', hex: '#6B7280', name: 'Ash' },

    // Accent colors - Limited use, high contrast
    crimson: { id: 'crimson', hex: '#DC2626', name: 'Crimson' },
    amber: { id: 'amber', hex: '#D97706', name: 'Amber' },
    emerald: { id: 'emerald', hex: '#059669', name: 'Emerald' },

    // Conservative defaults
    defaultPrimary: { id: 'default-primary', hex: '#1F2937', name: 'Default Primary' },
    defaultSecondary: { id: 'default-secondary', hex: '#4B5563', name: 'Default Secondary' },
    defaultAccent: { id: 'default-accent', hex: '#2563EB', name: 'Default Accent' },
} as const;

// Approved font families with system fallbacks
export const APPROVED_FONTS = [
    {
        id: 'inter' as const,
        name: 'Inter',
        fallback: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        description: 'Modern, highly legible sans-serif (recommended)'
    },
    {
        id: 'roboto' as const,
        name: 'Roboto',
        fallback: 'Arial, sans-serif',
        description: 'Professional, widely compatible sans-serif'
    },
    {
        id: 'opensans' as const,
        name: 'Open Sans',
        fallback: 'Arial, sans-serif',
        description: 'Clean, readable sans-serif'
    },
    {
        id: 'system' as const,
        name: 'System Default',
        fallback: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        description: 'Native system fonts for optimal rendering'
    },
] as const;

// Helper to create standard sections
export const createStandardSections = (): any[] => [
    { id: 'coverPage', title: 'Cover Page', type: 'standard', isVisible: true, isLocked: false },
    { id: 'confidentialityNotice', title: 'Confidentiality Notice', type: 'standard', isVisible: true },
    { id: 'executiveSummary', title: 'Executive Summary', type: 'standard', isVisible: true },
    { id: 'historicalComparison', title: 'Historical Comparison', type: 'standard', isVisible: true },
    { id: 'teamMembers', title: 'Engagement Team', type: 'standard', isVisible: false },
    { id: 'scopeAndMethodology', title: 'Scope and Methodology', type: 'standard', isVisible: true },
    { id: 'riskRatingExplanation', title: 'Risk Rating Explanation', type: 'standard', isVisible: true },
    { id: 'findingsSummaryTable', title: 'Findings Summary', type: 'standard', isVisible: true },
    { id: 'detailedFindings', title: 'Detailed Findings', type: 'standard', isVisible: true },
    { id: 'recommendations', title: 'Recommendations', type: 'standard', isVisible: true },
    { id: 'conclusion', title: 'Conclusion', type: 'standard', isVisible: true },
];


export const REPORT_TEMPLATES: Record<string, ReportTemplate> = {
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        description: 'Formal, comprehensive report suitable for large organizations and compliance requirements',
        strictnessLevel: 'standard',
        sections: createStandardSections(),
        technicalVerbosity: 'High',
        businessLanguageLevel: 'High',
        includeCVSS: true,
        includeCWE: true,
        includeOWASP: true,
        branding: {
            primaryColor: 'default-primary',
            secondaryColor: 'default-secondary',
            accentColor: 'default-accent',
            useEnhancedCover: true,
            showChartsInExecutiveSummary: true,
            showRiskMatrix: true,
        },
    },
    startup: {
        id: 'startup',
        name: 'Startup',
        description: 'Concise, actionable report focused on quick remediation',
        strictnessLevel: 'standard',
        sections: [
            { id: 'coverPage', title: 'Cover Page', type: 'standard', isVisible: true, isLocked: true },
            { id: 'executiveSummary', title: 'Executive Summary', type: 'standard', isVisible: true },
            { id: 'findingsSummaryTable', title: 'Findings Summary', type: 'standard', isVisible: true },
            { id: 'detailedFindings', title: 'Detailed Findings', type: 'standard', isVisible: true },
            { id: 'recommendations', title: 'Recommendations', type: 'standard', isVisible: true },
            // Hidden sections
            { id: 'confidentialityNotice', title: 'Confidentiality Notice', type: 'standard', isVisible: false },
            { id: 'teamMembers', title: 'Engagement Team', type: 'standard', isVisible: false },
            { id: 'scopeAndMethodology', title: 'Scope and Methodology', type: 'standard', isVisible: false },
            { id: 'riskRatingExplanation', title: 'Risk Rating Explanation', type: 'standard', isVisible: false },
            { id: 'conclusion', title: 'Conclusion', type: 'standard', isVisible: false },
        ],
        technicalVerbosity: 'Medium',
        businessLanguageLevel: 'Medium',
        includeCVSS: false,
        includeCWE: false,
        includeOWASP: true,
        branding: {
            primaryColor: 'bright-blue',
            secondaryColor: 'ash',
            accentColor: 'emerald',
        },
    },
    developer: {
        id: 'developer',
        name: 'Developer-Focused',
        description: 'Technical depth with code examples and detailed remediation steps',
        strictnessLevel: 'flexible',
        sections: [
            { id: 'scopeAndMethodology', title: 'Scope and Methodology', type: 'standard', isVisible: true },
            { id: 'riskRatingExplanation', title: 'Risk Rating Explanation', type: 'standard', isVisible: true },
            { id: 'findingsSummaryTable', title: 'Findings Summary', type: 'standard', isVisible: true },
            { id: 'detailedFindings', title: 'Detailed Findings', type: 'standard', isVisible: true },
            { id: 'recommendations', title: 'Recommendations', type: 'standard', isVisible: true },
            // Hidden
            { id: 'coverPage', title: 'Cover Page', type: 'standard', isVisible: false },
            { id: 'confidentialityNotice', title: 'Confidentiality Notice', type: 'standard', isVisible: false },
            { id: 'executiveSummary', title: 'Executive Summary', type: 'standard', isVisible: false },
            { id: 'teamMembers', title: 'Engagement Team', type: 'standard', isVisible: false },
            { id: 'conclusion', title: 'Conclusion', type: 'standard', isVisible: false },
        ],
        technicalVerbosity: 'High',
        businessLanguageLevel: 'Low',
        includeCVSS: true,
        includeCWE: true,
        includeOWASP: true,
        branding: {
            primaryColor: 'charcoal',
            secondaryColor: 'graphite',
            accentColor: 'sky-blue',
        },
        visualStyle: {
            fontFamily: 'roboto',
            headingScale: 'compact',
            spacingDensity: 'compact',
            pageSize: 'Letter',
            showPageNumbers: true,
            showHeaderFooter: true,
        },
        findingsPresentation: {
            layout: 'hybrid',
            severityOrdering: 'critical-first',
            groupBy: 'severity',
            includeCharts: false,
            includeGraphs: true,
        },
    },
    compliance: {
        id: 'compliance',
        name: 'Compliance & Audit',
        description: 'Audit-ready format with comprehensive documentation and traceability',
        strictnessLevel: 'standard',
        sections: createStandardSections(),
        technicalVerbosity: 'High',
        businessLanguageLevel: 'High',
        includeCVSS: true,
        includeCWE: true,
        includeOWASP: true,
        branding: {
            primaryColor: 'deep-blue',
            secondaryColor: 'slate',
            accentColor: 'crimson',
        },
    },
    executive: {
        id: 'executive',
        name: 'Executive Summary',
        description: 'High-level overview for C-level executives and board members',
        strictnessLevel: 'standard',
        sections: [
            { id: 'coverPage', title: 'Cover Page', type: 'standard', isVisible: true, isLocked: true },
            { id: 'executiveSummary', title: 'Executive Summary', type: 'standard', isVisible: true },
            { id: 'riskRatingExplanation', title: 'Risk Rating Explanation', type: 'standard', isVisible: true },
            { id: 'findingsSummaryTable', title: 'Findings Summary', type: 'standard', isVisible: true },
            { id: 'recommendations', title: 'Recommendations', type: 'standard', isVisible: true },
            { id: 'conclusion', title: 'Conclusion', type: 'standard', isVisible: true },
            // Hidden
            { id: 'detailedFindings', title: 'Detailed Findings', type: 'standard', isVisible: false },
            { id: 'confidentialityNotice', title: 'Confidentiality Notice', type: 'standard', isVisible: false },
            { id: 'teamMembers', title: 'Engagement Team', type: 'standard', isVisible: false },
            { id: 'scopeAndMethodology', title: 'Scope and Methodology', type: 'standard', isVisible: false },
        ],
        technicalVerbosity: 'Low',
        businessLanguageLevel: 'High',
        includeCVSS: false,
        includeCWE: false,
        includeOWASP: false,
        branding: {
            primaryColor: 'royal-blue',
            secondaryColor: 'graphite',
            accentColor: 'amber',
            useEnhancedCover: true,
            showChartsInExecutiveSummary: true,
            showRiskMatrix: true,
        },
    },
};

// Default legal disclaimer
export const DEFAULT_LEGAL_DISCLAIMER = `This report contains confidential and proprietary information. It is intended solely for the use of the client organization and should not be distributed to third parties without prior written consent. The findings and recommendations in this report are based on the assessment conducted during the specified time period and reflect the state of the systems at that time. Security is an ongoing process, and new vulnerabilities may emerge after the completion of this assessment.`;

// Default service provider profile
export const DEFAULT_SERVICE_PROVIDER = {
    companyName: 'Your Security Company',
    contactEmail: 'contact@example.com',
    legalDisclaimer: DEFAULT_LEGAL_DISCLAIMER,
    defaultSeverityModel: 'CVSS' as const,
    defaultRemediationTone: 'Balanced' as const,
};
