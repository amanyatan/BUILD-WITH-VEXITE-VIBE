"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ExternalLink, FolderKanban } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAppStore } from "@/store";

export default function ProjectsPage() {
  const { projects, addProject, removeProject } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const router = useRouter();

  function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || `project-${Date.now()}`;
    addProject({
      id,
      name: name.trim(),
      description: "",
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: "local",
    });
    setName("");
    setShowForm(false);
    router.push(`/workspace?id=${id}`);
  }

  return (
    <AppShell title="Projects">
      <main className="content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">Your workspace</div>
            <h1>Projects</h1>
            <p>Everything you&apos;re making, in one place.</p>
          </div>
          <button className="button button-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> New project
          </button>
        </div>

        {showForm && (
          <section className="panel" style={{ marginBottom: 22 }}>
            <div className="panel-heading">
              <h2>Start a new project</h2>
              <button className="icon-button" onClick={() => setShowForm(false)}>×</button>
            </div>
            <form className="form-grid" onSubmit={create}>
              <div className="field">
                <label htmlFor="project-name">Project name</label>
                <input
                  id="project-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tic Tac Toe Game"
                  autoFocus
                />
              </div>
              <div>
                <button className="button button-primary" type="submit">Create &amp; Open</button>
              </div>
            </form>
          </section>
        )}

        {projects.length === 0 && !showForm && (
          <div className="empty-state" style={{ marginTop: 40 }}>
            <FolderKanban size={40} style={{ opacity: 0.3 }} />
            <h3>No projects yet</h3>
            <p>Click &quot;New project&quot; to describe your first idea.</p>
          </div>
        )}

        <section className="project-grid">
          {projects.map((project, i) => (
            <div className="project-card" key={project.id}>
              <div className={`project-color ${["one", "two", "three"][i % 3]}`}>
                <div className="mini-browser"><i /><b /></div>
              </div>
              <div className="card-meta">
                <div>
                  <h3>{project.name}</h3>
                  <p>{project.description || "New idea"}</p>
                </div>
                <button className="icon-button" aria-label={`Delete ${project.name}`} onClick={() => removeProject(project.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 17, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                <span className={`status ${project.status === "draft" ? "status-draft" : "status-ready"}`}>{project.status}</span>
                <button className="button button-ghost" onClick={() => router.push(`/workspace?id=${project.id}`)}>
                  Open <ExternalLink size={12} />
                </button>
              </div>
            </div>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
