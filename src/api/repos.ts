import type { Repo } from "./types";

export type ProgressCallback = (current: number, message?: string) => void;

/**
 * Fetches all repositories owned by the authenticated user
 */
export async function fetchAllMyRepos(
  token: string,
  owner: string,
  onProgress?: ProgressCallback,
): Promise<{ repos?: Repo[]; status: number }> {
  const allRepos: Repo[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `https://api.github.com/user/repos?page=${page}&per_page=100&sort=updated`,
      {
        headers: {
          "User-Agent": "Stardust-CLI",
          Authorization: `token ${token}`,
        },
      },
    );

    if (!response.ok) {
      console.log("notok", await response.text());
      return { status: response.status };
    }

    const newRepos: Repo[] = await response.json();
    allRepos.push(...newRepos);

    onProgress?.(allRepos.length);

    if (newRepos.length < 100) {
      break;
    }
    page++;
  }

  return { status: 200, repos: allRepos };
}

/**
 * Fetches all starred repositories for the authenticated user
 */
export async function fetchAllMyStarredRepos(
  token: string,
  owner: string,
  onProgress?: ProgressCallback,
): Promise<{ repos?: Repo[]; status: number }> {
  const allRepos: Repo[] = [];
  let page = 1;

  while (true) {
    const response = await fetch(
      `https://api.github.com/user/starred?page=${page}&per_page=100&sort=updated`,
      {
        headers: {
          "User-Agent": "Stardust-CLI",
          Authorization: `token ${token}`,
        },
      },
    );

    if (!response.ok) {
      console.log("notok", await response.text());
      return { status: response.status };
    }

    const newRepos: Repo[] = await response.json();
    allRepos.push(...newRepos);

    onProgress?.(allRepos.length);

    if (newRepos.length < 100) {
      break;
    }
    page++;
  }

  return { status: 200, repos: allRepos };
}

/**
 * Gets the Node ID for a repository (needed for list operations)
 */
export async function getRepositoryNodeId(
  token: string,
  owner: string,
  name: string,
): Promise<string> {
  if (!token) {
    throw new Error("Missing GitHub token parameter");
  }

  if (!owner || !name) {
    throw new Error("Missing repository owner or name parameter");
  }

  const query = `
    query {
      repository(owner: "${owner}", name: "${name}") {
        id
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "User-Agent": "Stardust-CLI",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub API request failed (${response.status}): ${errorText}`,
    );
  }

  const data = await response.json();

  if (data.errors) {
    throw new Error(JSON.stringify(data.errors));
  }

  if (!data.data?.repository?.id) {
    throw new Error("Repository not found or ID not available");
  }

  return data.data.repository.id;
}
