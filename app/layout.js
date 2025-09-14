import "./globals.css";

export const metadata = {
  title: "Aeros Gaming Hub Points System",
  description: "Aeros Gaming Hub Points Rewards System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
