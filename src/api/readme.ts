/**
 * Fetches the README content for a repository
 */
export async function fetchRepositoryReadme(
  token: string,
  owner: string,
  name: string,
): Promise<string | null> {
  if (!token) {
    throw new Error("Missing GitHub token parameter");
  }

  if (!owner || !name) {
    throw new Error("Missing repository owner or name parameter");
  }

  try {
    const readmeVariants = [
      "HEAD:README.md",
      "HEAD:readme.md",
      "HEAD:README.MD",
      "HEAD:Readme.md",
      "HEAD:README",
      "HEAD:readme",
    ];

    const query = `
      query {
        repository(owner: "${owner}", name: "${name}") {
          ${readmeVariants
            .map(
              (variant, i) => `
            readme${i}: object(expression: "${variant}") {
              ... on Blob {
                text
              }
            }
          `,
            )
            .join("\n")}
        }
      }
    `;

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "User-Agent": "GitHub-Stars-Arrange",
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
      console.warn("Warning fetching README:", JSON.stringify(data.errors));
      return null;
    }

    const repo = data.data?.repository;
    if (!repo) {
      return null;
    }

    for (let i = 0; i < readmeVariants.length; i++) {
      const readme = repo[`readme${i}`];
      if (readme?.text) {
        return readme.text;
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching repository README:", error);
    return null;
  }
}
