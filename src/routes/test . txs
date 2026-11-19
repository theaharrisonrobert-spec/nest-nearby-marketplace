import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/test")({
  component: TestPage,
});

function TestPage() {
  const [v, setV] = useState("");
  return (
    <div style={{ padding: 20 }}>
      <h1>Test page</h1>
      <p>Type here:</p>
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Type a long sentence here"
        style={{ width: "100%", padding: 12, fontSize: 18, border: "1px solid #000" }}
      />
      <p>You typed: {v}</p>
    </div>
  );
}
