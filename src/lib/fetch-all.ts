/**
 * Supabase/PostgREST caps responses (1000 rows by default on hosted projects).
 * Any client-side aggregation over "all rows" must page explicitly, otherwise
 * totals silently stop updating after the first page.
 */
export const SUPABASE_PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<{ data: T[]; error: string | null }> {
  const all: T[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await fetchPage(offset, offset + SUPABASE_PAGE_SIZE - 1);
    if (error) {
      return { data: all, error: error.message };
    }
    if (!data || data.length === 0) {
      break;
    }
    all.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) {
      break;
    }
    offset += SUPABASE_PAGE_SIZE;
  }

  return { data: all, error: null };
}
