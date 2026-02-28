/**
 * StoryHunt ABM - Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initGlowCapture();
    initScrollAnimations();
    initLucide();
});

/**
 * Navbar scroll behavior
 */
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('glass');
        } else {
            navbar.classList.remove('glass');
        }
    });

    // Mobile Menu Toggle (simplified for now)
    const toggle = document.querySelector('.nav-mobile-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            console.log('Mobile menu toggle clicked');
        });
    }
}

/**
 * Mouse follow glow effect for premium feel
 */
function initGlowCapture() {
    const glowCapture = document.getElementById('glow-capture');
    if (!glowCapture) return;

    window.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        
        glowCapture.style.background = `radial-gradient(600px circle at ${x}px ${y}px, rgba(236, 72, 153, 0.08), transparent 40%)`;
    });
}

/**
 * Simple Intersection Observer for scroll animations
 */
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                // Could add more specific logic here
            }
        });
    }, observerOptions);

    // Apply to elements with specific animation classes (if we add them later in HTML)
    document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
}

/**
 * Re-initialize Lucide if needed (CDN already handles it but just in case)
 */
function initLucide() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * Dynamic Story Selection Demo (Future work)
 */
function setupPersonalizationDemo() {
    // Placeholder for interactive "Personalize your Story" feature
    console.log('StoryHunt Personalization Demo Initialized');
}
