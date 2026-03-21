/**
 * Template Editor Component
 *
 * Provides UI for editing template properties:
 * - Basic info (name, description)
 * - Section configuration (order, visibility)
 * - Brand Kit (colors, typography, logos, cover image, feature toggles)
 * - Visual style
 *
 * This is a FORM component - no preview logic.
 * Preview happens in TemplatePreviewer.
 */

'use client';

import { useState } from 'react';
import { ReportTemplate, ReportSection, BrandingConfig, VisualStyleConfig } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TemplateEditorProps {
    template: ReportTemplate;
    onChange: (updated: ReportTemplate) => void;
}

export function TemplateEditor({ template, onChange }: TemplateEditorProps) {
    const [activeTab, setActiveTab] = useState<'basic' | 'sections' | 'branding' | 'style'>('basic');

    const handleBasicChange = (field: keyof ReportTemplate, value: any) => {
        onChange({ ...template, [field]: value });
    };

    const handleSectionsChange = (sections: ReportSection[]) => {
        onChange({ ...template, sections });
    };

    const handleBrandingChange = (branding: BrandingConfig) => {
        onChange({ ...template, branding });
    };

    return (
        <div className="template-editor space-y-6">
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b pb-2">
                {[
                    { id: 'basic', label: 'Basic Info' },
                    { id: 'sections', label: 'Sections' },
                    { id: 'branding', label: 'Brand Kit' },
                    { id: 'style', label: 'Visual Style' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
                            activeTab === tab.id
                                ? 'bg-card text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:text-foreground'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'basic' && (
                <BasicInfoEditor template={template} onChange={handleBasicChange} />
            )}
            {activeTab === 'sections' && (
                <SectionEditor sections={template.sections} onChange={handleSectionsChange} />
            )}
            {activeTab === 'branding' && (
                <BrandingEditor branding={template.branding} onChange={handleBrandingChange} />
            )}
            {activeTab === 'style' && (
                <VisualStyleEditor template={template} onChange={handleBasicChange} />
            )}
        </div>
    );
}

/**
 * Basic Info Editor
 */
function BasicInfoEditor({
    template,
    onChange
}: {
    template: ReportTemplate;
    onChange: (field: keyof ReportTemplate, value: any) => void;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Template Information</CardTitle>
                <CardDescription>Basic details about this template</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                        id="name"
                        value={template.name}
                        onChange={(e) => onChange('name', e.target.value)}
                        placeholder="e.g., Enterprise Security Report"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        value={template.description}
                        onChange={(e) => onChange('description', e.target.value)}
                        placeholder="Brief description of when to use this template"
                        rows={3}
                    />
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="technical">Technical Verbosity</Label>
                        <select
                            id="technical"
                            value={template.technicalVerbosity}
                            onChange={(e) => onChange('technicalVerbosity', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="business">Business Language</Label>
                        <select
                            id="business"
                            value={template.businessLanguageLevel}
                            onChange={(e) => onChange('businessLanguageLevel', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="strictness">Strictness</Label>
                        <select
                            id="strictness"
                            value={template.strictnessLevel}
                            onChange={(e) => onChange('strictnessLevel', e.target.value as any)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="standard">Standard</option>
                            <option value="flexible">Flexible</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-6 pt-4">
                    <label className="flex items-center gap-2">
                        <Switch
                            checked={template.includeCVSS}
                            onCheckedChange={(checked) => onChange('includeCVSS', checked)}
                        />
                        <span className="text-sm font-medium">Include CVSS Scores</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <Switch
                            checked={template.includeCWE}
                            onCheckedChange={(checked) => onChange('includeCWE', checked)}
                        />
                        <span className="text-sm font-medium">Include CWE IDs</span>
                    </label>

                    <label className="flex items-center gap-2">
                        <Switch
                            checked={template.includeOWASP}
                            onCheckedChange={(checked) => onChange('includeOWASP', checked)}
                        />
                        <span className="text-sm font-medium">Include OWASP Categories</span>
                    </label>
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Section Editor - Reorder and toggle visibility
 */
function SectionEditor({
    sections,
    onChange
}: {
    sections: ReportSection[];
    onChange: (sections: ReportSection[]) => void;
}) {
    const toggleVisibility = (index: number) => {
        const updated = [...sections];
        updated[index] = { ...updated[index], isVisible: !updated[index].isVisible };
        onChange(updated);
    };

    const moveSection = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === sections.length - 1) return;

        const updated = [...sections];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
        onChange(updated);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Report Sections</CardTitle>
                <CardDescription>
                    Control which sections appear in reports and their order
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {sections.map((section, index) => (
                        <div
                            key={section.id}
                            className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border',
                                section.isVisible ? 'bg-card' : 'bg-muted/50'
                            )}
                        >
                            <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

                            <div className="flex-1">
                                <p className={cn(
                                    'text-sm font-medium',
                                    section.isVisible ? 'text-foreground' : 'text-muted-foreground'
                                )}>
                                    {section.title}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {section.type === 'standard' ? 'Standard Section' : 'Custom Section'}
                                    {section.isLocked && ' • Locked'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => moveSection(index, 'up')}
                                    disabled={index === 0}
                                    title="Move Up"
                                >
                                    ↑
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => moveSection(index, 'down')}
                                    disabled={index === sections.length - 1}
                                    title="Move Down"
                                >
                                    ↓
                                </Button>
                                <Button
                                    variant={section.isVisible ? "default" : "outline"}
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => toggleVisibility(index)}
                                    disabled={section.isLocked}
                                    title={section.isVisible ? "Hide Section" : "Show Section"}
                                >
                                    {section.isVisible ? (
                                        <Eye className="h-4 w-4" />
                                    ) : (
                                        <EyeOff className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}

/**
 * Branding Editor — Full Brand Kit
 */
function BrandingEditor({
    branding,
    onChange
}: {
    branding?: BrandingConfig;
    onChange: (branding: BrandingConfig) => void;
}) {
    const config = branding || {};
    const [newColor, setNewColor] = useState(config.primaryColor || '#000000');
    const [newFont, setNewFont] = useState('');
    const [bTab, setBTab] = useState<'colors' | 'typography' | 'logos' | 'toggles'>('colors');
    const [imageTab, setImageTab] = useState<'logos' | 'cover'>('logos');

    const handle = (field: keyof BrandingConfig, value: any) =>
        onChange({ ...config, [field]: value });

    // Derive the working color scheme
    const colorScheme: string[] = config.colorScheme && config.colorScheme.length > 0
        ? config.colorScheme
        : [
            config.primaryColor,
            config.secondaryColor,
            config.accentColor,
        ].filter((c): c is string => Boolean(c));

    const updateColorScheme = (updated: string[]) => {
        onChange({
            ...config,
            colorScheme: updated,
            primaryColor: updated[0],
            secondaryColor: updated[1],
            accentColor: updated[2],
        });
    };

    const addColor = () => {
        if (!newColor) return;
        updateColorScheme([...colorScheme, newColor]);
    };

    const removeColor = (idx: number) => {
        updateColorScheme(colorScheme.filter((_, i) => i !== idx));
    };

    // Font management
    const brandFonts = config.brandFonts || [];
    const addFont = () => {
        if (!newFont.trim()) return;
        const updated = [...brandFonts, newFont.trim()];
        onChange({
            ...config,
            brandFonts: updated,
            primaryFont: updated[0],
            secondaryFont: updated[1],
        });
        setNewFont('');
        // Lazy-load from Google Fonts
        const safeFont = newFont.trim().replace(/\s+/g, '+');
        const linkId = `gfont-${safeFont}`;
        if (typeof document !== 'undefined' && !document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${safeFont}:wght@400;600;700&display=swap`;
            document.head.appendChild(link);
        }
    };
    const removeFont = (idx: number) => {
        const updated = brandFonts.filter((_, i) => i !== idx);
        onChange({ ...config, brandFonts: updated, primaryFont: updated[0], secondaryFont: updated[1] });
    };

    const brandTabs = [
        { id: 'colors', label: 'Colors' },
        { id: 'typography', label: 'Fonts' },
        { id: 'logos', label: 'Images' },
        { id: 'toggles', label: 'Features' },
    ] as const;

    const QUICK_PALETTES = [
        { name: 'Navy & Sky', colors: ['#1e3a5f', '#0ea5e9', '#f59e0b', '#16a34a', '#dc2626'] },
        { name: 'Midnight', colors: ['#0f0f1a', '#7c3aed', '#a855f7', '#1e293b', '#e2e8f0'] },
        { name: 'Crimson Pro', colors: ['#1a1a2e', '#dc2626', '#ef4444', '#6b7280', '#f9fafb'] },
        { name: 'Forest', colors: ['#052e16', '#16a34a', '#4ade80', '#ca8a04', '#f5f5f4'] },
        { name: 'Neon Dark', colors: ['#0a0a0f', '#39ff14', '#00e5ff', '#ff0090', '#1a1a2e'] },
        { name: 'Slate Pro', colors: ['#0f172a', '#3b82f6', '#60a5fa', '#475569', '#f8fafc'] },
    ];

    const FONT_SUGGESTIONS = [
        'Inter', 'Roboto', 'Poppins', 'Outfit', 'DM Sans', 'IBM Plex Sans',
        'Georgia', 'Playfair Display', 'Merriweather', 'Roboto Mono', 'Space Grotesk'
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>Brand Kit</CardTitle>
                <CardDescription>
                    Define your full brand identity — colors, fonts, logos, and layout features
                </CardDescription>
            </CardHeader>
            <CardContent>
                {/* Sub-tabs */}
                <div className="flex gap-1 border-b mb-6 overflow-x-auto">
                    {brandTabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setBTab(t.id)}
                            className={cn(
                                'px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors rounded-t',
                                bTab === t.id
                                    ? 'bg-muted text-foreground border-b-2 border-primary'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >{t.label}
                        </button>
                    ))}
                </div>

                {/* ── COLORS ── */}
                {bTab === 'colors' && (
                    <div className="space-y-6">
                        <p className="text-xs text-muted-foreground">
                            Build your brand color palette. The first 3 colors map to <strong>primary</strong>, <strong>secondary</strong>, and <strong>accent</strong> automatically.
                        </p>

                        {/* Swatch grid */}
                        {colorScheme.length > 0 && (
                            <div className="grid grid-cols-5 gap-3">
                                {colorScheme.map((hex, idx) => (
                                    <div key={idx} className="group relative flex flex-col items-center gap-1">
                                        <div
                                            className="w-full h-11 rounded-lg border-2 border-muted shadow-sm transition-all cursor-default"
                                            style={{ backgroundColor: hex }}
                                        />
                                        <p className="text-[9px] font-mono text-muted-foreground truncate max-w-full">{hex}</p>
                                        {idx === 0 && <span className="text-[8px] text-primary font-bold uppercase tracking-wide">Primary</span>}
                                        {idx === 1 && <span className="text-[8px] text-sky-500 font-bold uppercase tracking-wide">Second.</span>}
                                        {idx === 2 && <span className="text-[8px] text-amber-500 font-bold uppercase tracking-wide">Accent</span>}
                                        <button
                                            onClick={() => removeColor(idx)}
                                            className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-bold"
                                        >×</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add color row */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                            <input
                                type="color"
                                value={newColor}
                                onChange={e => setNewColor(e.target.value)}
                                className="w-10 h-10 rounded cursor-pointer border border-input shrink-0"
                            />
                            <Input
                                value={newColor}
                                onChange={e => setNewColor(e.target.value)}
                                className="font-mono text-xs h-9 w-28"
                                placeholder="#hex"
                            />
                            <Button size="sm" variant="outline" onClick={addColor}>+ Add</Button>
                        </div>

                        {/* Quick preset palettes */}
                        <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs">Quick Brand Palettes</Label>
                            <div className="flex flex-wrap gap-2">
                                {QUICK_PALETTES.map(palette => (
                                    <button
                                        key={palette.name}
                                        onClick={() => updateColorScheme(palette.colors)}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs hover:bg-muted transition-colors"
                                    >
                                        <span className="flex gap-0.5">
                                            {palette.colors.slice(0, 3).map((c, i) => (
                                                <span key={i} className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                                            ))}
                                        </span>
                                        {palette.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── TYPOGRAPHY ── */}
                {bTab === 'typography' && (
                    <div className="space-y-5">
                        <p className="text-xs text-muted-foreground">
                            Select Google Fonts for your report. The first font is used for <strong>headings</strong>, the second for <strong>body text</strong>.
                        </p>

                        {brandFonts.length > 0 && (
                            <div className="space-y-2">
                                {brandFonts.map((font, idx) => (
                                    <div key={idx} className="flex items-center gap-3 group p-3 rounded-lg border">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium" style={{ fontFamily: font }}>{font}</p>
                                            <p className="text-xs text-muted-foreground" style={{ fontFamily: font }}>The quick brown fox jumps over the lazy dog</p>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wide shrink-0 text-muted-foreground">
                                            {idx === 0 ? 'Heading' : idx === 1 ? 'Body' : `Font ${idx + 1}`}
                                        </span>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive shrink-0" onClick={() => removeFont(idx)}>×</Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 items-center">
                            <Input
                                value={newFont}
                                onChange={e => setNewFont(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && addFont()}
                                placeholder="Google Font name (e.g. Inter)"
                                className="text-sm h-9"
                            />
                            <Button size="sm" variant="outline" onClick={addFont}>Add Font</Button>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Font Suggestions</Label>
                            <div className="flex flex-wrap gap-2">
                                {FONT_SUGGESTIONS.map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setNewFont(f)}
                                        className="px-2.5 py-1.5 text-xs border rounded-full hover:bg-muted transition-colors"
                                        style={{ fontFamily: f }}
                                    >{f}</button>
                                ))}
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Click a suggestion to autofill, then click <strong>Add Font</strong>. Fonts are automatically loaded from Google Fonts.</p>
                    </div>
                )}

                {/* ── IMAGES / LOGOS ── */}
                {bTab === 'logos' && (
                    <div className="space-y-5">
                        <div className="flex gap-1 border-b pb-2 mb-4">
                            {(['logos', 'cover'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setImageTab(t)}
                                    className={cn(
                                        'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                                        imageTab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >{t === 'logos' ? 'Logos' : 'Cover Image'}</button>
                            ))}
                        </div>

                        {imageTab === 'logos' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="providerLogo">Your Firm Logo URL</Label>
                                        <Input id="providerLogo" value={config.providerLogoUrl || ''} onChange={e => handle('providerLogoUrl', e.target.value)} placeholder="https://..." />
                                        {config.providerLogoUrl && (
                                            <div className="h-12 border rounded p-1">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={config.providerLogoUrl} alt="Provider Logo" className="h-full object-contain" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="clientLogo">Client Logo URL</Label>
                                        <Input id="clientLogo" value={config.clientLogoUrl || ''} onChange={e => handle('clientLogoUrl', e.target.value)} placeholder="https://..." />
                                        {config.clientLogoUrl && (
                                            <div className="h-12 border rounded p-1">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={config.clientLogoUrl} alt="Client Logo" className="h-full object-contain" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="logoPlacement">Logo Placement</Label>
                                    <select
                                        id="logoPlacement"
                                        value={config.logoPlacement || 'cover'}
                                        onChange={e => handle('logoPlacement', e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    >
                                        <option value="cover">Cover Page Only</option>
                                        <option value="header">Every Page Header</option>
                                        <option value="footer">Every Page Footer</option>
                                        <option value="cover-and-header">Cover + Page Headers</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {imageTab === 'cover' && (
                            <div className="space-y-4">
                                <p className="text-xs text-muted-foreground">Provide a URL (or base64 data URL) for a full-bleed cover page background image. Dimensions of 1200×800px at 96 DPI work best.</p>
                                <div className="space-y-2">
                                    <Label htmlFor="coverBg">Cover Background Image URL</Label>
                                    <Input id="coverBg" value={config.coverBackgroundImageUrl || ''} onChange={e => handle('coverBackgroundImageUrl', e.target.value)} placeholder="https://... or data:image/..." />
                                </div>
                                {config.coverBackgroundImageUrl && (
                                    <div className="border rounded-lg overflow-hidden h-36">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={config.coverBackgroundImageUrl} alt="Cover Background" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="coverTitle">Cover Title Override</Label>
                                        <Input id="coverTitle" value={config.coverSettings?.title || ''} onChange={e => handle('coverSettings', { ...config.coverSettings, title: e.target.value })} placeholder="Security Assessment Report" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="coverSub">Cover Subtitle Override</Label>
                                        <Input id="coverSub" value={config.coverSettings?.subtitle || ''} onChange={e => handle('coverSettings', { ...config.coverSettings, subtitle: e.target.value })} placeholder="Prepared for: Acme Corp" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="coverFooter">Cover Footer Text</Label>
                                    <Input id="coverFooter" value={config.coverSettings?.footerText || ''} onChange={e => handle('coverSettings', { ...config.coverSettings, footerText: e.target.value })} placeholder="Confidential — For internal use only" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── FEATURE TOGGLES ── */}
                {bTab === 'toggles' && (
                    <div className="space-y-5">
                        <div className="space-y-3">
                            {([
                                { field: 'useEnhancedCover', label: 'Enhanced Cover Page', desc: 'Full-bleed cover with logos and brand colors applied' },
                                { field: 'showChartsInExecutiveSummary', label: 'Charts in Executive Summary', desc: 'Severity distribution and category pie charts' },
                                { field: 'showRiskMatrix', label: 'Risk Matrix', desc: '2×2 impact/likelihood risk matrix in the report' },
                            ] as { field: keyof BrandingConfig; label: string; desc: string }[]).map(({ field, label, desc }) => (
                                <label key={field as string} className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/40 transition-colors">
                                    <Switch
                                        checked={!!(config as any)[field]}
                                        onCheckedChange={checked => handle(field, checked)}
                                        className="mt-0.5 shrink-0"
                                    />
                                    <div>
                                        <p className="text-sm font-medium">{label}</p>
                                        <p className="text-xs text-muted-foreground">{desc}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        <div className="space-y-3 pt-2 border-t">
                            <div className="space-y-2">
                                <Label htmlFor="footerText">Report Footer Text</Label>
                                <Input id="footerText" value={config.footerText || ''} onChange={e => handle('footerText', e.target.value)} placeholder="e.g. Confidential — OkNexus Security" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confidentiality">Confidentiality Notice</Label>
                                <Textarea id="confidentiality" value={config.confidentialityNotice || ''} onChange={e => handle('confidentialityNotice', e.target.value)} placeholder="This document contains confidential information..." rows={3} />
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

/**
 * Visual Style Editor
 */
function VisualStyleEditor({
    template,
    onChange
}: {
    template: ReportTemplate;
    onChange: (field: keyof ReportTemplate, value: any) => void;
}) {
    const style = template.visualStyle || {} as VisualStyleConfig;

    const handleChange = (field: keyof VisualStyleConfig, value: any) => {
        onChange('visualStyle', { ...style, [field]: value });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Visual Style</CardTitle>
                <CardDescription>Configure typography, spacing, and page layout</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="fontFamily">Font Family</Label>
                        <select
                            id="fontFamily"
                            value={style.fontFamily || 'system'}
                            onChange={(e) => handleChange('fontFamily', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="system">System Default</option>
                            <option value="inter">Inter</option>
                            <option value="roboto">Roboto</option>
                            <option value="opensans">Open Sans</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="spacing">Spacing Density</Label>
                        <select
                            id="spacing"
                            value={style.spacingDensity || 'comfortable'}
                            onChange={(e) => handleChange('spacingDensity', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="compact">Compact</option>
                            <option value="comfortable">Comfortable</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="pageSize">Page Size</Label>
                        <select
                            id="pageSize"
                            value={style.pageSize || 'A4'}
                            onChange={(e) => handleChange('pageSize', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="A4">A4 (International)</option>
                            <option value="Letter">Letter (US)</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="headingScale">Heading Scale</Label>
                        <select
                            id="headingScale"
                            value={style.headingScale || 'comfortable'}
                            onChange={(e) => handleChange('headingScale', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                            <option value="compact">Compact</option>
                            <option value="comfortable">Comfortable</option>
                            <option value="spacious">Spacious</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-6 pt-2">
                    <label className="flex items-center gap-2">
                        <Switch checked={style.showPageNumbers ?? true} onCheckedChange={v => handleChange('showPageNumbers', v)} />
                        <span className="text-sm font-medium">Show Page Numbers</span>
                    </label>
                    <label className="flex items-center gap-2">
                        <Switch checked={style.showHeaderFooter ?? true} onCheckedChange={v => handleChange('showHeaderFooter', v)} />
                        <span className="text-sm font-medium">Show Header/Footer</span>
                    </label>
                </div>
            </CardContent>
        </Card>
    );
}
