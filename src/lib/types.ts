// ─── Core Domain Types ────────────────────────────────────────────────────────

export type ExperienceMode = 'test' | 'production';
export type ExperienceStatus = 'active' | 'inactive';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface Experience {
    id: string;
    name: string;
    description: string;
    narrator_personality: string; // Used as LLM system prompt
    narrator_avatar?: string;     // URL to the narrator's profile picture
    llm_api_key: string;
    slug?: string;                // URL slug for the public page
    mode: ExperienceMode;
    activation_keyword: string;
    status: ExperienceStatus;
    created_at: string;           // ISO date string
    updated_at: string;
}

// ─── Scenes ──────────────────────────────────────────────────────────────────

export interface Scene {
    id: string;
    experience_id: string;
    name: string;
    order: number;
    next_scene_id?: string; // default linear flow to next scene
}

export type SceneFormData = Omit<Scene, 'id' | 'experience_id'>;

// ─── Choice (for branching steps) ────────────────────────────────────────────

export interface Choice {
    label: string;              // "Seguir caminando"
    condition: string;          // "el usuario quiere continuar/seguir"
    target_scene_id?: string;   // jump to this scene
    target_step_id?: string;    // or jump to this specific step
}

// ─── Steps ───────────────────────────────────────────────────────────────────

export interface Step {
    id: string;
    experience_id: string;
    scene_id?: string;          // which scene this step belongs to
    order: number;
    step_type?: 'interactive' | 'narrative' | 'typing' | 'choice';
    message_to_send: string;
    requires_response: boolean;
    expected_answer: string;
    hints: string[];
    wrong_answer_message: string;
    context?: string;
    delay_seconds?: number;

    media_url?: string;
    media_type?: 'image' | 'video' | 'audio';

    interrupted_typing?: boolean;
    glitch_effect?: boolean;

    // For step_type === 'choice': branching options
    choices?: Choice[];
}

// ─── Preview Chat ─────────────────────────────────────────────────────────────

export interface PreviewMessage {
    role: 'system' | 'user';
    content: string;
    timestamp: string;
    evaluation?: 'correct' | 'incorrect' | 'narrative' | 'off_topic' | 'choice';
    media_url?: string;
    media_type?: 'image' | 'video' | 'audio';
    glitch_effect?: boolean;
}

export interface UserSession {
    id: string;
    experience_id: string;
    whatsapp_number: string;
    current_step: number;
    status: SessionStatus;
    started_at: string;
    finished_at?: string;
}

export interface Interaction {
    id: string;
    session_id: string;
    user_message: string;
    system_response: string;
    tokens_consumed: number;
    estimated_cost: number; // In USD
    timestamp: string;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface ExperienceMetrics {
    experience_id: string;
    total_sessions: number;
    completed_sessions: number;
    completion_rate: number;        // 0–1
    highest_drop_step: number | null; // Step order where most users abandon
    total_tokens: number;
    total_cost_usd: number;
    avg_cost_per_session: number;
}

// ─── Form Types (Wizard) ──────────────────────────────────────────────────────

export type ExperienceFormData = Omit<Experience, 'id' | 'created_at' | 'updated_at'>;
export type StepFormData = Omit<Step, 'id' | 'experience_id'>;

// ─── Dashboard Summary Stats ──────────────────────────────────────────────────

export interface DashboardStats {
    total_experiences: number;
    active_experiences: number;
    total_sessions: number;
    active_sessions: number;
    completed_sessions: number;
    total_cost_usd: number;
    completion_rate: number;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export interface Contact {
    id: string;
    email: string;
    created_at: string;
    status: 'new' | 'contacted';
}
