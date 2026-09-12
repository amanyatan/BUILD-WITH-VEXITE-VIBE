"use client";
import Link from "next/link";
import { Plus, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAppStore } from "@/store";

export default function DashboardPage() {
  const projects = useAppStore((s) => s.projects);

  return (
    <AppShell title="Overview">
      <main className="content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">Welcome</div>
            <h1>Your workspace</h1>
            <p>Create a project and describe your idea.</p>
          </div>
          <Link href="/projects" className="button button-primary">
            <Plus size={16} /> New project
          </Link>
        </div>

        <div className="stat-grid">
          <Stat label="Total projects" value={String(projects.length).padStart(2, "0")} />
          <Stat label="Active" value={String(projects.filter((p) => p.status === "active").length).padStart(2, "0")} />
          <Stat label="Drafts" value={String(projects.filter((p) => p.status === "draft").length).padStart(2, "0")} />
        </div>

        {projects.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 20 }}>
            <h3>No projects yet</h3>
            <p>Create a project and start with a prompt.</p>
            <Link href="/projects" className="button button-primary" style={{ marginTop: 16 }}>
              <Plus size={14} /> Create first project
            </Link>
          </div>
        ) : (
          <section className="panel" style={{ marginTop: 20 }}>
            <div className="panel-heading">
              <h2>Recent projects</h2>
              <Link href="/projects">View all <ArrowUpRight size={13} style={{ verticalAlign: "middle" }} /></Link>
            </div>
            <div className="project-grid">
              {projects.slice(0, 3).map((project, i) => (
                <Link key={project.id} href={`/workspace?id=${project.id}`} className="project-card" style={{ textDecoration: "none", color: "inherit" }}>
                  <div className={`project-color ${["one", "two", "three"][i % 3]}`}>
                    <div className="mini-browser"><i /><b /></div>
                  </div>
                  <div className="card-meta">
                    <div>
                      <h3>{project.name}</h3>
                      <p>{project.description || "New idea"}</p>
                    </div>
                    <span className={`status ${project.status === "draft" ? "status-draft" : "status-ready"}`}>
                      {project.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
