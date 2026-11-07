import { describe, expect, it } from 'vitest';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { createComment, createPost, saveItem, toggleReaction } from '@/features/discussions/service';
import { getGlobalFeedData } from '@/features/feed/service';
import { joinPublicCircle } from '@/features/memberships/service';

describe('Global Social Community Newsfeed & Public Post Interactions', () => {
  it('Surfaces public Circle posts to guests and users, isolates private Circles, and allows non-members to Like/Save public posts while requiring membership to Comment', async () => {
    const suffix = Date.now();

    const { user: publicOwner } = await registerUser({
      email: `feed-owner-${suffix}@example.com`,
      username: `feed_owner_${suffix}`,
      displayName: 'Public Creator',
      password: 'Password123!',
    });

    const { user: privateOwner } = await registerUser({
      email: `priv-owner-${suffix}@example.com`,
      username: `priv_owner_${suffix}`,
      displayName: 'Private Owner',
      password: 'Password123!',
    });

    const { user: visitorUser } = await registerUser({
      email: `visitor-user-${suffix}@example.com`,
      username: `visitor_${suffix}`,
      displayName: 'Curious Reader',
      password: 'Password123!',
    });

    // 1. Create a Public Circle and a Private Circle
    const publicCircle = await createCircle(publicOwner.id, {
      name: `AI Builders Hub ${suffix}`,
      visibility: 'public',
      membershipPolicy: 'open',
      category: 'creator',
    });

    const privateCircle = await createCircle(privateOwner.id, {
      name: `Secret Guild ${suffix}`,
      visibility: 'private',
      membershipPolicy: 'invite_only',
      category: 'professional',
    });

    // 2. Publish a post in each Circle
    const publicPost = await createPost(publicOwner.id, {
      circleId: publicCircle.id,
      title: 'Welcome to AI Builders Hub!',
      body: 'Sharing our weekly open source agent benchmarks.',
    });

    const privatePost = await createPost(privateOwner.id, {
      circleId: privateCircle.id,
      title: 'Confidential Guild Roadmap',
      body: 'Internal members only.',
    });

    // 3. Anonymous guest feed sees the public post, NOT the private post
    const guestFeed = await getGlobalFeedData(null, { limit: 30 });
    const guestPostIds = guestFeed.items
      .filter((i) => i.itemType === 'post')
      .map((i) => i.data.id);

    expect(guestPostIds).toContain(publicPost.id);
    expect(guestPostIds).not.toContain(privatePost.id);

    // 4. Logged-in non-member (visitorUser) can Like and Save the public post!
    const likeRes = await toggleReaction(visitorUser.id, publicCircle.id, publicPost.id, 'like');
    expect(likeRes.active).toBe(true);
    expect(likeRes.reactionCount).toBe(1);

    const saveRes = await saveItem(visitorUser.id, publicCircle.id, publicPost.id);
    expect(saveRes.saved).toBe(true);

    // 5. Logged-in non-member CANNOT comment until joining the Circle
    await expect(
      createComment(visitorUser.id, {
        circleId: publicCircle.id,
        postId: publicPost.id,
        body: 'Trying to comment before joining',
      })
    ).rejects.toThrow();

    // 6. After 1-click joining the public Circle, visitorUser CAN comment inline!
    await joinPublicCircle(visitorUser.id, publicCircle.id);
    const comment = await createComment(visitorUser.id, {
      circleId: publicCircle.id,
      postId: publicPost.id,
      body: 'Awesome benchmarks! Glad to join.',
    });
    expect(comment.body).toBe('Awesome benchmarks! Glad to join.');
  });
});
