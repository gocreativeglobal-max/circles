import { redirect } from 'next/navigation';

export default function CirclePollsRedirectPage({
  params,
}: {
  params: { slug: string };
}) {
  redirect(`/circles/${params.slug}/discussions`);
}
