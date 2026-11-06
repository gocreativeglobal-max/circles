import { describe, expect, it } from 'vitest';
import { registerUser } from '@/features/auth/service';
import { createCircle } from '@/features/circles/service';
import { joinPublicCircle } from '@/features/memberships/service';
import { updateCircleCapability } from '@/features/capabilities/service';
import { createPost, getPostWithComments, listCirclePosts } from '@/features/discussions/service';
import { castPollVote, getCirclePoll } from '@/features/polls/service';

describe('Polls in Discussions (WhatsApp & Telegram Style Inline Polls)', () => {
  it('Creates a post with an embedded poll, enriches it in discussion feeds, allows voting, and updates real-time counts', async () => {
    const suffix = Date.now();
    const { user: owner } = await registerUser({
      email: `poll-author-${suffix}@example.com`,
      username: `poll_author_${suffix}`,
      displayName: 'Discussion Poll Author',
      password: 'Password123!',
    });

    const { user: voter1 } = await registerUser({
      email: `poll-voter1-${suffix}@example.com`,
      username: `poll_voter1_${suffix}`,
      displayName: 'Voter One',
      password: 'Password123!',
    });

    const { user: voter2 } = await registerUser({
      email: `poll-voter2-${suffix}@example.com`,
      username: `poll_voter2_${suffix}`,
      displayName: 'Voter Two',
      password: 'Password123!',
    });

    // Create Circle and enable discussions + polls_decisions
    const circle = await createCircle(owner.id, {
      name: `Discussion Polls Circle ${suffix}`,
      visibility: 'public',
      membershipPolicy: 'open',
      category: 'general',
    });

    await joinPublicCircle(voter1.id, circle.id);
    await joinPublicCircle(voter2.id, circle.id);

    await updateCircleCapability(owner.id, circle.id, 'polls_decisions', true);

    // 1. Create a post with an inline poll (single choice, results visible after vote)
    const postWithPoll = await createPost(owner.id, {
      circleId: circle.id,
      title: 'Sprint Planning 2026',
      body: 'Please vote on our upcoming release priority before Friday.',
      poll: {
        question: 'What feature should we prioritize for v2.0?',
        options: ['Mobile App Support', 'AI Summarization', 'Custom Domain Branding'],
        allowMultiple: false,
        resultsVisibility: 'after_vote',
      },
    });

    expect(postWithPoll.id).toBeDefined();
    expect(postWithPoll.poll_id).toBeDefined();
    expect(postWithPoll.poll).toBeDefined();
    expect(postWithPoll.poll?.question).toBe('What feature should we prioritize for v2.0?');
    expect(postWithPoll.poll?.options).toHaveLength(3);
    expect(postWithPoll.poll?.total_votes).toBe(0);

    const mobileOption = postWithPoll.poll!.options.find((o) => o.label === 'Mobile App Support')!;
    const aiOption = postWithPoll.poll!.options.find((o) => o.label === 'AI Summarization')!;
    expect(mobileOption).toBeDefined();
    expect(aiOption).toBeDefined();

    // 2. Before voting: voter1 lists discussion posts -> results_visible_to_viewer is false
    const postsForVoter1 = await listCirclePosts(voter1.id, circle.id);
    const listedPost = postsForVoter1.find((p) => p.id === postWithPoll.id);
    expect(listedPost).toBeDefined();
    expect(listedPost?.poll).toBeDefined();
    expect(listedPost?.poll?.results_visible_to_viewer).toBe(false);
    expect(listedPost?.poll?.options[0].vote_count).toBeNull();
    expect(listedPost?.poll?.options[0].percentage).toBeNull();

    // 3. Voter 1 votes for Mobile App Support
    const pollAfterVote1 = await castPollVote(voter1.id, circle.id, postWithPoll.poll!.id, {
      optionIds: [mobileOption.id],
    });
    expect(pollAfterVote1.total_votes).toBe(1);
    expect(pollAfterVote1.results_visible_to_viewer).toBe(true);

    const voter1MobileOpt = pollAfterVote1.options.find((o) => o.id === mobileOption.id);
    expect(voter1MobileOpt?.vote_count).toBe(1);
    expect(voter1MobileOpt?.percentage).toBe(100);
    expect(voter1MobileOpt?.viewer_voted).toBe(true);

    // 4. Voter 2 votes for AI Summarization
    const pollAfterVote2 = await castPollVote(voter2.id, circle.id, postWithPoll.poll!.id, {
      optionIds: [aiOption.id],
    });
    expect(pollAfterVote2.total_votes).toBe(2);

    // 5. Fetch post with comments for Voter 1 -> both votes reflected, 50% / 50% split
    const postDetail = await getPostWithComments(voter1.id, circle.id, postWithPoll.id);
    expect(postDetail.post.poll).toBeDefined();
    expect(postDetail.post.poll?.total_votes).toBe(2);

    const detailMobileOpt = postDetail.post.poll?.options.find((o) => o.id === mobileOption.id);
    const detailAiOpt = postDetail.post.poll?.options.find((o) => o.id === aiOption.id);
    expect(detailMobileOpt?.vote_count).toBe(1);
    expect(detailMobileOpt?.percentage).toBe(50);
    expect(detailMobileOpt?.viewer_voted).toBe(true); // voter 1 voted for mobile
    expect(detailAiOpt?.vote_count).toBe(1);
    expect(detailAiOpt?.percentage).toBe(50);
    expect(detailAiOpt?.viewer_voted).toBe(false);

    // 6. Direct poll item check verifies bidirectional linkage
    const directPoll = await getCirclePoll(owner.id, circle.id, postWithPoll.poll!.id);
    expect(directPoll.post_id).toBe(postWithPoll.id);
  });
});
