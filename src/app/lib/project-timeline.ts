/** Date-only project plans use calendar days, independent of the viewer's timezone. */
export function projectTimeline(project: { startDate?: string | null; endDate?: string | null; status: string }, now = new Date()) {
  const day = (value?: string | null) => {
    if (!value) return null;
    const result = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isFinite(result) ? Math.floor(result / 86400000) : null;
  };
  const today = day(now.toISOString())!, start = day(project.startDate), end = day(project.endDate);
  const closed = ['COMPLETED', 'CANCELLED'].includes(project.status);
  return {
    elapsed: start === null || closed ? null : Math.max(0, today - start),
    remaining: end === null || closed ? null : end - today,
    overdue: !closed && end !== null && end < today,
    scheduled: start !== null && start > today,
  };
}
