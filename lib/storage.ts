import { AppState, ClientProfile, Engagement, ServiceProviderProfile, ReportTemplate, ValidationResult, Application, Engineer, Artifact, ArtifactScope, ArtifactType, Component, ComponentFinding, ExtractedComponent, ComponentType, TrustZone, ClientUser, RemediationEvent, RemediationOutcome, RetestRequest, RetestStatus, FindingStatus, AutoRetestResult } from './types';
import { REPORT_TEMPLATES as SYSTEM_TEMPLATES } from './constants';
import { validateTemplateCompleteness } from './template-validation';
import { queueDBSync } from './db-sync';

declare global {
    interface Window {
        __dbSyncEmail?: string;
    }
}

const STORAGE_KEY = 'security_report_builder_data';

// Initialize default state
const getDefaultState = (): AppState => ({
    serviceProviders: [],
    clients: [],
    applications: [],
    engineers: [],
    artifacts: [],
    engagements: [],
    templates: [],
    clientUsers: [],
    retestRequests: [], // New: Retest queue
    autoRetestResults: [], // New: Auto-retest engine history
    components: [],
    componentFindings: [],
});

// Load data from localStorage
export const loadState = (): AppState => {
    try {
        if (typeof window === 'undefined') return getDefaultState();
        const serialized = localStorage.getItem(STORAGE_KEY);
        if (serialized === null) {
            return getDefaultState();
        }
        const parsed = JSON.parse(serialized);

        // Run migration to V2 if needed
        const migrated = migrateToV2(parsed);

        // Save migrated state if migration occurred
        if (migrated !== parsed) {
            saveState(migrated);
        }

        return migrated;
    } catch (err) {
        console.error('Error loading state from localStorage:', err);
        return getDefaultState();
    }
};

// Save data to localStorage and queue a background sync to Supabase
export const saveState = (state: AppState): void => {
    try {
        if (typeof window === 'undefined') return;
        const serialized = JSON.stringify(state);
        localStorage.setItem(STORAGE_KEY, serialized);
        queueDBSync(window.__dbSyncEmail, state);
    } catch (err) {
        console.error('Error saving state to localStorage:', err);
    }
};

// Service Provider CRUD operations
export const createServiceProvider = (provider: Omit<ServiceProviderProfile, 'id' | 'createdAt' | 'updatedAt'>): ServiceProviderProfile => {
    const now = new Date().toISOString();
    const newProvider: ServiceProviderProfile = {
        ...provider,
        id: `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
    };

    const state = loadState();
    state.serviceProviders.push(newProvider);
    saveState(state);

    return newProvider;
};

export const updateServiceProvider = (id: string, updates: Partial<ServiceProviderProfile>): ServiceProviderProfile | null => {
    const state = loadState();
    const index = state.serviceProviders.findIndex(sp => sp.id === id);

    if (index === -1) return null;

    state.serviceProviders[index] = {
        ...state.serviceProviders[index],
        ...updates,
        id, // Ensure ID doesn't change
        updatedAt: new Date().toISOString(),
    };

    saveState(state);
    return state.serviceProviders[index];
};

export const deleteServiceProvider = (id: string): boolean => {
    const state = loadState();
    const initialLength = state.serviceProviders.length;
    state.serviceProviders = state.serviceProviders.filter(sp => sp.id !== id);

    if (state.serviceProviders.length < initialLength) {
        saveState(state);
        return true;
    }
    return false;
};

export const getServiceProvider = (id: string): ServiceProviderProfile | null => {
    const state = loadState();
    return state.serviceProviders.find(sp => sp.id === id) || null;
};

export const getAllServiceProviders = (): ServiceProviderProfile[] => {
    const state = loadState();
    return state.serviceProviders;
};

// Client CRUD operations
export const createClient = (client: Omit<ClientProfile, 'id' | 'createdAt' | 'updatedAt'>): ClientProfile => {
    const now = new Date().toISOString();
    const newClient: ClientProfile = {
        ...client,
        id: `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
    };

    const state = loadState();
    state.clients.push(newClient);
    saveState(state);

    return newClient;
};

export const updateClient = (id: string, updates: Partial<ClientProfile>): ClientProfile | null => {
    const state = loadState();
    const index = state.clients.findIndex(c => c.id === id);

    if (index === -1) return null;

    state.clients[index] = {
        ...state.clients[index],
        ...updates,
        id,
        updatedAt: new Date().toISOString(),
    };

    saveState(state);
    return state.clients[index];
};

export const deleteClient = (id: string): boolean => {
    const state = loadState();
    const initialLength = state.clients.length;

    // Remove client
    state.clients = state.clients.filter(c => c.id !== id);

    if (state.clients.length < initialLength) {
        // Cascading delete: Remove applications
        const appsToDelete = state.applications.filter(a => a.clientId === id).map(a => a.id);
        state.applications = state.applications.filter(a => a.clientId !== id);

        // Cascading delete: Remove engagements
        state.engagements = state.engagements.filter(e => e.clientId !== id);

        // Cascading delete: Remove artifacts (client-scoped and application-scoped for deleted apps)
        state.artifacts = state.artifacts.filter(art => {
            if (art.scope === 'client' && art.scopeId === id) return false;
            if (art.scope === 'application' && appsToDelete.includes(art.scopeId)) return false;
            return true;
        });

        saveState(state);
        return true;
    }
    return false;
};

export const getClient = (id: string): ClientProfile | null => {
    const state = loadState();
    return state.clients.find(c => c.id === id) || null;
};

export const getAllClients = (): ClientProfile[] => {
    const state = loadState();
    return state.clients;
};

// Client User CRUD operations
export const createClientUser = (user: Omit<ClientUser, 'id'>): ClientUser => {
    const newUser: ClientUser = {
        ...user,
        id: `user_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    const state = loadState();
    if (!state.clientUsers) state.clientUsers = [];
    state.clientUsers.push(newUser);
    saveState(state);

    return newUser;
};

export const updateClientUser = (id: string, updates: Partial<ClientUser>): ClientUser | null => {
    const state = loadState();
    if (!state.clientUsers) return null;

    const index = state.clientUsers.findIndex(u => u.id === id);
    if (index === -1) return null;

    state.clientUsers[index] = {
        ...state.clientUsers[index],
        ...updates,
        id, // Ensure ID doesn't change
    };

    saveState(state);
    return state.clientUsers[index];
};

export const deleteClientUser = (id: string): boolean => {
    const state = loadState();
    if (!state.clientUsers) return false;

    const initialLength = state.clientUsers.length;
    state.clientUsers = state.clientUsers.filter(u => u.id !== id);

    if (state.clientUsers.length < initialLength) {
        saveState(state);
        return true;
    }
    return false;
};

export const getClientUsers = (clientId: string): ClientUser[] => {
    const state = loadState();

    // Auto-seed if empty (for MVP demo)
    if (!state.clientUsers || state.clientUsers.length === 0) {
        state.clientUsers = [];
        state.clients.forEach(client => {
            state.clientUsers.push({
                id: `cu-${Math.random().toString(36).substr(2, 9)}`,
                clientId: client.id,
                email: `admin@${client.companyName.toLowerCase().replace(/\s+/g, '')}.com`,
                name: `${client.companyName} Admin`,
                role: 'client_admin',
                status: 'active',
                invitedBy: 'system',
                invitedAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            } as ClientUser);
        });
        saveState(state);
    }

    return state.clientUsers.filter(u => u.clientId === clientId);
};

export const getClientUserByEmail = (email: string): ClientUser | null => {
    const state = loadState();
    if (!state.clientUsers) return null;
    const normalizedEmail = email.trim().toLowerCase();
    return state.clientUsers.find(u => u.email.trim().toLowerCase() === normalizedEmail) || null;
}

// ============================================================================
// Data Migration - V1 to V2
// ============================================================================

/**
 * Migrate existing data to V2 schema with new entities
 */
const migrateToV2 = (state: any): AppState => {
    // If already migrated, return as is
    if (state.applications && state.engineers && state.artifacts) {
        return state as AppState;
    }

    console.log('Migrating data to V2 schema...');

    // Initialize new entity arrays
    const applications: Application[] = state.applications || [];
    const engineers: Engineer[] = state.engineers || [];
    const artifacts: Artifact[] = state.artifacts || [];

    // Create default applications for existing engagements
    if (state.engagements && state.engagements.length > 0) {
        const createdApps = new Map<string, string>(); // clientId -> applicationId

        state.engagements.forEach((engagement: any) => {
            // Skip if already has applicationId
            if (engagement.applicationId) return;

            const clientId = engagement.clientId;

            // Create default application if not exists for this client
            if (!createdApps.has(clientId)) {
                const client = state.clients?.find((c: ClientProfile) => c.id === clientId);
                const appId = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const newApp: Application = {
                    id: appId,
                    clientId: clientId,
                    name: client ? `${client.companyName} - Default Application` : 'Default Application',
                    description: 'Auto-created during migration from V1',
                    createdAt: engagement.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                applications.push(newApp);
                createdApps.set(clientId, appId);
            }

            // Link engagement to application
            engagement.applicationId = createdApps.get(clientId);
            engagement.engineerIds = engagement.engineerIds || [];
        });
    }

    return {
        ...state,
        applications,
        engineers,
        artifacts,
    } as AppState;
};

// ============================================================================
// Application CRUD operations
// ============================================================================

export const createApplication = (app: Omit<Application, 'id' | 'createdAt' | 'updatedAt'>): Application => {
    const now = new Date().toISOString();
    const newApp: Application = {
        ...app,
        id: `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
    };

    const state = loadState();
    if (!state.applications) state.applications = [];
    state.applications.push(newApp);
    saveState(state);

    return newApp;
};

export const updateApplication = (id: string, updates: Partial<Application>): Application | null => {
    const state = loadState();
    if (!state.applications) return null;

    const index = state.applications.findIndex(a => a.id === id);
    if (index === -1) return null;

    state.applications[index] = {
        ...state.applications[index],
        ...updates,
        id, // Ensure ID doesn't change
        updatedAt: new Date().toISOString(),
    };

    saveState(state);
    return state.applications[index];
};

export const deleteApplication = (id: string): boolean => {
    const state = loadState();
    if (!state.applications) return false;

    const initialLength = state.applications.length;
    state.applications = state.applications.filter(a => a.id !== id);

    if (state.applications.length < initialLength) {
        saveState(state);
        return true;
    }
    return false;
};

export const getApplication = (id: string): Application | null => {
    const state = loadState();
    if (!state.applications) return null;
    return state.applications.find(a => a.id === id) || null;
};

export const getAllApplications = (): Application[] => {
    const state = loadState();
    return state.applications || [];
};

export const getApplicationsByClient = (clientId: string): Application[] => {
    const state = loadState();
    if (!state.applications) return [];
    return state.applications.filter(a => a.clientId === clientId);
};

// ============================================================================
// Engineer CRUD operations
// ============================================================================

export const createEngineer = (engineer: Omit<Engineer, 'id' | 'createdAt' | 'updatedAt'>): Engineer => {
    const now = new Date().toISOString();
    const newEngineer: Engineer = {
        ...engineer,
        id: `eng_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        exposure: engineer.exposure || {
            vulnerabilityClasses: [],
            applicationTypes: [],
            authModels: [],
            totalEngagements: 0,
        },
        createdAt: now,
        updatedAt: now,
    };

    const state = loadState();
    if (!state.engineers) state.engineers = [];
    state.engineers.push(newEngineer);
    saveState(state);

    return newEngineer;
};

export const updateEngineer = (id: string, updates: Partial<Engineer>): Engineer | null => {
    const state = loadState();
    if (!state.engineers) return null;

    const index = state.engineers.findIndex(e => e.id === id);
    if (index === -1) return null;

    state.engineers[index] = {
        ...state.engineers[index],
        ...updates,
        id,
        updatedAt: new Date().toISOString(),
    };

    saveState(state);
    return state.engineers[index];
};

export const updateEngineerExposure = (
    engineerId: string,
    newExposure: {
        vulnerabilityClass?: string;
        applicationType?: string;
        authModel?: string;
    }
): Engineer | null => {
    const engineer = getEngineer(engineerId);
    if (!engineer) return null;

    const exposure = { ...engineer.exposure };

    if (newExposure.vulnerabilityClass && !exposure.vulnerabilityClasses.includes(newExposure.vulnerabilityClass)) {
        exposure.vulnerabilityClasses.push(newExposure.vulnerabilityClass);
    }
    if (newExposure.applicationType && !exposure.applicationTypes.includes(newExposure.applicationType)) {
        exposure.applicationTypes.push(newExposure.applicationType);
    }
    if (newExposure.authModel && !exposure.authModels.includes(newExposure.authModel)) {
        exposure.authModels.push(newExposure.authModel);
    }

    return updateEngineer(engineerId, { exposure });
};

export const deleteEngineer = (id: string): boolean => {
    const state = loadState();
    if (!state.engineers) return false;

    const initialLength = state.engineers.length;
    state.engineers = state.engineers.filter(e => e.id !== id);

    if (state.engineers.length < initialLength) {
        saveState(state);
        return true;
    }
    return false;
};

export const getEngineer = (id: string): Engineer | null => {
    const state = loadState();
    if (!state.engineers) return null;
    return state.engineers.find(e => e.id === id) || null;
};

export const getAllEngineers = (): Engineer[] => {
    const state = loadState();
    return state.engineers || [];
};

// ============================================================================
// Artifact CRUD operations
// ============================================================================

export const createArtifact = (artifact: Omit<Artifact, 'id' | 'uploadedAt' | 'updatedAt'>): Artifact => {
    const now = new Date().toISOString();
    const newArtifact: Artifact = {
        ...artifact,
        id: `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        uploadedAt: now,
        updatedAt: now,
        visibility: 'internal-only',
    };

    const state = loadState();
    if (!state.artifacts) state.artifacts = [];
    state.artifacts.push(newArtifact);
    saveState(state);

    // NEW: Queue for embedding in background
    if (typeof window !== 'undefined') {
        import('./embedding-worker').then(({ queueArtifactForEmbedding }) => {
            queueArtifactForEmbedding(newArtifact).catch(err => {
                console.error('Failed to queue artifact for embedding:', err);
            });
        });
    }

    return newArtifact;
};

export const updateArtifact = (id: string, updates: Partial<Artifact>): Artifact | null => {
    const state = loadState();
    if (!state.artifacts) return null;

    const index = state.artifacts.findIndex(a => a.id === id);
    if (index === -1) return null;

    state.artifacts[index] = {
        ...state.artifacts[index],
        ...updates,
        id,
        updatedAt: new Date().toISOString(),
    };

    saveState(state);

    // NEW: Queue for re-embedding if content changed
    const updated = state.artifacts[index];
    if (typeof window !== 'undefined' && updates.content !== undefined) {
        import('./embedding-worker').then(({ queueArtifactForEmbedding }) => {
            queueArtifactForEmbedding(updated).catch(err => {
                console.error('Failed to queue artifact for embedding:', err);
            });
        });
    }

    return updated;
};

export const deleteArtifact = (id: string): boolean => {
    const state = loadState();
    if (!state.artifacts) return false;

    const initialLength = state.artifacts.length;
    state.artifacts = state.artifacts.filter(a => a.id !== id);

    if (state.artifacts.length < initialLength) {
        saveState(state);

        // NEW: Remove from vector store
        if (typeof window !== 'undefined') {
            import('./vector-store').then(({ getVectorStore }) => {
                getVectorStore().then(store => {
                    store.remove(id);
                    store.persist().catch(err => {
                        console.error('Failed to persist vector store after deletion:', err);
                    });
                });
            }).catch(err => {
                console.error('Failed to remove artifact from vector store:', err);
            });
        }

        return true;
    }
    return false;
};

export const getArtifact = (id: string): Artifact | null => {
    const state = loadState();
    if (!state.artifacts) return null;
    return state.artifacts.find(a => a.id === id) || null;
};

export const getAllArtifacts = (): Artifact[] => {
    const state = loadState();
    return state.artifacts || [];
};

export const getArtifactsByScope = (scope: ArtifactScope, scopeId: string): Artifact[] => {
    const state = loadState();
    if (!state.artifacts) return [];
    return state.artifacts.filter(a => a.scope === scope && a.scopeId === scopeId);
}

// ============================================================================
// Component Registry Storage
// ============================================================================

const COMPONENTS_KEY = 'components';
const COMPONENT_FINDINGS_KEY = 'component_findings';

export function createComponent(data: Omit<Component, 'id' | 'createdAt' | 'updatedAt'>): Component {
    const component: Component = {
        id: `comp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    const components = getAllComponents();
    components.push(component);
    if (typeof window !== 'undefined') {
        localStorage.setItem(COMPONENTS_KEY, JSON.stringify(components));
    }

    return component;
}

export function getAllComponents(): Component[] {
    try {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(COMPONENTS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error loading components:', error);
        return [];
    }
}

export function getComponentById(id: string): Component | undefined {
    return getAllComponents().find(c => c.id === id);
}

export function getComponentsByApplication(applicationId: string): Component[] {
    return getAllComponents().filter(c => c.applicationId === applicationId);
}

export function getComponentByName(name: string, applicationId: string): Component | undefined {
    return getAllComponents().find(c =>
        c.name === name && c.applicationId === applicationId
    );
}

export function updateComponent(id: string, updates: Partial<Component>): Component | null {
    const components = getAllComponents();
    const index = components.findIndex(c => c.id === id);

    if (index === -1) return null;

    components[index] = {
        ...components[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    if (typeof window !== 'undefined') {
        localStorage.setItem(COMPONENTS_KEY, JSON.stringify(components));
    }
    return components[index];
}

export function deleteComponent(id: string): boolean {
    const components = getAllComponents();
    const filtered = components.filter(c => c.id !== id);

    if (filtered.length === components.length) return false;

    if (typeof window !== 'undefined') {
        localStorage.setItem(COMPONENTS_KEY, JSON.stringify(filtered));

        // Also delete associated component-finding links
        const links = getAllComponentFindings();
        const filteredLinks = links.filter(l => l.componentId !== id);
        localStorage.setItem(COMPONENT_FINDINGS_KEY, JSON.stringify(filteredLinks));
    }

    return true;
}

// Component-Finding Link Functions
export function linkComponentToFinding(
    componentId: string,
    findingId: string,
    role: ComponentFinding['role'],
    extractionMethod: ComponentFinding['extractionMethod'],
    confidence: number
): ComponentFinding {
    const link: ComponentFinding = {
        componentId,
        findingId,
        role,
        extractionMethod,
        confidence,
        linkedAt: new Date().toISOString(),
    };

    const links = getAllComponentFindings();

    // Check if link already exists
    const existingIndex = links.findIndex(
        l => l.componentId === componentId && l.findingId === findingId
    );

    if (existingIndex !== -1) {
        // Update existing link
        links[existingIndex] = link;
    } else {
        // Add new link
        links.push(link);
    }

    if (typeof window !== 'undefined') {
        localStorage.setItem(COMPONENT_FINDINGS_KEY, JSON.stringify(links));
    }

    // Update component's findingIds array
    const component = getComponentById(componentId);
    if (component && !component.findingIds.includes(findingId)) {
        component.findingIds.push(findingId);
        component.lastSeen = new Date().toISOString();
        updateComponent(component.id, component);
    }

    return link;
}

export function getAllComponentFindings(): ComponentFinding[] {
    try {
        if (typeof window === 'undefined') return [];
        const data = localStorage.getItem(COMPONENT_FINDINGS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('Error loading component findings:', error);
        return [];
    }
}

export function getComponentFindingsByComponent(componentId: string): ComponentFinding[] {
    return getAllComponentFindings().filter(l => l.componentId === componentId);
}

export function getComponentFindingsByFinding(findingId: string): ComponentFinding[] {
    return getAllComponentFindings().filter(l => l.findingId === findingId);
}

export function unlinkComponentFromFinding(componentId: string, findingId: string): boolean {
    const links = getAllComponentFindings();
    const filtered = links.filter(
        l => !(l.componentId === componentId && l.findingId === findingId)
    );

    if (filtered.length === links.length) return false;

    if (typeof window !== 'undefined') {
        localStorage.setItem(COMPONENT_FINDINGS_KEY, JSON.stringify(filtered));
    }

    // Update component's findingIds array
    const component = getComponentById(componentId);
    if (component) {
        component.findingIds = component.findingIds.filter(id => id !== findingId);
        updateComponent(component.id, component);
    }

    return true;
}

// Scoped Component Queries
export function getEngagementById(id: string): Engagement | undefined {
    const state = loadState();
    return state.engagements.find(e => e.id === id);
}

export function getComponentsByClient(clientId: string): Component[] {
    const applications = getAllApplications().filter(a => a.clientId === clientId);
    const appIds = applications.map(a => a.id);
    return getAllComponents().filter(c => appIds.includes(c.applicationId));
}

export function getComponentsByEngagement(engagementId: string): Component[] {
    const engagement = getEngagementById(engagementId);
    if (!engagement) return [];

    const findingIds = engagement.findings.map(f => f.id!).filter(Boolean);
    const links = getAllComponentFindings().filter(l => findingIds.includes(l.findingId));
    const componentIds = [...new Set(links.map(l => l.componentId))];

    return getAllComponents().filter(c => componentIds.includes(c.id));
}

export interface ComponentStats {
    totalComponents: number;
    byType: Record<ComponentType, number>;
    byTrustZone: Record<TrustZone, number>;
    componentsWithFindings: number;
}

export function getComponentStats(components: Component[]): ComponentStats {
    const stats: ComponentStats = {
        totalComponents: components.length,
        byType: {} as Record<ComponentType, number>,
        byTrustZone: {} as Record<TrustZone, number>,
        componentsWithFindings: 0,
    };

    components.forEach(comp => {
        stats.byType[comp.type] = (stats.byType[comp.type] || 0) + 1;
        stats.byTrustZone[comp.trustZone] = (stats.byTrustZone[comp.trustZone] || 0) + 1;

        if (comp.findingIds.length > 0) {
            stats.componentsWithFindings++;
        }
    });

    return stats;
}

export const getArtifactsByType = (type: ArtifactType): Artifact[] => {
    const state = loadState();
    if (!state.artifacts) return [];
    return state.artifacts.filter(a => a.type === type);
};

// ============================================================================
// Engagement CRUD operations
// ============================================================================

export const createEngagement = (engagement: Omit<Engagement, 'id' | 'createdAt' | 'updatedAt'>): Engagement => {
    const now = new Date().toISOString();
    const newEngagement: Engagement = {
        ...engagement,
        id: `eng_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
    };

    const state = loadState();
    state.engagements.push(newEngagement);
    saveState(state);

    return newEngagement;
};

export const updateEngagement = (id: string, updates: Partial<Engagement>): Engagement | null => {
    const state = loadState();
    const index = state.engagements.findIndex(e => e.id === id);

    if (index === -1) return null;

    state.engagements[index] = {
        ...state.engagements[index],
        ...updates,
        id,
        updatedAt: new Date().toISOString(),
    };

    saveState(state);
    return state.engagements[index];
};

export const deleteEngagement = (id: string): boolean => {
    const state = loadState();
    const initialLength = state.engagements.length;
    state.engagements = state.engagements.filter(e => e.id !== id);

    if (state.engagements.length < initialLength) {
        saveState(state);
        return true;
    }
    return false;
};

export const getEngagement = (id: string): Engagement | null => {
    const state = loadState();
    return state.engagements.find(e => e.id === id) || null;
};

export const getAllEngagements = (): Engagement[] => {
    const state = loadState();
    return state.engagements;
};

// Template CRUD operations
export const createTemplate = (template: Omit<ReportTemplate, 'id'>): ReportTemplate | ValidationResult => {
    // Validate template before creation
    const validation = validateTemplateCompleteness(template as ReportTemplate);

    // Block save on critical or error severity
    if (validation.severity === 'critical' || validation.severity === 'error') {
        return validation; // Return validation result instead of template
    }

    // Generate a custom ID
    const newTemplate: ReportTemplate = {
        ...template,
        id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    const state = loadState();
    // Ensure templates array exists (migration)
    if (!state.templates) state.templates = [];

    state.templates.push(newTemplate);
    saveState(state);

    return newTemplate;
};

export const updateTemplate = (id: string, updates: Partial<ReportTemplate>): ReportTemplate | ValidationResult | null => {
    // Cannot update system templates
    if (SYSTEM_TEMPLATES[id]) {
        console.warn("Cannot update system template directly. Clone it first.");
        return null;
    }

    const state = loadState();
    if (!state.templates) return null;

    const index = state.templates.findIndex(t => t.id === id);
    if (index === -1) return null;

    const updatedTemplate = {
        ...state.templates[index],
        ...updates,
        id, // Ensure ID doesn't change
    };

    // Validate before saving
    const validation = validateTemplateCompleteness(updatedTemplate);

    // Block save on critical or error severity
    if (validation.severity === 'critical' || validation.severity === 'error') {
        return validation; // Return validation result instead of template
    }

    state.templates[index] = updatedTemplate;
    saveState(state);
    return state.templates[index];
};

export const deleteTemplate = (id: string): boolean => {
    if (SYSTEM_TEMPLATES[id]) return false; // Cannot delete system templates

    const state = loadState();
    if (!state.templates) return false;

    const initialLength = state.templates.length;
    state.templates = state.templates.filter(t => t.id !== id);

    if (state.templates.length < initialLength) {
        saveState(state);
        return true;
    }
    return false;
};

export const getTemplate = (id: string): ReportTemplate | undefined => {
    // Check system templates first
    if (SYSTEM_TEMPLATES[id]) return SYSTEM_TEMPLATES[id];

    // Check user templates
    const state = loadState();
    return state.templates?.find(t => t.id === id);
};

export const getAllTemplates = (): ReportTemplate[] => {
    const state = loadState();
    const systemTemplates = Object.values(SYSTEM_TEMPLATES);
    const systemIds = new Set(systemTemplates.map(t => t.id));
    const userTemplates = (state.templates || []).filter(t => !systemIds.has(t.id));
    return [...systemTemplates, ...userTemplates];
};

// AI Preferences
export const getAIPreferences = (): { provider: 'groq' | 'gemini' } => {
    const state = loadState();
    return state.aiPreferences || { provider: 'groq' };
};

export const setAIPreferences = (prefs: { provider: 'groq' | 'gemini' }): void => {
    const state = loadState();
    state.aiPreferences = prefs;
    saveState(state);
};

// Export/Import functionality
export const exportData = (): string => {
    const state = loadState();
    return JSON.stringify(state, null, 2);
};

export const importData = (jsonData: string): boolean => {
    try {
        const data = JSON.parse(jsonData) as AppState;

        // Basic validation
        if (!data.serviceProviders || !data.clients || !data.engagements) {
            throw new Error('Invalid data structure');
        }

        saveState(data);
        return true;
    } catch (err) {
        console.error('Error importing data:', err);
        return false;
    }
};

// ============================================================================
// Remediation Event Management
// ============================================================================

export const createRemediationEvent = (
    findingId: string,
    engagementId: string,
    event: Omit<RemediationEvent, 'id' | 'findingId' | 'engagementId' | 'createdAt' | 'updatedAt'>
): RemediationEvent => {
    const state = loadState();
    const now = new Date().toISOString();

    const newEvent: RemediationEvent = {
        ...event,
        findingId,
        engagementId,
        id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
    };

    // Update the finding's remediation history
    const engagement = state.engagements.find(e => e.id === engagementId);
    if (engagement) {
        const finding = engagement.findings.find(f => f.id === findingId);
        if (finding) {
            if (!finding.remediationHistory) {
                finding.remediationHistory = [];
            }
            finding.remediationHistory.push(newEvent);
            saveState(state);
        }
    }

    return newEvent;
};

export const updateRemediationEvent = (
    eventId: string,
    updates: Partial<Omit<RemediationEvent, 'id' | 'findingId' | 'engagementId' | 'createdAt'>>
): RemediationEvent | null => {
    const state = loadState();
    const now = new Date().toISOString();

    // Find the remediation event across all engagements and findings
    for (const engagement of state.engagements) {
        for (const finding of engagement.findings) {
            if (finding.remediationHistory) {
                const eventIndex = finding.remediationHistory.findIndex(e => e.id === eventId);
                if (eventIndex !== -1) {
                    finding.remediationHistory[eventIndex] = {
                        ...finding.remediationHistory[eventIndex],
                        ...updates,
                        updatedAt: now,
                    };
                    saveState(state);
                    return finding.remediationHistory[eventIndex];
                }
            }
        }
    }

    return null;
};

export const getRemediationEvent = (eventId: string): RemediationEvent | null => {
    const state = loadState();

    for (const engagement of state.engagements) {
        for (const finding of engagement.findings) {
            if (finding.remediationHistory) {
                const event = finding.remediationHistory.find(e => e.id === eventId);
                if (event) return event;
            }
        }
    }

    return null;
};

export const getRemediationHistory = (findingId: string): RemediationEvent[] => {
    const state = loadState();

    for (const engagement of state.engagements) {
        const finding = engagement.findings.find(f => f.id === findingId);
        if (finding && finding.remediationHistory) {
            return finding.remediationHistory;
        }
    }

    return [];
};

// Get all remediation events across a client (for intelligence analysis)
export const getClientRemediationEvents = (clientId: string): RemediationEvent[] => {
    const state = loadState();
    const events: RemediationEvent[] = [];

    const clientEngagements = state.engagements.filter(e => e.clientId === clientId);
    clientEngagements.forEach(engagement => {
        engagement.findings.forEach(finding => {
            if (finding.remediationHistory) {
                events.push(...finding.remediationHistory);
            }
        });
    });

    return events;
};

// Get remediation events by outcome (for pattern analysis)
export const getRemediationEventsByOutcome = (
    outcome: RemediationOutcome,
    clientId?: string
): RemediationEvent[] => {
    const state = loadState();
    let engagements = state.engagements;

    if (clientId) {
        engagements = engagements.filter(e => e.clientId === clientId);
    }

    const events: RemediationEvent[] = [];
    engagements.forEach(engagement => {
        engagement.findings.forEach(finding => {
            if (finding.remediationHistory) {
                const filteredEvents = finding.remediationHistory.filter(e => e.outcome === outcome);
                events.push(...filteredEvents);
            }
        });
    });

    return events;
};

// Verify a remediation event (typically done in a re-test engagement)
export const verifyRemediationEvent = (
    eventId: string,
    verificationData: {
        outcome: RemediationOutcome;
        verifiedBy: string;
        verificationEngagementId?: string;
        verificationNotes?: string;
        actualEffort?: string;
    }
): RemediationEvent | null => {
    const now = new Date().toISOString();

    return updateRemediationEvent(eventId, {
        ...verificationData,
        verifiedAt: now,
    });
};

// ============================================================================
// Retest Request Management (Simpler workflow)
// ============================================================================

export const createRetestRequest = (
    findingId: string,
    engagementId: string,
    clientId: string,
    requestedBy: string, // ClientUser ID
    clientNotes?: string
): RetestRequest => {
    const state = loadState();
    const now = new Date().toISOString();

    const newRequest: RetestRequest = {
        id: `retest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        findingId,
        engagementId,
        clientId,
        requestedBy,
        clientNotes,
        requestedAt: now,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
    };

    if (!state.retestRequests) {
        state.retestRequests = [];
    }

    state.retestRequests.push(newRequest);
    saveState(state);

    return newRequest;
};

export const updateRetestRequest = (
    requestId: string,
    updates: Partial<Omit<RetestRequest, 'id' | 'createdAt'>>
): RetestRequest | null => {
    const state = loadState();
    const now = new Date().toISOString();

    if (!state.retestRequests) return null;

    const index = state.retestRequests.findIndex(r => r.id === requestId);
    if (index === -1) return null;

    state.retestRequests[index] = {
        ...state.retestRequests[index],
        ...updates,
        updatedAt: now,
    };

    saveState(state);
    return state.retestRequests[index];
};

export const assignRetestRequest = (
    requestId: string,
    engineerId: string
): RetestRequest | null => {
    const now = new Date().toISOString();
    return updateRetestRequest(requestId, {
        assignedTo: engineerId,
        assignedAt: now,
        status: 'assigned',
    });
};

export const completeRetestRequest = (
    requestId: string,
    completedBy: string,
    newFindingStatus: FindingStatus,
    retestNotes?: string
): RetestRequest | null => {
    const state = loadState();
    const now = new Date().toISOString();

    // Update the retest request
    const updated = updateRetestRequest(requestId, {
        status: 'completed',
        completedBy,
        completedAt: now,
        newFindingStatus,
        retestNotes,
    });

    if (!updated) return null;

    // Update the finding status
    const engagement = state.engagements.find(e => e.id === updated.engagementId);
    if (engagement) {
        const finding = engagement.findings.find(f => f.id === updated.findingId);
        if (finding) {
            finding.status = newFindingStatus;
            finding.updatedAt = now;
            saveState(state);
        }
    }

    return updated;
};

export const getRetestRequest = (requestId: string): RetestRequest | null => {
    const state = loadState();
    if (!state.retestRequests) return null;
    return state.retestRequests.find(r => r.id === requestId) || null;
};

export const getAllRetestRequests = (): RetestRequest[] => {
    const state = loadState();
    return state.retestRequests || [];
};

export const getPendingRetestRequests = (): RetestRequest[] => {
    const state = loadState();
    if (!state.retestRequests) return [];
    return state.retestRequests.filter(r => r.status === 'pending' || r.status === 'assigned' || r.status === 'in-progress');
};

export const getRetestRequestsByClient = (clientId: string): RetestRequest[] => {
    const state = loadState();
    if (!state.retestRequests) return [];
    return state.retestRequests.filter(r => r.clientId === clientId);
};

export const getRetestRequestsByEngineer = (engineerId: string): RetestRequest[] => {
    const state = loadState();
    if (!state.retestRequests) return [];
    return state.retestRequests.filter(r => r.assignedTo === engineerId);
};

// ============================================================================
// Auto-Retest Result Management
// ============================================================================

export const saveAutoRetestResult = (result: AutoRetestResult): void => {
    const state = loadState();
    if (!state.autoRetestResults) state.autoRetestResults = [];
    state.autoRetestResults.push(result);
    saveState(state);
};

export const getAllAutoRetestResults = (): AutoRetestResult[] => {
    const state = loadState();
    const results = state.autoRetestResults || [];
    // Return newest first
    return [...results].sort((a, b) => new Date(b.ranAt).getTime() - new Date(a.ranAt).getTime());
};

export const getAutoRetestResult = (id: string): AutoRetestResult | null => {
    const state = loadState();
    if (!state.autoRetestResults) return null;
    return state.autoRetestResults.find(r => r.id === id) || null;
};

export const getAutoRetestResultsByFinding = (findingId: string): AutoRetestResult[] => {
    const state = loadState();
    if (!state.autoRetestResults) return [];
    return state.autoRetestResults
        .filter(r => r.findingId === findingId)
        .sort((a, b) => new Date(b.ranAt).getTime() - new Date(a.ranAt).getTime());
};

// Clear all data
export const clearAllData = (): void => {
    localStorage.removeItem(STORAGE_KEY);
};
