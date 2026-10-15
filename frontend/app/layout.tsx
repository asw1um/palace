import type { ReactNode } from 'react';
import Script from 'next/script';
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/components.css';
import '@/styles/app.css';
import { Providers } from './providers';

export const metadata = {
  title: 'Palace',
  description: 'Palace — track what you watch, build lists, and share them with your clubs.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0B1220',
};

/** Pre-paint theme bootstrap: always dark — set CSS vars from localStorage before hydration (no flash). */
const THEME_BOOTSTRAP = `(function(){try{
var el=document.documentElement;
el.dataset.mode='dark';
var raw=localStorage.getItem('palace.theme.v2');
if(raw){
  var t=JSON.parse(raw);
  if(t.density)el.dataset.density=t.density;
  if(t.accent)el.style.setProperty('--accent',t.accent);
  var h=(t.header&&t.header!=='#1e4c80')?t.header:(t.accent||'#2563EB');
  el.style.setProperty('--header',h);
  function mix(h1,h2,r){
    var a=parseInt(h1.slice(1),16),b=parseInt(h2.slice(1),16);
    return'#'+[16,8,0].map(function(s){return Math.round(((a>>s)&255)*r+((b>>s)&255)*(1-r)).toString(16).padStart(2,'0')}).join('');
  }
  el.style.setProperty('--bg',mix(h,'#0f1118',0.22));
  el.style.setProperty('--bg-subtle',mix(h,'#141820',0.28));
  el.style.setProperty('--surface-1',mix(h,'#1e2230',0.24));
  el.style.setProperty('--surface-2',mix(h,'#222838',0.30));
  el.style.setProperty('--surface-3',mix(h,'#282e40',0.34));
  el.style.setProperty('--surface-inset',mix(h,'#181e2a',0.25));
  el.style.setProperty('--border',mix(h,'#2a3040',0.36));
  el.style.setProperty('--line',mix(h,'#2a3040',0.36));
  el.style.setProperty('--line-strong',mix(h,'#3a4050',0.46));
}
}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Warm the TCP+TLS connection to TMDB before the first image request */}
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        {/* Pre-paint theme bootstrap: next/script "beforeInteractive" injects the script the
            way Next's head manager expects — a raw <script> in the layout head breaks hydration
            and throws the OuterLayoutRouter "reading 'get'" error. */}
        <Script id="palace-theme-bootstrap" strategy="beforeInteractive">
          {THEME_BOOTSTRAP}
        </Script>
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
