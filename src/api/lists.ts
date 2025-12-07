import { graphql } from "./client";
import type { FormattedResponse, GitHubListItem } from "./types";

// GraphQL response types - ListsOnlyResponse used for paginated list fetching
interface ListsOnlyResponse {
  user: {
    lists: {
      totalCount: number;
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: Array<{
        id: string;
        name: string;
        description: string | null;
        isPrivate: boolean;
        lastAddedAt: string | null;
        slug: string;
        createdAt: string;
        updatedAt: string;
        items: { totalCount: number };
      }>;
    };
  } | null;
}

interface ListItemsResponse {
  node: {
    items: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: Array<{
        __typename: string;
        name?: string;
        url?: string;
        isPrivate?: boolean;
        description?: string | null;
        stargazerCount?: number;
        owner?: { login: string };
      }>;
    };
  } | null;
}

type ListNode = NonNullable<ListsOnlyResponse["user"]>["lists"]["nodes"][number];
type ListItemNode = NonNullable<ListItemsResponse["node"]>["items"]["nodes"][number];

interface CreateListResponse {
  createUserList: {
    list: {
      id: string;
      name: string;
      description: string | null;
      isPrivate: boolean;
      slug: string;
      createdAt: string;
      updatedAt: string;
    };
    viewer: { login: string };
  };
}

interface UpdateListResponse {
  updateUserList: {
    list: {
      id: string;
      name: string;
      description: string | null;
      isPrivate: boolean;
      slug: string;
      updatedAt: string;
    };
  };
}

interface DeleteListResponse {
  deleteUserList: {
    user: { login: string };
  };
}

interface UpdateUserListsForItemResponse {
  updateUserListsForItem: {
    lists: Array<{
      id: string;
      name: string;
      description: string | null;
    }>;
    item: {
      name: string;
      url: string;
      isPrivate?: boolean;
      description?: string | null;
      stargazerCount?: number;
      owner?: { login: string };
    };
  };
}

/**
 * Fetches all GitHub lists and their repositories for a given user
 * Uses pagination to avoid GraphQL resource limits
 */
export async function fetchGitHubLists(
  username: string,
  token: string,
): Promise<FormattedResponse> {
  if (!username) {
    throw new Error("Missing GitHub username parameter");
  }

  // First, fetch just the lists (without items) to avoid resource limits
  const listsQuery = `
    query FetchUserLists($username: String!, $cursor: String) {
      user(login: $username) {
        lists(first: 20, after: $cursor) {
          totalCount
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            name
            description
            isPrivate
            lastAddedAt
            slug
            createdAt
            updatedAt
            items(first: 0) {
              totalCount
            }
          }
        }
      }
    }
  `;

  // Fetch all lists with pagination
  const allLists: ListNode[] = [];
  let cursor: string | null = null;
  let totalCount = 0;

  let hasNextPage = true;
  while (hasNextPage) {
    const data: ListsOnlyResponse = await graphql<ListsOnlyResponse>(token, listsQuery, {
      username,
      cursor,
    });

    if (!data.user?.lists) {
      throw new Error("GitHub API returned unexpected data structure");
    }

    totalCount = data.user.lists.totalCount;
    allLists.push(...data.user.lists.nodes);

    hasNextPage = data.user.lists.pageInfo.hasNextPage;
    cursor = data.user.lists.pageInfo.endCursor;
  }

  // Fetch items for each list individually to avoid resource limits
  const itemsQuery = `
    query FetchListItems($listId: ID!, $cursor: String) {
      node(id: $listId) {
        ... on UserList {
          items(first: 50, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
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
  `;

  const formattedLists = await Promise.all(
    allLists.map(async (list: ListNode) => {
      const allItems: ListItemNode[] = [];
      let itemCursor: string | null = null;
      let hasMoreItems = true;

      while (hasMoreItems) {
        const itemsData: ListItemsResponse = await graphql<ListItemsResponse>(token, itemsQuery, {
          listId: list.id,
          cursor: itemCursor,
        });

        if (itemsData.node?.items) {
          allItems.push(...itemsData.node.items.nodes);
          hasMoreItems = itemsData.node.items.pageInfo.hasNextPage;
          itemCursor = itemsData.node.items.pageInfo.endCursor;
        } else {
          hasMoreItems = false;
        }
      }

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
        repositories: allItems
          .filter((item): item is GitHubListItem => item.__typename === "Repository")
          .map((repo) => ({
            name: repo.name,
            url: repo.url,
            isPrivate: repo.isPrivate,
            description: repo.description,
            stars: repo.stargazerCount,
            owner: repo.owner.login,
          })),
      };
    }),
  );

  return {
    username,
    totalLists: totalCount,
    lists: formattedLists,
  };
}

/**
 * Creates a new GitHub user list
 */
export async function createGitHubList(
  token: string,
  name: string,
  description?: string,
  isPrivate: boolean = true,
): Promise<CreateListResponse["createUserList"]> {
  const mutation = `
    mutation CreateUserList($name: String!, $description: String, $isPrivate: Boolean!) {
      createUserList(input: {
        name: $name,
        description: $description,
        isPrivate: $isPrivate
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

  const data = await graphql<CreateListResponse>(token, mutation, {
    name,
    description: description || null,
    isPrivate,
  });

  return data.createUserList;
}

/**
 * Updates an existing GitHub user list
 */
export async function updateGitHubList(
  token: string,
  listId: string,
  updates: {
    name?: string;
    description?: string | null;
    isPrivate?: boolean;
  },
): Promise<UpdateListResponse["updateUserList"]> {
  if (!listId) {
    throw new Error("Missing list ID parameter");
  }

  const mutation = `
    mutation UpdateUserList($listId: ID!, $name: String, $description: String, $isPrivate: Boolean) {
      updateUserList(input: {
        listId: $listId,
        name: $name,
        description: $description,
        isPrivate: $isPrivate
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

  const data = await graphql<UpdateListResponse>(token, mutation, {
    listId,
    name: updates.name,
    description: updates.description,
    isPrivate: updates.isPrivate,
  });

  return data.updateUserList;
}

/**
 * Deletes a GitHub user list
 */
export async function deleteGitHubList(
  token: string,
  listId: string,
): Promise<DeleteListResponse["deleteUserList"]> {
  if (!listId) {
    throw new Error("Missing list ID parameter");
  }

  const mutation = `
    mutation DeleteUserList($listId: ID!) {
      deleteUserList(input: {
        listId: $listId
      }) {
        user {
          login
        }
      }
    }
  `;

  const data = await graphql<DeleteListResponse>(token, mutation, { listId });
  return data.deleteUserList;
}

/**
 * Adds a repository to one or more GitHub lists
 */
export async function addRepoToGitHubLists(
  token: string,
  repositoryId: string,
  listIds: string[],
): Promise<UpdateUserListsForItemResponse["updateUserListsForItem"]> {
  if (!repositoryId) {
    throw new Error("Missing repository ID parameter");
  }

  if (!listIds || listIds.length === 0) {
    throw new Error("Missing list IDs parameter");
  }

  const mutation = `
    mutation AddRepoToLists($itemId: ID!, $listIds: [ID!]!) {
      updateUserListsForItem(input: {
        itemId: $itemId,
        listIds: $listIds
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
            owner { login }
          }
        }
      }
    }
  `;

  const data = await graphql<UpdateUserListsForItemResponse>(token, mutation, {
    itemId: repositoryId,
    listIds,
  });

  return data.updateUserListsForItem;
}

/**
 * Removes a repository from one or more GitHub lists
 */
export async function removeRepoFromGitHubLists(
  token: string,
  repositoryId: string,
  currentListIds: string[],
  listsToRemoveFrom: string[],
): Promise<UpdateUserListsForItemResponse["updateUserListsForItem"]> {
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
    mutation RemoveRepoFromLists($itemId: ID!, $listIds: [ID!]!) {
      updateUserListsForItem(input: {
        itemId: $itemId,
        listIds: $listIds
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

  const data = await graphql<UpdateUserListsForItemResponse>(token, mutation, {
    itemId: repositoryId,
    listIds: updatedListIds,
  });

  return data.updateUserListsForItem;
}

/**
 * Removes a repository from ALL lists (sets listIds to empty)
 */
export async function removeRepoFromAllLists(
  token: string,
  repositoryId: string,
): Promise<UpdateUserListsForItemResponse["updateUserListsForItem"]> {
  if (!repositoryId) {
    throw new Error("Missing repository ID parameter");
  }

  const mutation = `
    mutation RemoveRepoFromAllLists($itemId: ID!) {
      updateUserListsForItem(input: {
        itemId: $itemId,
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

  const data = await graphql<UpdateUserListsForItemResponse>(token, mutation, {
    itemId: repositoryId,
  });

  return data.updateUserListsForItem;
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
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to delete list "${list.name}": ${message}`);
    }
  }

  return deletedCount;
}
