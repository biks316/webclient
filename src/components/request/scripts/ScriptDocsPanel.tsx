interface ScriptDocsPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function ScriptDocsPanel({ collapsed, onToggle }: ScriptDocsPanelProps) {
  if (collapsed) {
    return (
      <button type="button" className="script-docs-rail" onClick={onToggle}>
        Docs
      </button>
    );
  }

  return (
    <aside className="script-docs-panel">
      <header>
        <div>
          <strong>Documentation</strong>
          <span>Variables, functions, examples</span>
        </div>
        <button type="button" onClick={onToggle}>Collapse</button>
      </header>

      <section>
        <h3>Variables</h3>
        <code>request.url</code>
        <code>request.headers</code>
        <code>request.queryParams</code>
        <code>response.status</code>
        <code>response.body</code>
        <p>
          <code>response</code> is only available in post-response scripts.
        </p>
      </section>

      <section>
        <h3>Functions</h3>
        <code>ctx.set("token", value)</code>
        <code>ctx.get("token")</code>
        <code>bik.setHeader("X-Trace", value)</code>
        <code>bik.setQueryParam("page", 1)</code>
        <code>bik.setBody({"{ id: 1 }"})</code>
        <code>bik.setResponseBody(data)</code>
        <code>bik.setResponseHeader("X-Source", value)</code>
        <code>bik.setResponseStatus(200, "OK")</code>
        <p>
          During request execution, <code>ctx.set()</code> writes to the selected environment when one is active.
          Otherwise it writes to request variables for the current request only.
        </p>
      </section>

      <section>
        <h3>Examples</h3>
        <pre>{`ctx.set("token", value)

const token = ctx.get("token")

const body = JSON.parse(response.body)
ctx.set("token", body.token)

request.url = "https://api.example.com"

if (response.status >= 400) {
  console.error(response.body)
} else {
  bik.setResponseBody(JSON.parse(response.body))
}`}</pre>
      </section>
    </aside>
  );
}
