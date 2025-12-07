// GitHub API Types

export interface GitHubListItem {
  __typename: string;
  name: string;
  url: string;
  isPrivate: boolean;
  description: string | null;
  stargazerCount: number;
  owner: { login: string };
}

export interface GitHubList {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  lastAddedAt: string | null;
  slug: string;
  createdAt: string;
  updatedAt: string;
  items: {
    totalCount: number;
    nodes: GitHubListItem[];
  };
}

export interface FormattedGitHubList {
  id: string;
  name: string;
  description: string | null;
  isPrivate: boolean;
  slug: string;
  createdAt: string;
  updatedAt: string;
  lastAddedAt: string | null;
  totalRepositories: number;
  repositories: {
    name: string;
    url: string;
    isPrivate: boolean;
    description: string | null;
    stars: number;
    owner: string;
  }[];
}

export interface FormattedResponse {
  username: string;
  totalLists: number;
  lists: FormattedGitHubList[];
}

export interface Repo {
  id: number;
  name: string;
  owner: { login: string; id: number };
  description: string;
  html_url: string;
  stargazers_count: number;
  language: string | null;
  private: boolean;
}
