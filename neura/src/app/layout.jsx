import './globals.css';

export const metadata = {
  title: 'NEURA — Banda',
  description:
    'Neura — banda de metal cinematográfico de universo cyberpunk. Shows, lore, poemas, vídeos e redes.',
  icons: { icon: '/assets/favicon.svg' },
  openGraph: {
    title: 'NEURA',
    description: 'Metal cinematográfico. A voz daqueles que decidiram abrir os olhos.',
    type: 'website',
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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Marca que há JS antes da primeira pintura: só então as animações
            de entrada escondem o conteúdo. Sem JS, tudo aparece normalmente. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;700&family=Inter:wght@400;500&family=Chakra+Petch:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
