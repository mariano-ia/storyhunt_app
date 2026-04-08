import { NextResponse } from 'next/server';

const IG_ACCOUNT_ID = '17841444079999050';
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO = 'mariano-ia/storyhuntweb';
const CALENDAR_PATH = 'social-calendar.json';
const CALENDAR_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${CALENDAR_PATH}`;
const GITHUB_RAW = `https://raw.githubusercontent.com/${GITHUB_REPO}/main`;
const CRON_SECRET = process.env.CRON_SECRET || '';

// Caption templates by content_type
const CAPTIONS: Record<string, (topic: string, location: string) => string> = {
    MYSTERY_TEASER: (topic, location) => `SIGNAL_INTERCEPTED // ${location}

${topic}

StoryHunt. A chat-based mystery walk through NYC. No guide. No bus. Just you, your phone, and the city.

DECODE_THE_CITY → storyhunt.city

#NYC #StoryHunt #HiddenNYC #NYCSecrets #MysteryWalk #InteractiveAdventure #ScavengerHunt #UrbanExploration #DecodeTheCity #NYCAdventure #NYCHiddenGems #ExploreNYC #ThingsToDoNYC`,

    DID_YOU_KNOW: (topic) => `DATA_DECLASSIFIED // NYC_ARCHIVES

${topic}

StoryHunt takes you to the places most people walk past. A chat-based mystery walk. Your phone is the guide.

DECODE_THE_CITY → storyhunt.city

#NYC #StoryHunt #HiddenNYC #NYCSecrets #DidYouKnow #NYCHistory #UrbanExploration #MysteryWalk #DecodeTheCity #NYCFacts #InteractiveAdventure`,

    EXPERIENCE_PROMO: (topic, location) => `MISSION_BRIEFING // ${location}

${topic}

A chat-based mystery walk. Your phone sends the clues. The city hides the answers.

PLAY_NOW → storyhunt.city

#NYC #StoryHunt #HiddenNYC #NYCSecrets #MysteryWalk #InteractiveAdventure #ScavengerHunt #DecodeTheCity #NYCAdventure #NYCExperience #ThingsToDoNYC`,

    NEIGHBORHOOD_SPOTLIGHT: (topic, location) => `ZONE_SCAN_ACTIVE // ${location}

${topic}

StoryHunt walks you through it. Chat clues sent to your phone. No guide. No bus.

DECODE_THE_CITY → storyhunt.city

#NYC #StoryHunt #HiddenNYC #NYCSecrets #UrbanExploration #MysteryWalk #DecodeTheCity #NYCAdventure #ExploreNYC #NYCNeighborhoods`,

    BEHIND_THE_HUNT: (topic) => `TRANSMISSION_ACTIVE // FIELD_REPORT

${topic}

This is what StoryHunt feels like. A chat-based mystery walk through NYC. Your phone sends clues. The city becomes the game.

DECODE_THE_CITY → storyhunt.city

#NYC #StoryHunt #HiddenNYC #MysteryWalk #InteractiveAdventure #DecodeTheCity #NYCAdventure #NYCExperience`,

    QUOTE: (topic) => `FIELD_NOTE // NYC_DISPATCH

${topic}

StoryHunt. A chat-based mystery walk through NYC.

→ storyhunt.city

#NYC #StoryHunt #DecodeTheCity #MysteryWalk #InteractiveAdventure #NYCSecrets #UrbanExploration #NYCAdventure #HiddenNYC`,
};

interface CalendarPost {
    date: string;
    content_type: string;
    topic: string;
    location?: string;
    image_file: string;
    status: string;
}

async function publishPost(post: CalendarPost): Promise<{ success: boolean; post_id?: string; error?: string }> {
    const imageUrl = `${GITHUB_RAW}/${post.image_file}`;
    const captionFn = CAPTIONS[post.content_type] || CAPTIONS.MYSTERY_TEASER;
    const location = (post.location || '// NYC').replace('// ', '');
    const caption = captionFn(post.topic, location);

    try {
        // Step 1: Create media container
        const createRes = await fetch(`https://graph.facebook.com/v25.0/${IG_ACCOUNT_ID}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                image_url: imageUrl,
                caption: caption,
                access_token: ACCESS_TOKEN,
            }),
        });
        const createData = await createRes.json();
        if (!createData.id) {
            return { success: false, error: `Container failed: ${JSON.stringify(createData)}` };
        }

        // Step 2: Wait for processing
        await new Promise(r => setTimeout(r, 15000));

        // Step 3: Publish
        const pubRes = await fetch(`https://graph.facebook.com/v25.0/${IG_ACCOUNT_ID}/media_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                creation_id: createData.id,
                access_token: ACCESS_TOKEN,
            }),
        });
        const pubData = await pubRes.json();
        if (!pubData.id) {
            return { success: false, error: `Publish failed: ${JSON.stringify(pubData)}` };
        }

        return { success: true, post_id: pubData.id };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

export async function GET(request: Request) {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ACCESS_TOKEN) {
        return NextResponse.json({ error: 'INSTAGRAM_ACCESS_TOKEN not configured' }, { status: 500 });
    }

    // Fetch calendar from GitHub
    const calRes = await fetch(CALENDAR_URL, { cache: 'no-store' });
    if (!calRes.ok) {
        return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
    }
    const calendar = await calRes.json();
    const today = new Date().toISOString().slice(0, 10);

    // Find ALL pending posts up to today
    const pendingPosts = (calendar.posts as CalendarPost[]).filter(
        p => p.status === 'pending' && p.date <= today
    );

    if (pendingPosts.length === 0) {
        return NextResponse.json({ message: 'No pending posts for today or earlier', today });
    }

    const results: { date: string; success: boolean; post_id?: string; error?: string }[] = [];
    let anyPublished = false;

    for (const post of pendingPosts) {
        console.log(`Publishing: ${post.date} — ${post.content_type}`);
        const result = await publishPost(post);
        results.push({ date: post.date, ...result });

        if (result.success) {
            // Mark as published in calendar object
            const idx = calendar.posts.findIndex((p: CalendarPost) => p.date === post.date && p.image_file === post.image_file);
            if (idx >= 0) {
                calendar.posts[idx].status = 'published';
                calendar.posts[idx].published_date = today;
                calendar.posts[idx].post_id = result.post_id;
            }
            anyPublished = true;
        }

        // Wait between posts to avoid rate limiting
        if (pendingPosts.indexOf(post) < pendingPosts.length - 1) {
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    // Update calendar in GitHub so published posts don't get re-published
    if (anyPublished && GITHUB_TOKEN) {
        try {
            // Get current file SHA
            const fileRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${CALENDAR_PATH}`, {
                headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' },
            });
            const fileData = await fileRes.json();
            const sha = fileData.sha;

            // Update file
            const content = Buffer.from(JSON.stringify(calendar, null, 2)).toString('base64');
            await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${CALENDAR_PATH}`, {
                method: 'PUT',
                headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `social: published ${results.filter(r => r.success).length} post(s) on ${today}`,
                    content,
                    sha,
                }),
            });
            console.log('Calendar updated in GitHub');
        } catch (err) {
            console.error('Failed to update calendar in GitHub:', err);
        }
    }

    return NextResponse.json({
        today,
        published: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
    });
}
