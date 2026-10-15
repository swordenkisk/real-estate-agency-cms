import { FormEvent, useEffect, useState } from "react";

type Project = {
  id: string;
  title: string;
  description: string;
  location: string;
  price: string;
  images: string[];
  status: "draft" | "published";
};

const emptyProject: Omit<Project, "id"> = {
  title: "",
  description: "",
  location: "",
  price: "",
  images: [],
  status: "draft"
};

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data as T;
}

export default function App() {
  const isAdminRoute = window.location.pathname.startsWith("/admin");

  return isAdminRoute ? <AdminDashboard /> : <PublicGallery />;
}

function PublicGallery() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Project[]>("/projects")
      .then(setProjects)
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <main className="page">
      <header className="site-header">
        <a className="brand" href="/">Agency</a>
        <a className="admin-link" href="/admin">Admin</a>
      </header>

      <section className="hero">
        <p className="eyebrow">Real estate projects</p>
        <h1>Find a place to call home.</h1>
        <p>Explore our latest residential and commercial projects.</p>
      </section>

      {error && <p className="notice">{error}</p>}

      <section className="project-grid" aria-label="Available projects">
        {projects.map((project) => (
          <article className="project-card" key={project.id}>
            {project.images[0] ? (
              <img src={project.images[0]} alt={project.title} />
            ) : (
              <div className="image-placeholder">Project image</div>
            )}
            <div className="project-content">
              <p className="eyebrow">{project.location}</p>
              <h2>{project.title}</h2>
              <p>{project.description}</p>
              {project.price && <strong>{project.price}</strong>}
            </div>
          </article>
        ))}
      </section>

      {!error && projects.length === 0 && (
        <p className="empty-state">No published projects yet.</p>
      )}
    </main>
  );
}

function AdminDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProject);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadProjects() {
    const result = await api<Project[]>("/admin/projects");
    setProjects(result);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const formData = new FormData(event.currentTarget);

    try {
      await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password")
        })
      });

      setAuthenticated(true);
      await loadProjects();
    } catch (reason) {
      setMessage((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    const payload = {
      ...form,
      images: form.images
    };

    try {
      if (editingId) {
        await api(`/projects/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        await api("/projects", {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      setForm(emptyProject);
      setEditingId(null);
      await loadProjects();
      setMessage("Project saved.");
    } catch (reason) {
      setMessage((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this project?")) return;

    try {
      await api(`/projects/${id}`, { method: "DELETE" });
      await loadProjects();
      setMessage("Project deleted.");
    } catch (reason) {
      setMessage((reason as Error).message);
    }
  }

  async function handleLogout() {
    await api("/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setProjects([]);
  }

  function startEditing(project: Project) {
    setEditingId(project.id);
    setForm({
      title: project.title,
      description: project.description,
      location: project.location,
      price: project.price,
      images: project.images,
      status: project.status
    });
  }

  if (!authenticated) {
    return (
      <main className="admin-page">
        <form className="panel login-panel" onSubmit={handleLogin}>
          <a className="brand" href="/">Agency</a>
          <h1>Admin sign in</h1>
          <label>
            Username
            <input name="username" autoComplete="username" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {message && <p className="notice">{message}</p>}
          <button disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <a className="brand" href="/">Agency</a>
          <p>Project management</p>
        </div>
        <button className="secondary-button" onClick={handleLogout}>
          Sign out
        </button>
      </header>

      <div className="admin-layout">
        <form className="panel project-form" onSubmit={handleSave}>
          <h1>{editingId ? "Edit project" : "Add a project"}</h1>

          <label>
            Project title
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              required
            />
          </label>

          <label>
            Location
            <input
              value={form.location}
              onChange={(event) =>
                setForm({ ...form, location: event.target.value })
              }
              required
            />
          </label>

          <label>
            Price
            <input
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: event.target.value })
              }
              placeholder="Optional"
            />
          </label>

          <label>
            Description
            <textarea
              rows={5}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              required
            />
          </label>

          <label>
            Image URLs, one per line
            <textarea
              rows={3}
              value={form.images.join("\n")}
              onChange={(event) =>
                setForm({
                  ...form,
                  images: event.target.value
                    .split("\n")
                    .map((url) => url.trim())
                    .filter(Boolean)
                })
              }
              placeholder="https://..."
            />
          </label>

          <label>
            Visibility
            <select
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as Project["status"]
                })
              }
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>

          <button disabled={busy}>
            {busy ? "Saving..." : editingId ? "Update project" : "Add project"}
          </button>

          {editingId && (
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyProject);
              }}
            >
              Cancel edit
            </button>
          )}

          {message && <p className="notice">{message}</p>}
        </form>

        <section className="panel">
          <h2>Projects ({projects.length})</h2>
          <div className="admin-project-list">
            {projects.map((project) => (
              <article className="admin-project" key={project.id}>
                <div>
                  <strong>{project.title}</strong>
                  <p>{project.location} · {project.status}</p>
                </div>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    onClick={() => startEditing(project)}
                  >
                    Edit
                  </button>
                  <button
                    className="danger-button"
                    onClick={() => handleDelete(project.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
