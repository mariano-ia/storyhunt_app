import React from 'react';

// ─── Message Renderer ────────────────────────────────────────────────────────
// Supports: **bold**, [link text](url), and bare URLs (https://...)

const TOKEN_REGEX = /(\*\*.*?\*\*|\[.*?\]\(.*?\)|https?:\/\/[^\s)]+)/g;

function renderTokens(text: string, keyPrefix: string): React.ReactNode[] {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    TOKEN_REGEX.lastIndex = 0;
    while ((match = TOKEN_REGEX.exec(text)) !== null) {
        // Text before the match
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }

        const token = match[0];

        if (token.startsWith('**') && token.endsWith('**')) {
            // Bold: **text**
            parts.push(<strong key={`${keyPrefix}-b-${match.index}`}>{token.slice(2, -2)}</strong>);
        } else if (token.startsWith('[')) {
            // Markdown link: [text](url)
            const linkMatch = token.match(/^\[(.*?)\]\((.*?)\)$/);
            if (linkMatch) {
                parts.push(
                    <a key={`${keyPrefix}-a-${match.index}`} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#0B84FF', textDecoration: 'underline', wordBreak: 'break-all' }}>
                        {linkMatch[1]}
                    </a>
                );
            } else {
                parts.push(token);
            }
        } else if (token.startsWith('http')) {
            // Bare URL
            parts.push(
                <a key={`${keyPrefix}-u-${match.index}`} href={token} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#0B84FF', textDecoration: 'underline', wordBreak: 'break-all' }}>
                    {token.length > 50 ? token.slice(0, 47) + '...' : token}
                </a>
            );
        }

        lastIndex = match.index + token.length;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts;
}

export function renderMessage(content: string): React.ReactNode {
    const lines = content.split('\n');
    return lines.map((line, lineIdx) => {
        const parts = renderTokens(line, `l${lineIdx}`);
        return (
            <span key={lineIdx}>
                {parts.length > 0 ? parts : line}
                {lineIdx < lines.length - 1 && <br />}
            </span>
        );
    });
}
