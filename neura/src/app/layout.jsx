import { Poppins, Inter, Chakra_Petch } from 'next/font/google';

import './globals.css';

/* next/font baixa e serve as fontes do próprio domínio: sai o round-trip para
   fonts.googleapis.com + fonts.gstatic.com no caminho crítico, e o Next reserva
   as métricas de cada face, o que elimina o salto de layout na troca. Cada uma
   expõe uma variável CSS consumida pelos tokens em neura.css. */

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--n-fonte-head',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--n-fonte-body',
  display: 'swap',
});

const chakraPetch = Chakra_Petch({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--n-fonte-hud',
  display: 'swap',
});

/* Endereço público do site. Sem isso o Next não consegue montar as URLs
   absolutas que o OpenGraph exige e avisa a cada build. Defina
   NEXT_PUBLIC_SITE_URL no .env.local quando o domínio estiver de pé. */
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata = {
  metadataBase: new URL(SITE),
  title: 'NEURA — Banda',
  description:
    'Neura — banda de metal cinematográfico de universo cyberpunk. Shows, lore, poemas, vídeos e redes.',
  icons: { icon: '/assets/favicon.svg' },
  openGraph: {
    title: 'NEURA',
    description: 'Metal cinematográfico. A voz daqueles que decidiram abrir os olhos.',
    type: 'website',
    url: '/',
    siteName: 'NEURA',
    locale: 'pt_BR',
    images: [{ url: '/assets/og.png', width: 1200, height: 630, alt: 'NEURA' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEURA',
    description: 'Metal cinematográfico. A voz daqueles que decidiram abrir os olhos.',
    images: ['/assets/og.png'],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d0d0d',
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: o script abaixo altera a classe do <html>
    // de propósito antes da hidratação, então a diferença é esperada.
    <html
      lang="pt-BR"
      className={`${poppins.variable} ${inter.variable} ${chakraPetch.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Marca que há JS antes da primeira pintura: só então as animações
            de entrada escondem o conteúdo. Sem JS, tudo aparece normalmente. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
