import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CircleJobsPage({
  params,
}: {
  params: { slug: string };
}) {
  // Consolidate legacy standalone jobs into universal marketplace board
  redirect(`/circles/${params.slug}/marketplace?category=jobs`);
}
