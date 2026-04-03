// ─── Core Domain Types ────────────────────────────────────────────────────────

export type ExperienceMode = 'test' | 'production';
export type ExperienceStatus = 'active' | 'inactive' | 'coming_soon' | 'published';
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

    // ─── Web Info (public landing) ──────────────────────────────
    price?: number;               // USD
    web_image?: string;           // URL hero image for the card
    web_tagline?: string;         // Card front tagline (max 80 chars)
    web_description?: string;     // Card back full description (max 280 chars)
    distance?: string;            // "2.5 km", "1.2 mi"
    duration?: string;            // "45 min", "1.5 hs"
    difficulty?: 'easy' | 'medium' | 'hard';
    location?: string;            // "Midtown Manhattan, NYC"

    // ─── Translations (generated on publish) ────────────────────
    narrator_personality_en?: string;
    web_tagline_en?: string;
    web_description_en?: string;
    published_at?: string;        // ISO date of last publish
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
    step_type?: 'interactive' | 'narrative' | 'typing' | 'choice' | 'error_screen';
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

    // Flow control: jump to a specific step after this one (if empty, advances to next by order)
    next_step_id?: string;

    // Translations (generated on publish)
    message_to_send_en?: string;
    expected_answer_en?: string;
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

// ─── AI Story Generation ─────────────────────────────────────────────────────

export interface AIGeneratedScene {
    name: string;
    order: number;
    steps: AIGeneratedStep[];
}

export interface AIGeneratedStep {
    step_type: 'interactive' | 'narrative' | 'typing' | 'choice' | 'error_screen';
    message_to_send: string;
    requires_response: boolean;
    expected_answer: string;
    hints: string[];
    wrong_answer_message: string;
    delay_seconds?: number;
    glitch_effect?: boolean;
    interrupted_typing?: boolean;
    context?: string;
    choices?: { label: string; condition: string; target_scene_name?: string }[];
}

export interface AIGeneratedExperience {
    name: string;
    description: string;
    narrator_personality: string;
    slug: string;
    activation_keyword: string;
    context?: string;
    scenes: AIGeneratedScene[];
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export interface Contact {
    id: string;
    email: string;
    created_at: string;
    status: 'new' | 'contacted';
}

// ─── Discount Coupons ────────────────────────────────────────────────────────

export interface DiscountCoupon {
    id: string;
    code: string;                           // "PROMO20", "EARLYBIRD"
    discount_type: 'percent' | 'fixed';     // porcentaje o monto fijo
    discount_value: number;                 // 20 (= 20% o $20)
    max_redemptions: number;                // usos maximos totales
    times_redeemed: number;
    valid_until: string;                    // ISO date
    status: 'active' | 'expired' | 'disabled';
    stripe_coupon_id?: string;              // ID del coupon en Stripe
    stripe_promo_id?: string;               // ID del promotion code en Stripe
    created_at: string;
}

export type DiscountCouponFormData = Omit<DiscountCoupon, 'id' | 'times_redeemed' | 'created_at' | 'stripe_coupon_id' | 'stripe_promo_id'>;

// ─── Access Tokens (post-pago) ───────────────────────────────────────────────

export interface AccessToken {
    id: string;
    token: string;                          // "SH-A8F3K2"
    experience_id: string;
    lang: 'es' | 'en';
    email: string;                          // email del comprador
    max_uses: number;
    times_used: number;
    status: 'active' | 'used' | 'expired';
    expires_at: string;                     // ISO date
    stripe_session_id?: string;
    created_at: string;
    used_at?: string;
}

// ─── Sales ───────────────────────────────────────────────────────────────────

export interface Sale {
    id: string;
    experience_id: string;
    experience_name: string;
    email: string;
    amount: number;                         // monto cobrado en centavos
    currency: string;                       // "usd"
    coupon_code?: string;
    discount_applied?: number;              // descuento en centavos
    stripe_session_id: string;
    access_token_id: string;
    created_at: string;
}
