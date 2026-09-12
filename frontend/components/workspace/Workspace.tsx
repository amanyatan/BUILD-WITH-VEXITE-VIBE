"use client";

import { useState } from "react";
import { MonacoEditor } from "@/components/editor/MonacoEditor";
import { LivePreview } from "@/components/preview/LivePreview";
import { ConversationButton } from "@/components/voice/ConversationButton";

export function Workspace() {
  const [files, setFiles] = useState<Record<string, string>>({});

  return (
    <div>
      <ConversationButton onCodeUpdate={setFiles} />
      <div className="flex h-[calc(100vh-64px)]">
        <div className="w-1/2">
          <MonacoEditor files={files} />
        </div>
        <div className="w-1/2">
          <LivePreview />
        </div>
      </div>
    </div>
  );
}
