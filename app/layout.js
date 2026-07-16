import "./globals.css";

export const metadata = {
  title: "Shift Swap",
  description: "Give away and swap shifts with your colleagues",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Shifts" },
};

export const viewport = {
  themeColor: "#10151f",
  width: "device-width",
  initialScale: 1,
};

const themeInit = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else document.documentElement.dataset.theme = 'dark';
} catch (e) { document.documentElement.dataset.theme = 'dark'; }
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
