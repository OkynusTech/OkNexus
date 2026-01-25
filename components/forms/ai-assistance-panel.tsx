import React, { useState } from 'react';
import { Sparkles, AlertCircle, Loader2, ChevronDown, ChevronUp, Tag, ShieldCheck, Info } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AIAssistant, AISuggestion } from '@/lib/ai-assistance';
import { Finding } from '@/lib/types';

interface AIAssistancePanelProps {
    finding: Partial<Finding>;
    engagementId: string;
    applicationId: string;
    clientId: string;
    onApplySuggestion: (field: string, value: any) => void;
}

export function AIAssistancePanel({
    finding,
    engagementId,
    applicationId,
    clientId,
    onApplySuggestion,
}: AIAssistancePanelProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
    const [intelligence, setIntelligence] = useState<any>(null);
    const [showExplanation, setShowExplanation] = useState(false);







    const handleAnalyzeIntelligence = async () => {
        setLoading('intelligence');
        try {
            const result = await AIAssistant.analyzeIntelligence(
                finding as Finding,
                clientId
            );
            setIntelligence(result);
            setSuggestion(null); // Clear other suggestions when showing intelligence
        } catch (error) {
            console.error('AI intelligence error:', error);
        } finally {
            setLoading(null);
        }
    };

    const handleApply = (field: string) => {
        if (suggestion) {
            onApplySuggestion(field, suggestion.content);
            setSuggestion(null);
        }
    };

    if (!isExpanded) {
        return (
            <Card className="p-4 border-purple-600 bg-purple-600/5 cursor-pointer hover:bg-purple-600/10 transition-colors" onClick={() => setIsExpanded(true)}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-purple-600" />
                        <h3 className="font-semibold text-purple-600">AI Assistance (Beta)</h3>
                    </div>
                    <ChevronDown className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                    Click to expand AI-powered drafting assistance
                </p>
            </Card>
        );
    }

    return (
        <Card className="p-4 border-purple-600 bg-purple-600/5">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <h3 className="font-semibold text-purple-600">AI Assistance (Beta)</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
                    <ChevronUp className="h-4 w-4" />
                </Button>
            </div>

            {/* Warning/Info */}
            <div className="mb-4 p-3 bg-background border rounded-md">
                <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5" />
                    <div className="text-xs text-gray-700">
                        <p className="font-medium text-foreground mb-1">Context-Only AI Assistance</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Uses only application knowledge artifacts and historical findings</li>
                            <li>All suggestions are drafts requiring your review</li>
                            <li>Sources will be cited when available</li>
                            <li>Never auto-submits - you have full control</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 mb-4">
                <Button
                    variant="default"
                    className="w-full justify-start bg-purple-600 hover:bg-purple-700 text-white"
                    onClick={handleAnalyzeIntelligence}
                    disabled={loading !== null || !finding.title}
                >
                    {loading === 'intelligence' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Analyze Finding Intelligence
                </Button>
            </div>

            {/* Suggestion Display */}
            {suggestion && (
                <div className="p-3 bg-background border rounded-md">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-purple-600 uppercase">AI-Generated Draft</span>
                        <span className={`text-xs px-2 py-1 rounded ${suggestion.confidence === 'high' ? 'bg-green-600/10 text-green-600' :
                            suggestion.confidence === 'medium' ? 'bg-orange-600/10 text-orange-600' :
                                'bg-gray-600/10 text-gray-600'
                            }`}>
                            {suggestion.confidence} confidence
                        </span>
                    </div>

                    <div className="text-sm whitespace-pre-wrap mb-3 p-2 bg-muted rounded">
                        {suggestion.content}
                    </div>

                    {/* Sources */}
                    {suggestion.sources.length > 0 && (
                        <div className="mb-3 text-xs">
                            <p className="font-medium mb-1">Sources used:</p>
                            <ul className="list-disc pl-4 text-gray-700">
                                {suggestion.sources.map((source: any, idx: number) => (
                                    <li key={idx}>{source.artifactName} ({source.artifactType.replace(/-/g, ' ')})</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Explanation */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs mb-2"
                        onClick={() => setShowExplanation(!showExplanation)}
                    >
                        {showExplanation ? 'Hide' : 'Show'} Explanation
                    </Button>

                    {showExplanation && (
                        <div className="text-xs text-gray-700 p-2 bg-muted rounded mb-3 whitespace-pre-wrap">
                            {AIAssistant.explainSuggestion(suggestion)}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            onClick={() => handleApply(loading === 'description' ? 'description' : loading === 'steps' ? 'stepsToReproduce' : 'remediation')}
                        >
                            Apply to Field
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSuggestion(null)}
                        >
                            Discard
                        </Button>
                    </div>
                </div>
            )}

            {/* Intelligence Display */}
            {intelligence && (
                <div className="p-3 bg-background border rounded-md border-purple-200">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-purple-600 uppercase flex items-center">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            AI Intelligence Analysis
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600">Confidence: {Math.round(intelligence.confidence * 100)}%</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-2 bg-muted rounded">
                            <Label className="text-[10px] text-gray-600 uppercase">Predicted Severity</Label>
                            <div className="text-sm font-bold mt-1">{intelligence.predictedSeverity}</div>
                        </div>
                        <div className="p-2 bg-muted rounded">
                            <Label className="text-[10px] text-gray-600 uppercase">Compliance Mapping</Label>
                            <div className="text-[10px] font-medium mt-1">
                                <div>OWASP: {intelligence.owaspMapping}</div>
                                <div>CWE: {intelligence.cweMapping}</div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <Label className="text-[10px] text-gray-600 uppercase flex items-center mb-1">
                            <Tag className="h-3 w-3 mr-1" />
                            Security Tags
                        </Label>
                        <div className="flex flex-wrap gap-1">
                            {intelligence.tags.map((tag: string) => (
                                <span key={tag} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className="mb-4 p-2 bg-blue-50 border border-blue-100 rounded">
                        <Label className="text-[10px] text-blue-700 uppercase flex items-center mb-1">
                            <Info className="h-3 w-3 mr-1" />
                            Risk Context
                        </Label>
                        <p className="text-xs text-blue-900 leading-relaxed italic">
                            "{intelligence.riskContext}"
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={() => {
                                onApplySuggestion('intelligence', intelligence);
                                setIntelligence(null);
                            }}
                        >
                            Apply All Metrics
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setIntelligence(null)}
                        >
                            Discard
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
