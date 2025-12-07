import type { FormattedResponse, FormattedGitHubList, GitHubList } from "./types";

/**
 * Fetches all GitHub lists and their repositories for a given user
 */
export async function fetchGitHubLists(
  username: string,
  token: string,
): Promise<FormattedResponse> {
  if (!username) {
    throw new Error("Missing GitHub username parameter");
  }

  if (!token) {
    throw new Error("Missing GitHub token parameter");
  }

  const query = `
    query {
      user(login: "${username}") {
        lists(first: 100) {
          totalCount
          nodes {
            id
            name
            description
            isPrivate
            lastAddedAt
            slug
            createdAt
            updatedAt
            items(first: 100) {
              totalCount
              nodes {
                __typename
                ... on Repository {
                  name
                  url
                  isPrivate
                  description
                  stargazerCount
                  owner { login }
                }
              }
            }
          }
        }
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

  if (!data.data?.user?.lists) {
    throw new Error("GitHub API returned unexpected data structure");
  }

  const formattedData: FormattedResponse = {
    username,
    totalLists: data.data.user.lists.totalCount,
    lists: data.data.user.lists.nodes.map((list: GitHubList) => {
      return {
        id: list.id,
        name: list.name,
        description: list.description,
        isPrivate: list.isPrivate,
        slug: list.slug,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
        lastAddedAt: list.lastAddedAt,
        totalRepositories: list.items.totalCount,
        repositories: list.items.nodes
          .filter((item) => item.__typename === "Repository")
          .map((repo) => {
            return {
              name: repo.name,
              url: repo.url,
              isPrivate: repo.isPrivate,
              description: repo.description,
              stars: repo.stargazerCount,
              owner: repo.owner.login,
            };
          }),
      };
    }),
  };

  return formattedData;
}

/**
 * Creates a new GitHub user list
 */
export async function createGitHubList(
  token: string,
  name: string,
  description?: string,
  isPrivate: boolean = true,
): Promise<any> {
  if (!token) {
    throw new Error("Missing GitHub token parameter");
  }

  const mutation = `
    mutation {
      createUserList(input: {
        name: "${name}",
        description: ${description ? `"${description}"` : "null"},
        isPrivate: ${isPrivate}
      }) {
        list {
          id
          name
          description
          isPrivate
          slug
          createdAt
          updatedAt
        }
        viewer {
          login
        }
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
    body: JSON.stringify({ query: mutation }),
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

  return data.data.createUserList;
}

/**
 * Updates an existing GitHub user list
 */
export async function updateGitHubList(
  token: string,
  listId: string,
  name?: string,
  description?: string,
  isPrivate?: boolean,
): Promise<any> {
  if (!token) {
    throw new Error("Missing GitHub token parameter");
  }

  if (!listId) {
    throw new Error("Missing list ID parameter");
  }

  const inputParams: string[] = [];
  if (name !== undefined) inputParams.push(`name: "${name}"`);
  if (description !== undefined)
    inputParams.push(
      `description: ${description ? `"${description}"` : "null"}`,
    );
  if (isPrivate !== undefined) inputParams.push(`isPrivate: ${isPrivate}`);

  const mutation = `
    mutation {
      updateUserList(input: {
        listId: "${listId}",
        ${inputParams.join(",")}
      }) {
        list {
          id
          name
          description
          isPrivate
          slug
          updatedAt
        }
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
    body: JSON.stringify({ query: mutation }),
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

  return data.data.updateUserList;
}

/**
 * Deletes a GitHub user list
 */
export async function deleteGitHubList(
  token: string,
  listId: string,
): Promise<any> {
  if (!token) {
    throw new Error("Missing GitHub token parameter");
  }

  if (!listId) {
    throw new Error("Missing list ID parameter");
  }

  const mutation = `
    mutation {
      deleteUserList(input: {
        listId: "${listId}"
      }) {
        user {
          login
        }
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
    body: JSON.stringify({ query: mutation }),
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

  return data.data.deleteUserList;
}

/**
 * Adds a repository to one or more GitHub lists
 */
export async function addRepoToGitHubLists(
  token: string,
  repositoryId: string,
  listIds: string[],
): Promise<any> {
  if (!token) {
    throw new Error("Missing GitHub token parameter");
  }

  if (!repositoryId) {
    throw new Error("Missing repository ID parameter");
  }

  if (!listIds || listIds.length === 0) {
    throw new Error("Missing list IDs parameter");
  }

  const mutation = `
    mutation {
      updateUserListsForItem(input: {
        itemId: "${repositoryId}",
        listIds: [${listIds.map((id) => `"${id}"`).join(", ")}]
      }) {
        lists {
          id
          name
          description
        }
        item {
          ... on Repository {
            name
            url
            isPrivate
            description
            stargazerCount
            owner {
              login
            }
          }
        }
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
    body: JSON.stringify({ query: mutation }),
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

  return data.data.updateUserListsForItem;
}

/**
 * Removes a repository from one or more GitHub lists
 */
export async function removeRepoFromGitHubLists(
  token: string,
  repositoryId: string,
  currentListIds: string[],
  listsToRemoveFrom: string[],
): Promise<any> {
  if (!token) {
    throw new Error("Missing GitHub token parameter");
  }

  if (!repositoryId) {
    throw new Error("Missing repository ID parameter");
  }

  if (!currentListIds || !listsToRemoveFrom) {
    throw new Error("Missing list IDs parameters");
  }

  const updatedListIds = currentListIds.filter(
    (id) => !listsToRemoveFrom.includes(id),
  );

  const mutation = `
    mutation {
      updateUserListsForItem(input: {
        itemId: "${repositoryId}",
        listIds: [${updatedListIds.map((id) => `"${id}"`).join(", ")}]
      }) {
        lists {
          id
          name
          description
        }
        item {
          ... on Repository {
            name
            url
          }
        }
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
    body: JSON.stringify({ query: mutation }),
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

  return data.data.updateUserListsForItem;
}

/**
 * Removes a repository from ALL lists (sets listIds to empty)
 */
export async function removeRepoFromAllLists(
  token: string,
  repositoryId: string,
): Promise<any> {
  if (!token) {
    throw new Error("Missing GitHub token parameter");
  }

  if (!repositoryId) {
    throw new Error("Missing repository ID parameter");
  }

  const mutation = `
    mutation {
      updateUserListsForItem(input: {
        itemId: "${repositoryId}",
        listIds: []
      }) {
        lists {
          id
          name
        }
        item {
          ... on Repository {
            name
            url
          }
        }
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
    body: JSON.stringify({ query: mutation }),
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

  return data.data.updateUserListsForItem;
}

export type DeleteProgressCallback = (deleted: number, total: number) => void;

/**
 * Fetches all GitHub lists and deletes them one by one
 */
export async function deleteAllGitHubLists(
  username: string,
  token: string,
  onProgress?: DeleteProgressCallback,
): Promise<number> {
  const lists = await fetchGitHubLists(username, token);
  let deletedCount = 0;
  const total = lists.lists.length;

  for (const list of lists.lists) {
    try {
      await deleteGitHubList(token, list.id);
      deletedCount++;
      onProgress?.(deletedCount, total);
    } catch (error) {
      console.error(`Failed to delete list "${list.name}":`, error);
    }
  }

  return deletedCount;
}
