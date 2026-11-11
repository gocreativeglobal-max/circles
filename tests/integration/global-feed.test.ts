import { describe, expect, it } from 'vitest';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import { createComment, createPost, saveItem, toggleReaction } from '@/features/discussions/service';
import { createCourse } from '@/features/courses/service';
import { getCircleActivityStream } from '@/features/circles/activity-stream';
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

  it('Courses created within a circle appear in that circle newsfeed, and appear in the global newsfeed if the circle is public', async () => {
    const rand = Math.floor(Math.random() * 899999 + 100000);

    const { user: instructor } = await registerUser({
      email: `inst-${rand}@example.com`,
      username: `inst_${rand}`,
      displayName: 'Lead Instructor',
      password: 'Password123!',
    });

    const { user: privateInstructor } = await registerUser({
      email: `priv-inst-${rand}@example.com`,
      username: `priv_inst_${rand}`,
      displayName: 'Private Instructor',
      password: 'Password123!',
    });

    // 1. Create a public circle and enable learning_resources
    const publicCircle = await createCircle(instructor.id, {
      name: `Public Academy ${rand}`,
      visibility: 'public',
      membershipPolicy: 'open',
      category: 'learning',
    });
    await updateCircleCapability(instructor.id, publicCircle.id, 'learning_resources', true);

    // 2. Create a private circle and enable learning_resources
    const privateCircle = await createCircle(privateInstructor.id, {
      name: `Private Cohort ${rand}`,
      visibility: 'private',
      membershipPolicy: 'invite_only',
      category: 'learning',
    });
    await updateCircleCapability(privateInstructor.id, privateCircle.id, 'learning_resources', true);

    // 3. Create a published course in the public Circle
    const publicCourse = await createCourse(instructor.id, {
      circleId: publicCircle.id,
      title: 'Full-Stack Agentic AI Engineering',
      slug: `ai-eng-${rand}`,
      description: 'Master autonomous multi-agent systems and real-world architectures.',
      difficultyLevel: 'intermediate',
      estimatedDurationHours: 18,
      status: 'published',
    });

    // 4. Create a published course in the private Circle
    const privateCourse = await createCourse(privateInstructor.id, {
      circleId: privateCircle.id,
      title: 'Proprietary Executive Training',
      slug: `exec-${rand}`,
      description: 'Restricted boardroom curriculum.',
      difficultyLevel: 'advanced',
      estimatedDurationHours: 6,
      status: 'published',
    });

    // 5. Check "that circle newsfeed" (Circle Overview Activity Stream)
    const publicCircleStream = await getCircleActivityStream(instructor.id, publicCircle.id, [
      'learning_resources',
    ]);
    const publicStreamCourse = publicCircleStream.items.find(
      (item) => item.itemType === 'course' && item.data.id === publicCourse.id
    );
    expect(publicStreamCourse).toBeDefined();
    if (publicStreamCourse && publicStreamCourse.itemType === 'course') {
      expect(publicStreamCourse.data.title).toBe('Full-Stack Agentic AI Engineering');
    }
    expect(publicCircleStream.featuredCourses.map((c) => c.id)).toContain(publicCourse.id);

    // 6. Check "the entire circle newsfeed if it is a public circle" (Global Newsfeed)
    // Guest visitor sees public course in global feed
    const guestGlobalFeed = await getGlobalFeedData(null, { limit: 50 });
    const guestCourseIds = guestGlobalFeed.items
      .filter((i) => i.itemType === 'course')
      .map((i) => i.data.id);

    expect(guestCourseIds).toContain(publicCourse.id);
    expect(guestCourseIds).not.toContain(privateCourse.id);

    // Private circle member/owner CAN see their private circle course in their feed
    const privateMemberFeed = await getGlobalFeedData(privateInstructor.id, { limit: 50 });
    const privateMemberCourseIds = privateMemberFeed.items
      .filter((i) => i.itemType === 'course')
      .map((i) => i.data.id);

    expect(privateMemberCourseIds).toContain(privateCourse.id);
  });
});
