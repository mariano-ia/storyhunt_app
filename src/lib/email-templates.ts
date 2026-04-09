// ─── Shared email templates for StoryHunt nurturing cycle ───────────────────
// All emails use the same dark cyberpunk shell (Courier New, #050505 bg, red/cyan accents)

// ─── Email Shell ────────────────────────────────────────────────────────────

function emailShell(content: string): string {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:'Courier New',monospace;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:8px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1a1a1a;">
    <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:0.1em;">STORY</span><span style="font-size:20px;font-weight:700;color:#ff0033;letter-spacing:0.1em;">HUNT</span>
</td></tr>

${content}

<!-- Footer -->
<tr><td style="padding:20px 40px;border-top:1px solid #1a1a1a;">
    <p style="font-size:11px;color:#444;margin:0;letter-spacing:0.05em;">
        STORYHUNT // DECODE_THE_CITY<br>
        <a href="https://storyhunt.city" style="color:#444;text-decoration:none;">storyhunt.city</a>
        &nbsp;&middot;&nbsp;
        <a href="https://www.instagram.com/storyhunt.city/" style="color:#444;text-decoration:none;">@storyhunt.city</a>
    </p>
</td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

function statusRow(label: string): string {
    return `<tr><td style="padding:24px 40px 0;">
    <span style="font-size:12px;color:#00d2ff;letter-spacing:0.15em;">${label}</span>
</td></tr>`;
}

function headingRow(text: string): string {
    return `<tr><td style="padding:20px 40px 8px;">
    <h1 style="font-size:26px;color:#fff;margin:0;line-height:1.3;font-family:'Courier New',monospace;">${text}</h1>
</td></tr>`;
}

function paragraphRow(text: string, padding = '0 40px 24px'): string {
    return `<tr><td style="padding:${padding};">
    <p style="font-size:16px;color:#888;line-height:1.6;margin:0;">${text}</p>
</td></tr>`;
}

function ctaRow(url: string, label: string): string {
    return `<tr><td style="padding:8px 40px 32px;">
    <a href="${url}" style="display:inline-block;background:#ff0033;color:#fff;padding:16px 32px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.08em;border-radius:4px;font-family:'Courier New',monospace;">${label}</a>
</td></tr>`;
}

function dividerRow(): string {
    return `<tr><td style="padding:0 40px;"><div style="border-top:1px solid #1a1a1a;"></div></td></tr>`;
}

// ─── E1: Welcome Email ──────────────────────────────────────────────────────

export function welcomeEmail(isEn: boolean): { subject: string; html: string } {
    return {
        subject: isEn
            ? 'SIGNAL_RECEIVED // Welcome to StoryHunt'
            : 'SIGNAL_RECEIVED // Bienvenido a StoryHunt',
        html: emailShell(`
${statusRow('SIGNAL_RECEIVED // NEW_HUNTER_REGISTERED')}
${headingRow(isEn ? 'Your city has secrets.' : 'Tu ciudad tiene secretos.')}
${paragraphRow(isEn
    ? 'StoryHunt is a <strong style="color:#fff;">chat-based mystery walk</strong>. Your phone sends you clues. You walk through real streets, decode hidden places, and uncover stories the city tried to forget.'
    : 'StoryHunt es un <strong style="color:#fff;">mystery walk basado en chat</strong>. Tu celular te envía pistas. Caminás por calles reales, decodificás lugares ocultos y descubrís historias que la ciudad intentó olvidar.'
)}
${paragraphRow(isEn
    ? 'No guide. No group. No bus. Just you, your phone, and the city.'
    : 'Sin guía. Sin grupo. Sin bus. Solo vos, tu celular y la ciudad.'
)}
${ctaRow('https://storyhunt.city', isEn ? 'EXPLORE_MISSIONS' : 'EXPLORAR_MISIONES')}
`),
    };
}

// ─── E2: Mystery Teaser ─────────────────────────────────────────────────────

export function mysteryTeaserEmail(isEn: boolean): { subject: string; html: string } {
    return {
        subject: isEn
            ? 'A vault under Grand Central. A bridge hiding wine since 1876.'
            : 'Una bóveda bajo Grand Central. Un puente escondiendo vino desde 1876.',
        html: emailShell(`
${statusRow('CLASSIFIED_DATA // FRAGMENTS_INTERCEPTED')}
${headingRow(isEn ? 'Secrets hiding in plain sight.' : 'Secretos escondidos a la vista.')}

<tr><td style="padding:8px 40px 0;">
    <div style="background:#111;border-left:3px solid #ff0033;padding:16px 20px;margin-bottom:12px;">
        <span style="font-size:12px;color:#00d2ff;letter-spacing:0.1em;">FACT_001</span><br>
        <span style="font-size:15px;color:#ccc;line-height:1.5;">${isEn
            ? 'The Brooklyn Bridge arches hid a <strong style="color:#fff;">wine cellar sealed since 1876</strong>. City officials forgot it existed for decades.'
            : 'Los arcos del Brooklyn Bridge escondían una <strong style="color:#fff;">bodega sellada desde 1876</strong>. Las autoridades olvidaron que existía por décadas.'
        }</span>
    </div>
</td></tr>

<tr><td style="padding:0 40px;">
    <div style="background:#111;border-left:3px solid #ff0033;padding:16px 20px;margin-bottom:12px;">
        <span style="font-size:12px;color:#00d2ff;letter-spacing:0.1em;">FACT_002</span><br>
        <span style="font-size:15px;color:#ccc;line-height:1.5;">${isEn
            ? 'Grand Central has a <strong style="color:#fff;">secret train platform</strong> built for FDR. It\'s still there — under the Waldorf Astoria.'
            : 'Grand Central tiene una <strong style="color:#fff;">plataforma de tren secreta</strong> construida para FDR. Sigue ahí — debajo del Waldorf Astoria.'
        }</span>
    </div>
</td></tr>

<tr><td style="padding:0 40px 24px;">
    <div style="background:#111;border-left:3px solid #ff0033;padding:16px 20px;">
        <span style="font-size:12px;color:#00d2ff;letter-spacing:0.1em;">FACT_003</span><br>
        <span style="font-size:15px;color:#ccc;line-height:1.5;">${isEn
            ? 'There\'s a <strong style="color:#fff;">whispering gallery</strong> in Grand Central where you can hear someone across the room — if you know where to stand.'
            : 'Hay una <strong style="color:#fff;">galería de susurros</strong> en Grand Central donde podés escuchar a alguien del otro lado del salón — si sabés dónde pararte.'
        }</span>
    </div>
</td></tr>

${paragraphRow(isEn
    ? 'These are real. And you can <strong style="color:#fff;">walk to them</strong>. StoryHunt turns the city into a mystery you decode on foot.'
    : 'Esto es real. Y podés <strong style="color:#fff;">caminar hasta ellos</strong>. StoryHunt convierte la ciudad en un misterio que decodificás caminando.'
)}
${ctaRow('https://storyhunt.city', isEn ? 'DECODE_THE_CITY' : 'DECODIFICAR_LA_CIUDAD')}
`),
    };
}

// ─── E3: Social Proof / Urgency ─────────────────────────────────────────────

export function socialProofEmail(hunterCount: number, satisfactionPct: number, isEn: boolean): { subject: string; html: string } {
    return {
        subject: isEn
            ? `${hunterCount} hunters have decoded the city this month`
            : `${hunterCount} hunters decodificaron la ciudad este mes`,
        html: emailShell(`
${statusRow('FIELD_REPORT // HUNTER_ACTIVITY')}
${headingRow(isEn ? 'The city is being decoded.' : 'La ciudad está siendo decodificada.')}

<tr><td style="padding:8px 40px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
        <td style="background:#111;border:1px solid #1a1a1a;border-radius:4px;padding:20px;text-align:center;width:48%;">
            <span style="font-size:36px;color:#ff0033;font-weight:700;">${hunterCount}</span><br>
            <span style="font-size:11px;color:#666;letter-spacing:0.1em;">${isEn ? 'HUNTERS THIS MONTH' : 'HUNTERS ESTE MES'}</span>
        </td>
        <td style="width:4%;"></td>
        <td style="background:#111;border:1px solid #1a1a1a;border-radius:4px;padding:20px;text-align:center;width:48%;">
            <span style="font-size:36px;color:#00d2ff;font-weight:700;">${satisfactionPct}%</span><br>
            <span style="font-size:11px;color:#666;letter-spacing:0.1em;">${isEn ? 'SATISFACTION' : 'SATISFACCIÓN'}</span>
        </td>
    </tr>
    </table>
</td></tr>

${paragraphRow(isEn
    ? 'A chat-based mystery walk. <strong style="color:#fff;">Starting at $8</strong>. No guide. No group. Just you and the city.'
    : 'Un mystery walk basado en chat. <strong style="color:#fff;">Desde $8</strong>. Sin guía. Sin grupo. Solo vos y la ciudad.'
)}
${ctaRow('https://storyhunt.city', isEn ? 'JOIN_THE_HUNT' : 'UNITE_A_LA_CACERÍA')}
`),
    };
}

// ─── E5: Mission Pending (unused token reminder) ────────────────────────────

export function missionPendingEmail(experienceName: string, playUrl: string, daysLeft: number, isEn: boolean): { subject: string; html: string } {
    return {
        subject: isEn
            ? `Your mission is still waiting — "${experienceName}"`
            : `Tu misión sigue esperando — "${experienceName}"`,
        html: emailShell(`
${statusRow('MISSION_PENDING // AWAITING_AGENT')}
${headingRow(isEn ? 'You unlocked a mission.' : 'Desbloqueaste una misión.')}
${paragraphRow(isEn
    ? `You have access to <strong style="color:#fff;">${experienceName}</strong> but haven't started yet. Your access expires in <strong style="color:#ff0033;">${daysLeft} days</strong>.`
    : `Tenés acceso a <strong style="color:#fff;">${experienceName}</strong> pero todavía no empezaste. Tu acceso expira en <strong style="color:#ff0033;">${daysLeft} días</strong>.`
)}

<tr><td style="padding:0 40px 24px;">
    <div style="background:#111;border:1px solid #1a1a1a;border-radius:4px;padding:16px 20px;">
        <span style="font-size:12px;color:#00d2ff;letter-spacing:0.1em;">${isEn ? 'PRO_TIPS' : 'CONSEJOS'}</span>
        <p style="font-size:14px;color:#888;line-height:1.6;margin:8px 0 0;">
            ${isEn
                ? '&bull; Best on a clear day, phone fully charged<br>&bull; Wear comfortable shoes — you\'ll walk 2-3 hours<br>&bull; Headphones recommended for immersion'
                : '&bull; Mejor en un día despejado, celular cargado<br>&bull; Zapatos cómodos — vas a caminar 2-3 horas<br>&bull; Auriculares recomendados para la inmersión'
            }
        </p>
    </div>
</td></tr>

${ctaRow(playUrl, isEn ? 'START_THE_HUNT' : 'COMENZAR_LA_AVENTURA')}
`),
    };
}

// ─── E7: Last Call (coupon reminder) ────────────────────────────────────────

export function lastCallEmail(couponCode: string, isEn: boolean): { subject: string; html: string } {
    return {
        subject: isEn
            ? `${couponCode} expires soon — one last transmission`
            : `${couponCode} expira pronto — una última transmisión`,
        html: emailShell(`
${statusRow('FINAL_TRANSMISSION // SIGNAL_FADING')}
${headingRow(isEn ? 'One last message.' : 'Un último mensaje.')}
${paragraphRow(isEn
    ? `Your <strong style="color:#fff;">40% discount</strong> is about to expire. After this, we go silent.`
    : `Tu <strong style="color:#fff;">descuento del 40%</strong> está por expirar. Después de esto, dejamos de escribir.`
)}

<tr><td style="padding:0 40px 24px;">
    <div style="background:#111;border:1px solid #222;border-radius:4px;padding:20px;text-align:center;">
        <span style="font-size:11px;color:#666;letter-spacing:0.1em;">${isEn ? 'YOUR DISCOUNT CODE' : 'TU CÓDIGO DE DESCUENTO'}</span><br>
        <span style="font-size:32px;color:#ff0033;font-weight:700;letter-spacing:0.15em;">${couponCode}</span><br>
        <span style="font-size:13px;color:#666;margin-top:8px;display:inline-block;">40% OFF</span>
    </div>
</td></tr>

${paragraphRow(isEn
    ? 'Pick a new neighborhood. Decode a new mystery. <strong style="color:#fff;">Your phone is the only guide you need.</strong>'
    : 'Elegí un nuevo barrio. Decodificá un nuevo misterio. <strong style="color:#fff;">Tu celular es la única guía que necesitás.</strong>'
)}
${ctaRow('https://storyhunt.city', isEn ? 'BROWSE_EXPERIENCES' : 'VER_EXPERIENCIAS')}

<tr><td style="padding:0 40px 24px;">
    <p style="font-size:12px;color:#444;line-height:1.6;margin:0;font-style:italic;">
        ${isEn
            ? 'This is our last email. We respect your inbox.'
            : 'Este es nuestro último email. Respetamos tu bandeja de entrada.'
        }
    </p>
</td></tr>
`),
    };
}
