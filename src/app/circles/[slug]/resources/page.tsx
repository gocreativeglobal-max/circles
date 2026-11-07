import { redirect } from 'next/navigation';

export default function CircleResourcesRedirectPage({
  params,
}: {
  params: { slug: string };
}) {
  redirect(`/circles/${params.slug}/discussions?view=resources`);
}
