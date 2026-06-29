export const PAGE_SIZE = 10;

export function getPagination(searchParams: { page?: string | string[]; q?: string | string[] }) {
  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const page = Math.max(1, Number(rawPage) || 1);
  const q = ((Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q) ?? "").trim();
  return { page, q, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE };
}

export function buildPageHref(pathname: string, page: number, q: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
