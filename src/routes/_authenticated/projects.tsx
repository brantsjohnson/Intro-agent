import { createFileRoute, Link, Outlet, useMatchRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { listProjects } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/projects")({ component: ProjectsLayout });

function ProjectsLayout() {
  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const matchRoute = useMatchRoute();
  const onDetail = matchRoute({ to: "/projects/$slug", fuzzy: true });

  if (onDetail) return <AppShell><Outlet /></AppShell>;

  return (
    <AppShell>
      <PageHeader title="Projects" subtitle="Each one has its own brain." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(projects ?? []).map((p) => (
          <Link
            key={p.id} to="/projects/$slug" params={{ slug: p.slug }}
            className="bg-card border border-border rounded-lg p-5 hover:border-ink transition group"
          >
            <div className="w-2 h-2 rounded-full mb-3" style={{ background: p.color ?? "#666" }} />
            <div className="serif text-xl text-ink">{p.name}</div>
            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description || "No description yet"}</div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
