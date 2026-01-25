'use client';

import { ArrowLeft, Plus, Trash2, Edit, FileText, Settings, AlertTriangle, CheckCircle2, Search, Loader2, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Finding, SeverityLevel, FindingStatus, Engineer } from '@/lib/types';
import {
    FINDING_CATEGORIES,
    SEVERITY_LEVELS,
    STRIDE_CATEGORIES,
    ASSET_TYPES,
    CLOUD_PROVIDERS,
    ATTACK_SURFACES,
    LIKELIHOOD_LEVELS,
    ARCHITECTURE_CONCERNS,
} from '@/lib/constants';
import { generateFindingId } from '@/lib/report-utils';
import { validateFinding, ValidationError } from '@/lib/finding-validation';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel } from '@/components/ui/select';
import { EvidenceUpload } from '@/components/ui/evidence-upload';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import { AIAssistancePanel } from './ai-assistance-panel';
import { AIAssistant } from '@/lib/ai-assistance';
import { getHistoricalContext } from '@/lib/engagement-history';
import { getAllEngineers } from '@/lib/storage';
import { EvidenceFile } from '@/lib/types';
import { ArtifactExcerptCard } from './artifact-excerpt-card';
import { ScopedRetrievalService } from '@/lib/knowledge-service';
import { ArtifactContext } from '@/app/actions/similarity-intelligence';
import { ComponentExtractor } from '@/lib/component-extraction';
import { createComponent, getComponentByName, linkComponentToFinding, getClient, getApplication, getEngagementById, getComponentsByApplication } from '@/lib/storage';
import { Component, RemediationEvent } from '@/lib/types';
import { VerifyRemediationDialog } from './verify-remediation-dialog';
import { RemediationHistoryPanel } from '@/components/remediation/remediation-history-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { History as HistoryIcon, AlertCircle } from 'lucide-react';

interface FindingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (finding: Finding) => void;
    finding?: Finding | null;
    assessmentType: string; // Used to determine default findingType
    engagementId: string;
    applicationId: string;
    clientId: string;
}

export function FindingDialog({
    open,
    onOpenChange,
    onSave,
    finding,
    assessmentType,
    engagementId,
    applicationId,
    clientId
}: FindingDialogProps) {
    // Determine default finding type based on assessment type
    const getDefaultFindingType = (): Finding['findingType'] => {
        if (assessmentType === 'Threat Modeling') return 'threat-model';
        if (assessmentType === 'Architecture Review') return 'architecture';
        if (assessmentType === 'Cloud Security Assessment' || assessmentType === 'Network Security Assessment') return 'infrastructure';
        return 'penetration'; // Default for Penetration Testing and Security Review
    };

    // Common fields
    const [findingType, setFindingType] = useState<Finding['findingType']>(getDefaultFindingType());
    const [title, setTitle] = useState('');
    const [severity, setSeverity] = useState<SeverityLevel>('Medium');
    const [description, setDescription] = useState('');
    const [impact, setImpact] = useState('');
    const [remediation, setRemediation] = useState('');
    const [status, setStatus] = useState<FindingStatus>('Open');

    // Penetration/Infrastructure fields
    const [category, setCategory] = useState('');
    const [cvssScore, setCvssScore] = useState('');
    const [cvssVector, setCvssVector] = useState('');
    const [affectedAssets, setAffectedAssets] = useState('');
    const [attackSurface, setAttackSurface] = useState('');
    const [authRequired, setAuthRequired] = useState(false);
    const [stepsToReproduce, setStepsToReproduce] = useState('');
    const [proofOfConcept, setProofOfConcept] = useState('');
    const [evidenceReferences, setEvidenceReferences] = useState('');
    const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([]);
    const [cweIds, setCweIds] = useState('');
    const [owaspCategories, setOwaspCategories] = useState('');

    // Infrastructure-specific fields
    const [assetType, setAssetType] = useState('');
    const [cloudProvider, setCloudProvider] = useState('');
    const [misconfigurationDetails, setMisconfigurationDetails] = useState('');
    const [blastRadius, setBlastRadius] = useState('');

    // Construct AI Context
    const [aiContext, setAiContext] = useState('');

    useEffect(() => {
        // Build rich context for AI
        const buildContext = () => {
            // Use imported getters to resolve names from IDs
            const client = getClient(clientId);
            const app = getApplication(applicationId);
            const engagement = getEngagementById(engagementId);

            const parts = [
                `Client: ${client?.companyName || clientId}`,
                `Application: ${app?.name || applicationId}`,
                `Engagement: ${engagement?.metadata?.engagementName || engagementId}`,
                `Assessment Type: ${assessmentType}`,
                `Finding Type: ${findingType}`,
                `Severity: ${severity}`,
                `Title: ${title}`
            ];

            setAiContext(parts.join('\n'));
        };

        buildContext();
    }, [clientId, applicationId, engagementId, assessmentType, findingType, severity, title]);

    const contextData = {
        clientId,
        applicationId,
        engagementId
    };

    // Threat modeling fields
    const [threatCategory, setThreatCategory] = useState('');
    const [affectedComponent, setAffectedComponent] = useState('');
    const [attackScenario, setAttackScenario] = useState('');
    const [likelihood, setLikelihood] = useState('');
    const [riskRating, setRiskRating] = useState('');
    const [existingControls, setExistingControls] = useState('');
    const [recommendedMitigations, setRecommendedMitigations] = useState('');
    const [residualRisk, setResidualRisk] = useState('');

    // Architecture fields
    const [designComponent, setDesignComponent] = useState('');
    const [concernCategory, setConcernCategory] = useState('');
    const [currentDesign, setCurrentDesign] = useState('');
    const [riskAssessment, setRiskAssessment] = useState('');
    const [recommendedDesignChanges, setRecommendedDesignChanges] = useState('');
    const [implementationPriority, setImplementationPriority] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('Medium');

    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [similarityResults, setSimilarityResults] = useState<any[]>([]);
    const [isCheckingSimilarity, setIsCheckingSimilarity] = useState(false);
    const [discoveredBy, setDiscoveredBy] = useState('');
    const [engineers, setEngineers] = useState<Engineer[]>([]);
    const [artifactExcerpts, setArtifactExcerpts] = useState<ArtifactContext[]>([]);
    const [contextDataState, setContextDataState] = useState<any>(null); // Renamed to avoid conflict with constant

    // Components
    const [availableComponents, setAvailableComponents] = useState<Component[]>([]);

    // Verify Remediation Dialog State (Provider verifies client fixes)
    const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
    const [selectedRemediationEvent, setSelectedRemediationEvent] = useState<RemediationEvent | null>(null);
    const [currentEngineerId, setCurrentEngineerId] = useState('eng_default'); // Would get from auth
    const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
    const [newComponentName, setNewComponentName] = useState('');
    const [newComponentType, setNewComponentType] = useState<Component['type']>('service');

    // Load engineers and components
    useEffect(() => {
        setEngineers(getAllEngineers());
        setAvailableComponents(getComponentsByApplication(applicationId));
    }, [applicationId]);

    const handleCreateComponent = () => {
        if (!newComponentName.trim()) return;

        try {
            const newComp = createComponent({
                applicationId,
                name: newComponentName.trim(),
                type: newComponentType,
                trustZone: 'unknown',
                description: 'Manually added during finding creation',
                findingIds: [],
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
            });

            setAvailableComponents(prev => [...prev, newComp]);
            setSelectedComponentIds(prev => [...prev, newComp.id]);
            setNewComponentName('');
            // Reset to default
            setNewComponentType('service');
        } catch (error) {
            console.error('Failed to create component:', error);
            alert('Failed to create component');
        }
    };

    // Load finding data when editing
    useEffect(() => {
        if (finding) {
            setFindingType(finding.findingType);
            setTitle(finding.title);
            setSeverity(finding.severity);
            setDescription(finding.description);
            setImpact(finding.impact);
            setRemediation(finding.remediation);
            setStatus(finding.status);

            // Penetration/Infrastructure fields
            setCategory(finding.category || '');
            setCvssScore(finding.cvss?.baseScore.toString() || '');
            setCvssVector(finding.cvss?.vector || '');
            setAffectedAssets(finding.affectedAssets?.join('\n') || '');
            setAttackSurface(finding.attackSurface || '');
            setAuthRequired(finding.authenticationRequired || false);
            setStepsToReproduce(finding.stepsToReproduce || '');
            setProofOfConcept(finding.proofOfConcept || '');
            setEvidenceReferences(finding.evidenceReferences?.join('\n') || '');
            setEvidenceFiles(finding.evidenceFiles || []);
            setCweIds(finding.cweIds?.join(', ') || '');
            setOwaspCategories(finding.owaspCategories?.join(', ') || '');

            // Infrastructure-specific
            setAssetType(finding.assetType || '');
            setCloudProvider(finding.cloudProvider || '');
            setMisconfigurationDetails(finding.misconfigurationDetails || '');
            setBlastRadius(finding.blastRadius || '');

            // Threat modeling
            setThreatCategory(finding.threatCategory || '');
            setAffectedComponent(finding.affectedComponent || '');
            setAttackScenario(finding.attackScenario || '');
            setLikelihood(finding.likelihood || '');
            setRiskRating(finding.riskRating || '');
            setExistingControls(finding.existingControls?.join('\n') || '');
            setRecommendedMitigations(finding.recommendedMitigations?.join('\n') || '');
            setResidualRisk(finding.residualRisk || '');

            // Architecture
            setDesignComponent(finding.designComponent || '');
            setConcernCategory(finding.concernCategory || '');
            setCurrentDesign(finding.currentDesign || '');
            setRiskAssessment(finding.riskAssessment || '');
            setRecommendedDesignChanges(finding.recommendedDesignChanges || '');
            setImplementationPriority(finding.implementationPriority || 'Medium');

            // Common field
            setDiscoveredBy(finding.discoveredBy || '');
        } else {
            // Reset form
            resetForm();
        }
        setErrors([]);
    }, [finding, open]);

    const resetForm = () => {
        setFindingType(getDefaultFindingType());
        setTitle('');
        setSeverity('Medium');
        setDescription('');
        setImpact('');
        setRemediation('');
        setStatus('Open');
        setCategory('');
        setCvssScore('');
        setCvssVector('');
        setAffectedAssets('');
        setAttackSurface('');
        setAuthRequired(false);
        setStepsToReproduce('');
        setProofOfConcept('');
        setEvidenceReferences('');
        setEvidenceFiles([]);
        setCweIds('');
        setOwaspCategories('');
        setAssetType('');
        setCloudProvider('');
        setMisconfigurationDetails('');
        setBlastRadius('');
        setThreatCategory('');
        setAffectedComponent('');
        setAttackScenario('');
        setLikelihood('');
        setRiskRating('');
        setExistingControls('');
        setRecommendedMitigations('');
        setResidualRisk('');
        setDesignComponent('');
        setConcernCategory('');
        setCurrentDesign('');
        setRiskAssessment('');
        setRecommendedDesignChanges('');
        setImplementationPriority('Medium');
    };

    const handleSave = () => {
        const baseFinding: Partial<Finding> = {
            id: finding?.id || generateFindingId(),
            findingType,
            title,
            severity,
            description,
            impact,
            remediation,
            status,
            discoveryDate: finding?.discoveryDate || new Date().toISOString(),
            discoveredBy: discoveredBy || undefined,
            createdAt: finding?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Add type-specific fields
        if (findingType === 'penetration' || findingType === 'infrastructure') {
            baseFinding.category = category;
            baseFinding.cvss = cvssScore
                ? {
                    version: '3.1',
                    vector: cvssVector || 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N',
                    baseScore: parseFloat(cvssScore),
                }
                : undefined;
            baseFinding.affectedAssets = affectedAssets.split('\n').filter((a) => a.trim());
            baseFinding.attackSurface = (attackSurface as any) || undefined;
            baseFinding.authenticationRequired = authRequired;
            baseFinding.stepsToReproduce = stepsToReproduce;
            baseFinding.proofOfConcept = proofOfConcept || undefined;
            baseFinding.evidenceReferences = evidenceReferences.split('\n').filter((e) => e.trim());
            baseFinding.evidenceFiles = evidenceFiles;
            baseFinding.cweIds = cweIds.split(',').map((c) => c.trim()).filter((c) => c);
            baseFinding.owaspCategories = owaspCategories.split(',').map((o) => o.trim()).filter((o) => o);
        }

        if (findingType === 'infrastructure') {
            baseFinding.assetType = (assetType as any) || undefined;
            baseFinding.cloudProvider = (cloudProvider as any) || undefined;
            baseFinding.misconfigurationDetails = misconfigurationDetails || undefined;
            baseFinding.blastRadius = blastRadius || undefined;
        }

        if (findingType === 'threat-model') {
            baseFinding.threatCategory = threatCategory as any;
            baseFinding.affectedComponent = affectedComponent;
            baseFinding.attackScenario = attackScenario;
            baseFinding.likelihood = likelihood as any;
            baseFinding.riskRating = riskRating;
            baseFinding.existingControls = existingControls.split('\n').filter((c) => c.trim());
            baseFinding.recommendedMitigations = recommendedMitigations.split('\n').filter((m) => m.trim());
            baseFinding.residualRisk = residualRisk || undefined;
        }

        if (findingType === 'architecture') {
            baseFinding.designComponent = designComponent;
            baseFinding.concernCategory = concernCategory as any;
            baseFinding.currentDesign = currentDesign;
            baseFinding.riskAssessment = riskAssessment;
            baseFinding.recommendedDesignChanges = recommendedDesignChanges;
            baseFinding.implementationPriority = implementationPriority;
        }

        const validationErrors = validateFinding(baseFinding);
        if (validationErrors.length > 0) {
            setErrors(validationErrors);
            return;
        }

        // Auto-extract components from finding
        try {
            const extracted = ComponentExtractor.extractFromFinding(baseFinding as Finding);
            console.log('Extracted components:', extracted.length, extracted.map(c => ({ name: c.name, type: c.type })));

            for (const extractedComp of extracted) {
                // Check if component already exists
                let existingComponent = getComponentByName(extractedComp.name, applicationId);

                if (!existingComponent) {
                    // Create new component
                    existingComponent = createComponent({
                        applicationId,
                        name: extractedComp.name,
                        type: extractedComp.type,
                        trustZone: extractedComp.suggestedTrustZone || 'unknown',
                        description: extractedComp.context,
                        findingIds: [],
                        firstSeen: new Date().toISOString(),
                        lastSeen: new Date().toISOString(),
                    });
                    console.log('Created component:', existingComponent.name);
                }

                // Link to finding
                if (baseFinding.id) {
                    linkComponentToFinding(
                        existingComponent.id,
                        baseFinding.id,
                        'affected',
                        extractedComp.extractionMethod,
                        extractedComp.confidence
                    );
                    console.log('Linked component to finding:', existingComponent.name);
                }
            }
        } catch (error) {
            console.error('Component extraction failed:', error);
            // Don't block finding save if extraction fails
        }

        // Link Manual Components
        if (baseFinding.id) {
            for (const compId of selectedComponentIds) {
                linkComponentToFinding(
                    compId,
                    baseFinding.id,
                    'affected',
                    'manual',
                    1.0 // High confidence for manual selection
                );
            }
        }

        onSave(baseFinding as Finding);
        onOpenChange(false);
    };

    const handleCheckSimilarity = async () => {
        if (!title.trim()) {
            alert('Please enter a title first');
            return;
        }

        setIsCheckingSimilarity(true);
        try {
            // Get ALL historical findings for this application (no strict pre-filter)
            const context = getHistoricalContext(applicationId);
            console.log('=== SIMILARITY DEBUG ===');
            console.log('Total historical findings:', context.pastFindings.length);
            console.log('Current title:', title);

            // Simple title-based pre-filter (very permissive)
            const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            console.log('Keywords extracted:', titleWords);

            let candidates = context.pastFindings
                .filter(({ finding: pastFinding, engagementId: histEngagementId }) => {
                    // NEW: We DO check current engagement now, just skip the exact same finding (if editing)
                    if (finding?.id && pastFinding.id === finding.id) return false;

                    // If title shares at least 1 word (>3 chars), it's a candidate
                    const pastTitleWords = pastFinding.title.toLowerCase().split(/\s+/);
                    return titleWords.some(word => pastTitleWords.some(pw => pw.includes(word) || word.includes(pw)));
                })
                .map(h => h.finding);

            console.log('Candidates after word filter:', candidates.length);

            // FAILSAFE: If word filter found nothing, send ALL findings to AI
            if (candidates.length === 0 && context.pastFindings.length > 0) {
                console.log('FAILSAFE ACTIVATED: No word matches, using ALL findings');
                candidates = context.pastFindings
                    .filter(({ finding: pastFinding }) =>
                        // Just skip self
                        !finding?.id || pastFinding.id !== finding.id
                    )
                    .map(h => h.finding);
                console.log('Failsafe candidates:', candidates.length);
            }

            if (candidates.length === 0) {
                setSimilarityResults([]);
                alert(`No historical findings found. Total in history: ${context.pastFindings.length}`);
                return;
            }

            // Retrieve relevant artifacts for context
            const queryText = `${title} ${description || ''}`.trim();
            const artifactResults = ScopedRetrievalService.retrieveForEngagementWithArtifacts(
                engagementId,
                applicationId,
                clientId,
                queryText,
                {
                    maxResults: 5,
                    minRelevanceScore: 0.4,
                    artifactTypes: ['report', 'policy', 'diagram', 'test-plan']
                }
            );

            console.log('Retrieved artifacts:', artifactResults.artifactExcerpts.length);
            setArtifactExcerpts(artifactResults.artifactExcerpts);

            // Let AI do the heavy lifting with semantic analysis
            const results = await AIAssistant.analyzeSemanticSimilarity(
                {
                    title,
                    description: description || '',
                    severity,
                    affectedAssets: affectedAssets.split('\n').filter(a => a.trim())
                },
                candidates
            );

            console.log('AI returned:', results.length, 'similar findings');
            if (results.length > 0) {
                console.log('Top match class:', results[0].analysis.similarityClass);
            }

            if (results.length === 0) {
                alert('AI found no meaningful similarities.');
            }
            setSimilarityResults(results);
        } catch (error) {
            console.error('Similarity check failed:', error);
            alert('Similarity check failed. Please try again.');
        } finally {
            setIsCheckingSimilarity(false);
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent
                    className="max-h-[90vh] max-w-4xl overflow-y-auto"
                    onInteractOutside={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest('.ai-refinement-popover')) {
                            e.preventDefault();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>{finding ? 'Edit Finding' : 'Add New Finding'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Semantic Similarity Results */}
                        {similarityResults.length > 0 && (
                            <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Info className="h-5 w-5 text-blue-400" />
                                        <h4 className="font-semibold text-blue-200">Historical Context Surfacing</h4>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${similarityResults[0]?.analysis?.userFacingContext?.relevanceRating === 'HIGH' ? 'bg-blue-600 text-white' :
                                        'bg-blue-500/20 text-blue-300'
                                        }`}>
                                        {similarityResults[0]?.analysis?.userFacingContext?.relevanceRating || 'LOW'} Relevance
                                    </span>
                                </div>

                                {/* Context for Surfacing */}
                                <p className="text-sm text-gray-700 mb-4 italic border-l-2 border-blue-300 pl-3">
                                    {similarityResults[0]?.analysis?.userFacingContext?.contextForSurfacing || 'No context available.'}
                                </p>

                                {/* Reasoning Breakdown (Proper Separation) */}
                                {similarityResults[0]?.analysis?.reasoningDimensions && (
                                    <div className="mb-4 bg-white/60 p-2 rounded border border-blue-100">
                                        <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">AI Reasoning Breakdown</h5>
                                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                                            <div className="flex items-center gap-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${similarityResults[0].analysis.reasoningDimensions.rootCause === 'MATCH' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                <span className="text-gray-700">Root Cause: <strong>{similarityResults[0].analysis.reasoningDimensions.rootCause}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${similarityResults[0].analysis.reasoningDimensions.controlLayer === 'MATCH' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                <span className="text-gray-700">Control Layer: <strong>{similarityResults[0].analysis.reasoningDimensions.controlLayer}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${similarityResults[0].analysis.reasoningDimensions.trustBoundary === 'MATCH' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                <span className="text-gray-700">Trust Boundary: <strong>{similarityResults[0].analysis.reasoningDimensions.trustBoundary}</strong></span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className={`w-1.5 h-1.5 rounded-full ${similarityResults[0].analysis.reasoningDimensions.threatModel === 'SIMILAR' ? 'bg-green-500' : 'bg-gray-300'}`} />
                                                <span className="text-gray-700">Threat Model: <strong>{similarityResults[0].analysis.reasoningDimensions.threatModel}</strong></span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Historically Related Items */}
                                <div className="space-y-3 mb-4">
                                    <h5 className="text-xs font-semibold text-blue-800 uppercase tracking-wider">Historically Related Items</h5>
                                    {similarityResults.map((result, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded border border-blue-100 shadow-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-sm font-semibold text-gray-900">{result.finding.title}</span>
                                                <div className="text-[10px] text-gray-500 font-mono">
                                                    {new Date(result.finding.discoveryDate).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-600">
                                                {result.analysis.userFacingContext.relatedItems[0]?.factualDescriptor || "Historical item surfaced for context."}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                {/* Meta Pattern (if any) */}
                                {similarityResults[0].analysis.metaPattern && (
                                    <div className="mb-4">
                                        <h5 className="text-xs font-semibold text-purple-800 uppercase tracking-wider mb-2">Detailed Pattern Observed</h5>
                                        <div className="text-xs text-gray-700 bg-purple-50 p-2 rounded border border-purple-100">
                                            {similarityResults[0].analysis.metaPattern}
                                        </div>
                                    </div>
                                )}

                                {/* Interpretation Note */}
                                <div className="mt-2 p-2 bg-blue-100 rounded border border-blue-200">
                                    <p className="text-[10px] text-blue-900 text-center">
                                        <strong>Interpretation note:</strong> {similarityResults[0].analysis.userFacingContext.interpretationNote}
                                    </p>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="mt-3 text-xs h-7 text-blue-700 hover:text-blue-800 hover:bg-blue-100 w-full"
                                    onClick={() => setSimilarityResults([])}
                                >
                                    Dismiss Field Note
                                </Button>
                            </div>
                        )}

                        {errors.length > 0 && (
                            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
                                <ul className="list-disc pl-5">
                                    {errors.map((error, i) => (
                                        <li key={i}>
                                            <strong>{error.field}:</strong> {error.message}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* AI Assistance Panel */}
                        <AIAssistancePanel
                            finding={{
                                findingType,
                                title,
                                severity,
                                description,
                                impact,
                                remediation,
                                status,
                                category,
                                affectedAssets: affectedAssets.split('\n').filter(a => a.trim()),
                            }}
                            engagementId={engagementId}
                            applicationId={applicationId}
                            clientId={clientId}
                            onApplySuggestion={(field, value) => {
                                if (field === 'description') setDescription(value);
                                if (field === 'stepsToReproduce') setStepsToReproduce(value);
                                if (field === 'remediation') setRemediation(value);
                                if (field === 'intelligence') {
                                    if (value.predictedSeverity) setSeverity(value.predictedSeverity);
                                    if (value.owaspMapping) setOwaspCategories(value.owaspMapping);
                                    if (value.cweMapping) setCweIds(value.cweMapping);
                                    if (value.tags && value.tags.length > 0) {
                                        // Append tags to description if needed, or handle separately
                                        // For now, let's just use them for categorization if there was a tags field
                                    }
                                    if (value.riskContext) {
                                        setImpact((prev) => {
                                            const contextStr = `\n\nAI Risk Context: ${value.riskContext}`;
                                            return prev.includes(value.riskContext) ? prev : prev + contextStr;
                                        });
                                    }
                                }
                            }}
                        />

                        {/* Finding Type Selector */}
                        <div>
                            <Label>Finding Type *</Label>
                            <Select value={findingType} onValueChange={(v) => setFindingType(v as Finding['findingType'])}>
                                <SelectTrigger className="mt-2 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="penetration">Penetration Testing</SelectItem>
                                    <SelectItem value="infrastructure">Infrastructure/Cloud/Network</SelectItem>
                                    <SelectItem value="threat-model">Threat Modeling</SelectItem>
                                    <SelectItem value="architecture">Architecture Review</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Common Fields */}
                        <div>
                            <Label>Title *</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g., SQL Injection in Login Form"
                                    className="mt-2"
                                />
                                <Button
                                    variant="outline"
                                    className="mt-2"
                                    disabled={isCheckingSimilarity}
                                    onClick={handleCheckSimilarity}
                                >
                                    {isCheckingSimilarity ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Checking...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="mr-2 h-4 w-4" />
                                            Check Similarity
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        <div>
                            <Label>Severity *</Label>
                            <Select value={severity} onValueChange={(v) => setSeverity(v as SeverityLevel)}>
                                <SelectTrigger className="mt-2 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {SEVERITY_LEVELS.map((sev) => (
                                        <SelectItem key={sev} value={sev}>
                                            {sev}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Discovered By</Label>
                            <Select
                                value={discoveredBy}
                                onValueChange={setDiscoveredBy}
                            >
                                <SelectTrigger className="mt-2 w-full">
                                    <SelectValue placeholder="Select engineer (optional)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">-- Unassigned --</SelectItem>
                                    {engineers.map((eng) => (
                                        <SelectItem key={eng.id} value={eng.id}>
                                            {eng.name} - {eng.role}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>



                        {/* Component Selection - NEW */}
                        {/* Component Selection - REFINED */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Affected Components (Registry)</Label>
                                <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                                    {availableComponents.length} available
                                </Badge>
                            </div>

                            {availableComponents.length === 0 ? (
                                <div className="text-sm text-muted-foreground mt-2 border border-dashed rounded-md p-4 bg-slate-50 dark:bg-slate-900/50 text-center dark:border-slate-800">
                                    <p className="mb-2">No components registered for this application yet.</p>
                                    <p className="text-xs">They will be auto-extracted from your description, or you can add one manually below.</p>
                                </div>
                            ) : (
                                <div className="border rounded-md max-h-48 overflow-y-auto bg-white dark:bg-slate-950 shadow-sm dark:border-slate-800">
                                    {availableComponents.map(comp => (
                                        <div
                                            key={comp.id}
                                            className={`flex items-center gap-3 p-2 border-b dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${selectedComponentIds.includes(comp.id) ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                id={`comp-${comp.id}`}
                                                checked={selectedComponentIds.includes(comp.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedComponentIds([...selectedComponentIds, comp.id]);
                                                    } else {
                                                        setSelectedComponentIds(selectedComponentIds.filter(id => id !== comp.id));
                                                    }
                                                }}
                                                className="h-4 w-4 rounded border-gray-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 dark:bg-slate-950 cursor-pointer"
                                            />
                                            <label htmlFor={`comp-${comp.id}`} className="flex-1 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none flex items-center justify-between">
                                                <span>{comp.name}</span>
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">{comp.type}</Badge>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Inline Component Creation */}
                            <div className="flex gap-2 items-end pt-1">
                                <div className="flex-1">
                                    <Label className="text-xs text-muted-foreground font-normal mb-1.5 block">Manually Add New Component</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="e.g. Payment Gateway"
                                            className="h-8 text-sm"
                                            value={newComponentName}
                                            onChange={(e) => setNewComponentName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleCreateComponent();
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8"
                                            onClick={handleCreateComponent}
                                            disabled={!newComponentName.trim()}
                                        >
                                            <Plus className="h-3 w-3 mr-1.5" />
                                            Add
                                        </Button>
                                        <Select value={newComponentType} onValueChange={(v) => setNewComponentType(v as any)}>
                                            <SelectTrigger className="h-8 w-[130px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="service">Service</SelectItem>
                                                <SelectItem value="endpoint">Endpoint</SelectItem>
                                                <SelectItem value="library">Library</SelectItem>
                                                <SelectItem value="infrastructure">Infrastructure</SelectItem>
                                                <SelectItem value="database">Database</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <Label>Description *</Label>
                            <MarkdownEditor
                                value={description}
                                onChange={setDescription}
                                placeholder="Detailed description..."
                                minHeight="200px"
                                context={aiContext}
                                contextData={contextData}
                            />
                        </div>

                        <div>
                            <Label>Impact *</Label>
                            <MarkdownEditor
                                value={impact}
                                onChange={setImpact}
                                placeholder="Potential impact if exploited..."
                                minHeight="150px"
                                context={aiContext}
                                contextData={contextData}
                            />
                        </div>

                        {/* Penetration Testing Fields */}
                        {(findingType === 'penetration' || findingType === 'infrastructure') && (
                            <>
                                <div>
                                    <Label>Category *</Label>
                                    <Select value={category} onValueChange={setCategory}>
                                        <SelectTrigger className="mt-2 w-full">
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {FINDING_CATEGORIES.map((cat) => (
                                                <SelectItem key={cat} value={cat}>
                                                    {cat}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>CVSS Base Score</Label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="10"
                                            value={cvssScore}
                                            onChange={(e) => setCvssScore(e.target.value)}
                                            placeholder="e.g., 7.5"
                                            className="mt-2"
                                        />
                                    </div>
                                    <div>
                                        <Label>Attack Surface</Label>
                                        <Select value={attackSurface} onValueChange={setAttackSurface}>
                                            <SelectTrigger className="mt-2 w-full">
                                                <SelectValue placeholder="Select attack surface" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ATTACK_SURFACES.map((surface) => (
                                                    <SelectItem key={surface} value={surface}>
                                                        {surface}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <Label>Affected Assets (one per line) *</Label>
                                    <Textarea
                                        value={affectedAssets}
                                        onChange={(e) => setAffectedAssets(e.target.value)}
                                        placeholder="https://example.com/login&#10;/api/users"
                                        className="mt-2"
                                        rows={3}
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="authRequired"
                                        checked={authRequired}
                                        onChange={(e) => setAuthRequired(e.target.checked)}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor="authRequired">Authentication Required *</Label>
                                </div>

                                <div>
                                    <Label>Steps to Reproduce *</Label>
                                    <MarkdownEditor
                                        value={stepsToReproduce}
                                        onChange={setStepsToReproduce}
                                        placeholder="1. Navigate to...&#10;2. Enter payload...&#10;3. Observe..."
                                        minHeight="300px"
                                        context={aiContext}
                                        contextData={contextData}
                                    />
                                </div>

                                <div>
                                    <Label>Proof of Concept</Label>
                                    <MarkdownEditor
                                        value={proofOfConcept}
                                        onChange={setProofOfConcept}
                                        placeholder="Code or commands demonstrating the vulnerability..."
                                        minHeight="200px"
                                        context={aiContext}
                                        contextData={contextData}
                                    />
                                </div>

                                <div>
                                    <Label>Evidence (Images/Files)</Label>
                                    <div className="mt-2">
                                        <EvidenceUpload
                                            files={evidenceFiles}
                                            onChange={setEvidenceFiles}
                                            maxFiles={5}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Infrastructure-Specific Fields */}
                        {findingType === 'infrastructure' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Asset Type</Label>
                                        <Select value={assetType} onValueChange={setAssetType}>
                                            <SelectTrigger className="mt-2 w-full">
                                                <SelectValue placeholder="Select asset type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ASSET_TYPES.map((type) => (
                                                    <SelectItem key={type} value={type}>
                                                        {type}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Cloud Provider</Label>
                                        <Select value={cloudProvider} onValueChange={setCloudProvider}>
                                            <SelectTrigger className="mt-2 w-full">
                                                <SelectValue placeholder="Select provider" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {CLOUD_PROVIDERS.map((provider) => (
                                                    <SelectItem key={provider} value={provider}>
                                                        {provider}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div>
                                    <Label>Misconfiguration Details</Label>
                                    <MarkdownEditor
                                        value={misconfigurationDetails}
                                        onChange={setMisconfigurationDetails}
                                        placeholder="Details about the misconfiguration..."
                                        minHeight="150px"
                                        context={aiContext}
                                        contextData={contextData}
                                    />
                                </div>

                                <div>
                                    <Label>Blast Radius</Label>
                                    <Input
                                        value={blastRadius}
                                        onChange={(e) => setBlastRadius(e.target.value)}
                                        placeholder="e.g., Entire VPC, Single account, Cross-account"
                                        className="mt-2"
                                    />
                                </div>
                            </>
                        )}

                        {/* Threat Modeling Fields */}
                        {findingType === 'threat-model' && (
                            <>
                                <div>
                                    <Label>STRIDE Threat Category *</Label>
                                    <Select value={threatCategory} onValueChange={setThreatCategory}>
                                        <SelectTrigger className="mt-2 w-full">
                                            <SelectValue placeholder="Select STRIDE category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {STRIDE_CATEGORIES.map((cat) => (
                                                <SelectItem key={cat} value={cat}>
                                                    {cat}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Affected Component *</Label>
                                    <Input
                                        value={affectedComponent}
                                        onChange={(e) => setAffectedComponent(e.target.value)}
                                        placeholder="e.g., Authentication Service, User Database"
                                        className="mt-2"
                                    />
                                </div>

                                <div>
                                    <Label>Attack Scenario *</Label>
                                    <Textarea
                                        value={attackScenario}
                                        onChange={(e) => setAttackScenario(e.target.value)}
                                        placeholder="Describe the attack scenario..."
                                        className="mt-2"
                                        rows={4}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Likelihood *</Label>
                                        <Select value={likelihood} onValueChange={setLikelihood}>
                                            <SelectTrigger className="mt-2 w-full">
                                                <SelectValue placeholder="Select likelihood" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {LIKELIHOOD_LEVELS.map((level) => (
                                                    <SelectItem key={level} value={level}>
                                                        {level}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Risk Rating *</Label>
                                        <Input
                                            value={riskRating}
                                            onChange={(e) => setRiskRating(e.target.value)}
                                            placeholder="e.g., High, Medium-High"
                                            className="mt-2"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <Label>Existing Controls (one per line) *</Label>
                                    <Textarea
                                        value={existingControls}
                                        onChange={(e) => setExistingControls(e.target.value)}
                                        placeholder="List existing security controls (use 'None' if none exist)"
                                        className="mt-2"
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <Label>Recommended Mitigations (one per line) *</Label>
                                    <Textarea
                                        value={recommendedMitigations}
                                        onChange={(e) => setRecommendedMitigations(e.target.value)}
                                        placeholder="List recommended mitigations..."
                                        className="mt-2"
                                        rows={4}
                                    />
                                </div>

                                <div>
                                    <Label>Residual Risk</Label>
                                    <Textarea
                                        value={residualRisk}
                                        onChange={(e) => setResidualRisk(e.target.value)}
                                        placeholder="Risk remaining after mitigations..."
                                        className="mt-2"
                                        rows={2}
                                    />
                                </div>
                            </>
                        )}

                        {/* Architecture Review Fields */}
                        {findingType === 'architecture' && (
                            <>
                                <div>
                                    <Label>Design Component *</Label>
                                    <Input
                                        value={designComponent}
                                        onChange={(e) => setDesignComponent(e.target.value)}
                                        placeholder="e.g., API Gateway, Database Layer"
                                        className="mt-2"
                                    />
                                </div>

                                <div>
                                    <Label>Architecture Concern Category *</Label>
                                    <Select value={concernCategory} onValueChange={setConcernCategory}>
                                        <SelectTrigger className="mt-2 w-full">
                                            <SelectValue placeholder="Select concern category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ARCHITECTURE_CONCERNS.map((concern) => (
                                                <SelectItem key={concern} value={concern}>
                                                    {concern}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label>Current Design *</Label>
                                    <Textarea
                                        value={currentDesign}
                                        onChange={(e) => setCurrentDesign(e.target.value)}
                                        placeholder="Describe the current design..."
                                        className="mt-2"
                                        rows={4}
                                    />
                                </div>

                                <div>
                                    <Label>Risk Assessment *</Label>
                                    <Textarea
                                        value={riskAssessment}
                                        onChange={(e) => setRiskAssessment(e.target.value)}
                                        placeholder="Assess the risks of the current design..."
                                        className="mt-2"
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <Label>Recommended Design Changes *</Label>
                                    <Textarea
                                        value={recommendedDesignChanges}
                                        onChange={(e) => setRecommendedDesignChanges(e.target.value)}
                                        placeholder="Recommended changes to the design..."
                                        className="mt-2"
                                        rows={4}
                                    />
                                </div>

                                <div>
                                    <Label>Implementation Priority *</Label>
                                    <Select
                                        value={implementationPriority}
                                        onValueChange={(v) => setImplementationPriority(v as any)}
                                    >
                                        <SelectTrigger className="mt-2 w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Critical">Critical</SelectItem>
                                            <SelectItem value="High">High</SelectItem>
                                            <SelectItem value="Medium">Medium</SelectItem>
                                            <SelectItem value="Low">Low</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

                        {/* Remediation (common to all) */}
                        <div>
                            <Label>Remediation *</Label>
                            <MarkdownEditor
                                value={remediation}
                                onChange={setRemediation}
                                placeholder="Recommended steps to fix this issue..."
                                minHeight="200px"
                                context={aiContext}
                                contextData={contextData}
                            />
                        </div>

                        {/* Status (common to all) */}
                        <div>
                            <Label>Status</Label>
                            <Select value={status} onValueChange={(v) => setStatus(v as FindingStatus)}>
                                <SelectTrigger className="mt-2 w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Open">Open</SelectItem>
                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                    <SelectItem value="Resolved">Resolved</SelectItem>
                                    <SelectItem value="Accepted Risk">Accepted Risk</SelectItem>
                                    <SelectItem value="False Positive">False Positive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Remediation Tracking - Only show for existing findings */}
                        {finding && finding.id && (
                            <>
                                <div className="border-t border-slate-200 dark:border-slate-700 my-6" />

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                                <HistoryIcon className="h-5 w-5" />
                                                Remediation Tracking
                                            </h3>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Track fix attempts, verification status, and AI-powered suggestions
                                            </p>
                                        </div>
                                    </div>

                                    <RemediationHistoryPanel
                                        finding={finding}
                                        clientId={clientId}
                                        showSuggestions={true}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>Save Finding</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {selectedRemediationEvent && (
                <VerifyRemediationDialog
                    open={verifyDialogOpen}
                    onOpenChange={setVerifyDialogOpen}
                    remediationEvent={selectedRemediationEvent}
                    engagementId={engagementId}
                    verifiedBy={currentEngineerId}
                    onSuccess={() => {
                        setVerifyDialogOpen(false);
                        setSelectedRemediationEvent(null);
                    }}
                />
            )}
        </>
    );
}
