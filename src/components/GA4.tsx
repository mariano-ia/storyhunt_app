'use client';

import Script from 'next/script';

const GA4_MEASUREMENT_ID = 'G-4EWN9RMYR9';

export default function GA4() {
    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    window.gtag = gtag;
                    gtag('js', new Date());
                    gtag('config', '${GA4_MEASUREMENT_ID}');
                `}
            </Script>
        </>
    );
}
