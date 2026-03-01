// ─── Core Domain Types ────────────────────────────────────────────────────────

export type ExperienceMode = 'test' | 'production';
export type ExperienceStatus = 'active' | 'inactive';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface Experience {
    id: string;
    name: string;
    description: string;
    narrator_personality: string; // Used as LLM system prompt
    llm_api_key: string;
    twilio_trigger: string;       // Phone number or sender ID
    mode: ExperienceMode;
    activation_keyword: string;
    status: ExperienceStatus;
    created_at: string;           // ISO date string
    updated_at: string;
}

export interface Step {
    id: string;
    experience_id: string;
    order: number;
    message_to_send: string;
    // If false, this is a narrative step — no user answer expected.
    // System auto-advances to the next step immediately.
    requires_response: boolean;
    expected_answer: string;    // Ignored when requires_response = false
    hints: string[];            // Ignored when requires_response = false
    wrong_answer_message: string; // Ignored when requires_response = false
    // Optional LLM context hint — helps AI guide user without skipping steps.
    // If empty, inherits the most recent non-empty context from previous steps.
    context?: string;
    // Seconds to wait before showing this step's message (0 = no delay). Default: 1.2
    delay_seconds?: number;
}

// ─── Preview Chat ─────────────────────────────────────────────────────────────

export interface PreviewMessage {
    role: 'system' | 'user';
    content: string;
    timestamp: string;
    evaluation?: 'correct' | 'incorrect' | 'narrative' | 'off_topic';
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
