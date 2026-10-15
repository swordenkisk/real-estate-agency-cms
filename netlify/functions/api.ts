import type { Handler } from "@netlify/functions";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";

type ProjectStatus = "draft" | "published";

type ProjectInput = {
  title: string;
  description: string;
  location: string;
  price: string;
  images: string[];
  status: ProjectStatus;
};

type ProjectDocument = ProjectInput & {
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

let cachedClient: MongoClient | undefined;

function getDatabase() {
  const uri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DATABASE;

  if (!uri || !databaseName) {
    throw new Error("Missing MongoDB environment variables.");
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
  }

  return cachedClient.connect().then((client) => client.db(databaseName));
}

function getRoutePath(eventPath: string, rawUrl: string): string {
  const candidates = [eventPath, new URL(rawUrl).pathname];

  for (const candidate of candidates) {
    if (candidate.includes("/.netlify/functions/api")) {
      return candidate.split("/.netlify/functions/api")[1] || "/";
    }

    if (candidate.startsWith("/api")) {
      return candidate.slice(4) || "/";
    }
  }

  return candidates[0] || "/";
}

function response(
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {}
) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

function parseBody(body: string | null): Record<string, unknown> {
  if (!body) return {};
  return JSON.parse(body) as Record<string, unknown>;
}

function normalizeProject(input: Record<string, unknown>): ProjectInput {
  const title = String(input.title ?? "").trim();
  const description = String(input.description ?? "").trim();
  const location = String(input.location ?? "").trim();
  const price = String(input.price ?? "").trim();

  const images = Array.isArray(input.images)
    ? input.images
        .map((image) => String(image).trim())
        .filter((image) => image.startsWith("https://"))
    : [];

  const status: ProjectStatus =
    input.status === "published" ? "published" : "draft";

  if (!title || !description || !location) {
    throw new Error("Title, description, and location are required.");
  }

  return { title, description, location, price, images, status };
}

function makeSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getCookie(
  cookieHeader: string | undefined,
  name: string
): string | undefined {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function isAdmin(event: Parameters<Handler>[0]): boolean {
  const secret = process.env.JWT_SECRET;
  const token = getCookie(event.headers.cookie, "admin_session");

  if (!secret || !token) return false;

  try {
    jwt.verify(token, secret);
    return true;
  } catch {
    return false;
  }
}

function sessionCookie(token: string, maxAge: number): string {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";

  return `admin_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge};${secure}`;
}

export const handler: Handler = async (event) => {
  const method = event.httpMethod;
  const route = getRoutePath(event.path, event.rawUrl);
  const segments = route.split("/").filter(Boolean);

  try {
    if (method === "OPTIONS") {
      return response(204, {});
    }

    if (method === "POST" && route === "/auth/login") {
      const username = process.env.ADMIN_USERNAME;
      const passwordHash = process.env.ADMIN_PASSWORD_HASH;
      const jwtSecret = process.env.JWT_SECRET;

      if (!username || !passwordHash || !jwtSecret) {
        return response(500, { error: "Admin environment is not configured." });
      }

      const body = parseBody(event.body);
      const submittedUsername = String(body.username ?? "");
      const submittedPassword = String(body.password ?? "");

      const validUsername = submittedUsername === username;
      const validPassword = await bcrypt.compare(
        submittedPassword,
        passwordHash
      );

      if (!validUsername || !validPassword) {
        return response(401, { error: "Invalid username or password." });
      }

      const token = jwt.sign({ role: "admin" }, jwtSecret, {
        expiresIn: "8h"
      });

      return response(
        200,
        { authenticated: true },
        { "Set-Cookie": sessionCookie(token, 8 * 60 * 60) }
      );
    }

    if (method === "POST" && route === "/auth/logout") {
      return response(
        200,
        { authenticated: false },
        { "Set-Cookie": sessionCookie("", 0) }
      );
    }

    if (method === "GET" && route === "/projects") {
      const database = await getDatabase();
      const projects = await database
        .collection<ProjectDocument>("projects")
        .find({ status: "published" })
        .sort({ createdAt: -1 })
        .toArray();

      return response(
        200,
        projects.map((project) => ({
          ...project,
          id: project._id.toString(),
          _id: undefined
        }))
      );
    }

    if (!isAdmin(event)) {
      return response(401, { error: "Authentication required." });
    }

    const database = await getDatabase();
    const collection = database.collection<ProjectDocument>("projects");

    if (method === "GET" && route === "/admin/projects") {
      const projects = await collection.find().sort({ updatedAt: -1 }).toArray();

      return response(
        200,
        projects.map((project) => ({
          ...project,
          id: project._id.toString(),
          _id: undefined
        }))
      );
    }

    if (method === "POST" && route === "/projects") {
      const input = normalizeProject(parseBody(event.body));
      const now = new Date();

      const project: ProjectDocument = {
        ...input,
        slug: makeSlug(input.title),
        createdAt: now,
        updatedAt: now
      };

      const result = await collection.insertOne(project);

      return response(201, {
        ...project,
        id: result.insertedId.toString()
      });
    }

    if (segments[0] === "projects" && segments[1]) {
      if (!ObjectId.isValid(segments[1])) {
        return response(400, { error: "Invalid project ID." });
      }

      const id = new ObjectId(segments[1]);

      if (method === "PUT") {
        const input = normalizeProject(parseBody(event.body));
        const result = await collection.findOneAndUpdate(
          { _id: id },
          {
            $set: {
              ...input,
              slug: makeSlug(input.title),
              updatedAt: new Date()
            }
          },
          { returnDocument: "after" }
        );

        if (!result) {
          return response(404, { error: "Project not found." });
        }

        return response(200, {
          ...result,
          id: result._id.toString(),
          _id: undefined
        });
      }

      if (method === "DELETE") {
        const result = await collection.deleteOne({ _id: id });

        return result.deletedCount
          ? response(200, { deleted: true })
          : response(404, { error: "Project not found." });
      }
    }

    return response(404, { error: "Route not found." });
  } catch (error) {
    console.error("API error:", error);

    return response(500, {
      error:
        error instanceof Error ? error.message : "Unexpected server error."
    });
  }
};
