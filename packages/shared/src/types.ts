export interface PostFrontmatter {
  title: string;
  image?: { url: string; alt: string };
  date: string;
  slug: string;
  excerpt?: string;
  category?: string;
  tags?: string[];
  author?: string;
  published?: boolean;
}

export interface Post extends PostFrontmatter {
  content: string;
}

export interface PostSummary extends PostFrontmatter {}

export interface RelatedPosts {
  posts: PostSummary[];
}

export interface Categories {
  [category: string]: number;
}

export interface Tags {
  [tag: string]: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PublishPayload {
  title: string;
  slug: string;
  content: string;
  frontmatter?: Partial<PostFrontmatter>;
}
