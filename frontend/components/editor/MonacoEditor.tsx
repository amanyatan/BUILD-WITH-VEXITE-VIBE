"use client";

import Editor from "@monaco-editor/react";

export function MonacoEditor({ files = {} }: { files?: Record<string, string> }) {
  const file = files["index.html"] ? "index.html" : Object.keys(files)[0];
  return (
    <div className="h-full">
      <Editor
        height="100%"
        language={file?.endsWith(".css") ? "css" : file?.endsWith(".js") ? "javascript" : "html"}
        value={files[file || ""] || "// Start coding..."}
        theme="vs-dark"
      />
    </div>
  );
}
