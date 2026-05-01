import React from "react";

export default function App(props) {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Djact starter</h1>
      <p>This is a minimal JSX example inside <strong>djact/djact</strong>.</p>
      <pre style={{ background: "#f5f5f5", padding: "1rem", borderRadius: "8px" }}>
        {JSON.stringify(props, null, 2)}
      </pre>
    </main>
  );
}
