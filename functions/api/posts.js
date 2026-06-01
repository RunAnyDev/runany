export async function onRequest({ request, env }) {
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '6', 10)));
  const tag = url.searchParams.get('tag') || null;
  const category = url.searchParams.get('category') || null;

  const indexUrl = new URL('/api/posts-index.json', request.url);
  const indexRes = await env.ASSETS.fetch(indexUrl);

  if (!indexRes.ok) {
    return new Response(JSON.stringify({ error: 'Index not found' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let posts = await indexRes.json();

  // Filter
  if (tag) {
    const t = tag.toLowerCase();
    posts = posts.filter((p) => p.tags.some((tt) => tt.toLowerCase() === t));
  }
  if (category) {
    const c = category.toLowerCase();
    posts = posts.filter((p) => p.category.toLowerCase() === c);
  }

  const total = posts.length;
  const start = (page - 1) * limit;
  const pagePosts = posts.slice(start, start + limit);

  return new Response(
    JSON.stringify({
      posts: pagePosts,
      total,
      page,
      limit,
      hasMore: start + limit < total,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
