export interface Category {
  name: string;
  description: string;
  keywords: string[];
}

export interface CategoryPlan {
  categories: Category[];
}

export interface ClassificationResult {
  categories: string[];
  reason: string;
}

export interface RepoSummary {
  owner: string;
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
}

export interface RepoDetail extends RepoSummary {
  readme: string | null;
}

export interface CreatedList {
  id: string;
  name: string;
  description: string | null;
}
