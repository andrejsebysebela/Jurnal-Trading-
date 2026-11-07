"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#090B0F", color: "#F5F5F5", fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>EDGELOG je dočasne nedostupný · EDGELOG is temporarily unavailable</h1>
          <p style={{ color: "#929BA9", fontSize: 14 }}>Skúste to o chvíľu znova · Please try again in a moment{error.digest ? ` (ref ${error.digest})` : ""}.</p>
          <button onClick={reset} style={{ marginTop: 16, background: "#C6A15B", color: "#14110a", border: 0, borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>Skúsiť znova / Try again</button>
        </div>
      </body>
    </html>
  );
}
