/**
 * Generate a SoftwareApplication JSON-LD schema for product review posts.
 * Per the prior SEO audit, review posts lacked SoftwareApplication schema
 * (L4 fix). This generator extracts the product name from the title (which
 * uses the "Product – Tagline" convention) and emits a minimal but valid
 * SoftwareApplication block.
 */

interface PostForSchema {
  title: string;
  description?: string;
  image?: { url: string; alt: string };
  pubDate: Date | string;
}

interface SoftwareAppOptions {
  siteUrl: string;
  postSlug: string;
}

/**
 * Extract the product name from a title of the form "Product – Tagline".
 * Returns the full title if no separator is found.
 */
export function extractProductName(title: string): string {
  // Common separators: en-dash, em-dash, hyphen, colon
  const separators = [' – ', ' — ', ' - ', ': '];
  for (const sep of separators) {
    const idx = title.indexOf(sep);
    if (idx > 0) {
      return title.slice(0, idx).trim();
    }
  }
  return title.trim();
}

const formatDate = (d: any) => {
  if (!d) return undefined;
  if (typeof d === 'string') return new Date(d).toISOString();
  if (d instanceof Date) return d.toISOString();
  return undefined;
};

export function buildSoftwareApplicationJsonLd(
  post: PostForSchema,
  options: SoftwareAppOptions
) {
  const productName = extractProductName(post.title);
  const imageUrl = post.image?.url;
  const fullImageUrl = imageUrl
    ? imageUrl.startsWith('http')
      ? imageUrl
      : `${options.siteUrl}${imageUrl}`
    : undefined;
  const postUrl = `${options.siteUrl}/blog/${options.postSlug}/`;
  const datePublished = formatDate(post.pubDate);

  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: productName,
    description: post.description,
    url: postUrl,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
  };

  if (fullImageUrl) {
    jsonLd.image = fullImageUrl;
  }
  if (datePublished) {
    jsonLd.datePublished = datePublished;
  }

  return jsonLd;
}
