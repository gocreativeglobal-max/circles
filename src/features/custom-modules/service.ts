import crypto from 'crypto';
import { z } from 'zod';
import { withRlsTransaction } from '@/lib/db/postgres';
import {
  CircleCustomModuleEntryItem,
  CircleCustomModuleItem,
  CircleRole,
  MembershipStatus,
} from '@/types/domain';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '@/lib/errors';
import {
  BUILT_IN_CUSTOM_FEATURE_TEMPLATES,
  CustomFeatureTemplatePreset,
  generateCustomModuleFromPrompt,
} from '@/features/custom-modules/presets';

export {
  BUILT_IN_CUSTOM_FEATURE_TEMPLATES,
  generateCustomModuleFromPrompt,
};
export type { CustomFeatureTemplatePreset };

export const customFieldSchema = z.object({
  key: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(80),
  type: z.enum(['text', 'textarea', 'select', 'url', 'date', 'number']).default('text'),
  required: z.boolean().optional().default(false),
  options: z.array(z.string().trim().min(1).max(80)).optional(),
});

export const createCustomModuleSchema = z.object({
  circleId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  slug: z.string().trim().max(64).optional(),
  description: z.string().trim().max(1000).default(''),
  icon: z.string().trim().min(1).max(40).default('sparkles'),
  layoutType: z.enum(['cards', 'wall', 'board', 'embed']).default('cards'),
  embedUrl: z.string().trim().max(2000).nullable().optional(),
  fieldsSchema: z.array(customFieldSchema).max(12).default([]),
  boardColumns: z
    .array(z.string().trim().min(1).max(40))
    .min(1)
    .max(6)
    .default(['Open', 'In Progress', 'Completed']),
  reactionLabel: z.string().trim().min(1).max(40).default('Upvote'),
  enablePayments: z.boolean().default(false),
  paymentLabel: z.string().trim().min(1).max(40).default('Support / Tip'),
  defaultCurrency: z.string().trim().min(3).max(4).default('USD'),
  postingPolicy: z.enum(['all_members', 'admins_only']).default('all_members'),
  isSharedTemplate: z.boolean().default(false),
});

export const updateCustomModuleSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(1000).optional(),
  icon: z.string().trim().min(1).max(40).optional(),
  layoutType: z.enum(['cards', 'wall', 'board', 'embed']).optional(),
  embedUrl: z.string().trim().max(2000).nullable().optional(),
  fieldsSchema: z.array(customFieldSchema).max(12).optional(),
  reactionLabel: z.string().trim().min(1).max(40).optional(),
  enablePayments: z.boolean().optional(),
  paymentLabel: z.string().trim().min(1).max(40).optional(),
  defaultCurrency: z.string().trim().min(3).max(4).optional(),
  postingPolicy: z.enum(['all_members', 'admins_only']).optional(),
  isSharedTemplate: z.boolean().optional(),
  status: z.enum(['pending_approval', 'active', 'archived']).optional(),
});

export const createCustomModuleEntrySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(8000).default(''),
  imageUrl: z.string().trim().max(2000).nullable().optional(),
  boardStatus: z.string().trim().max(40).default('Open'),
  fieldValues: z.record(z.union([z.string(), z.number(), z.null()])).default({}),
  priceAmount: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().min(3).max(4).optional(),
});

function slugifyModuleName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `feature-${Math.random().toString(36).slice(2, 7)}`;
}

export async function listCircleCustomModules(
  actorUserId: string | null,
  circleId: string
): Promise<{
  modules: CircleCustomModuleItem[];
  sharedTemplates: CustomFeatureTemplatePreset[];
}> {
  return withRlsTransaction(actorUserId, async (tx) => {
    let modules: CircleCustomModuleItem[] = [];
    try {
      const res = await tx.query<
        CircleCustomModuleItem & {
          creator_username: string;
          creator_display_name: string;
          creator_avatar_url: string | null;
          entry_count: number;
        }
      >(
        `SELECT m.*,
           COALESCE(u.username, 'member') AS creator_username,
           COALESCE(u.display_name, 'Member') AS creator_display_name,
           u.avatar_url AS creator_avatar_url,
           (SELECT COUNT(*)::int FROM public.circle_custom_module_entries e WHERE e.module_id = m.id) AS entry_count
         FROM public.circle_custom_modules m
         LEFT JOIN public.profiles u ON u.id = m.creator_id
         WHERE m.circle_id = $1
         ORDER BY m.created_at ASC;`,
        [circleId]
      );

      modules = res.rows.map((r) => ({
        ...r,
        fields_schema: Array.isArray(r.fields_schema) ? r.fields_schema : [],
        board_columns: Array.isArray(r.board_columns)
          ? r.board_columns
          : ['Open', 'In Progress', 'Completed'],
        entry_count: Number(r.entry_count ?? 0),
        creator: {
          id: r.creator_id,
          username: r.creator_username,
          display_name: r.creator_display_name,
          avatar_url: r.creator_avatar_url,
        },
      }));
    } catch {
      modules = [];
    }

    // Also include any user-shared templates from other circles
    const sharedTemplates = [...BUILT_IN_CUSTOM_FEATURE_TEMPLATES];
    try {
      const sharedRes = await tx.query<CircleCustomModuleItem>(
        `SELECT * FROM public.circle_custom_modules
         WHERE is_shared_template = true AND status = 'active'
         ORDER BY created_at DESC LIMIT 12;`
      );
      for (const s of sharedRes.rows) {
        if (!sharedTemplates.some((t) => t.name.toLowerCase() === s.name.toLowerCase())) {
          sharedTemplates.push({
            key: `shared-${s.id}`,
            name: s.name,
            description: s.description,
            icon: s.icon,
            layoutType: s.layout_type,
            reactionLabel: s.reaction_label,
            enablePayments: s.enable_payments,
            paymentLabel: s.payment_label,
            boardColumns: Array.isArray(s.board_columns)
              ? s.board_columns
              : ['Open', 'In Progress', 'Completed'],
            fieldsSchema: Array.isArray(s.fields_schema) ? s.fields_schema : [],
          });
        }
      }
    } catch {
      // Ignore if table not yet migrated
    }

    return { modules, sharedTemplates };
  });
}

export async function createCircleCustomModule(
  actorUserId: string,
  input: z.input<typeof createCustomModuleSchema>
): Promise<CircleCustomModuleItem> {
  const parsed = createCustomModuleSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [parsed.circleId, actorUserId]
    );
    const mem = memRes.rows[0];
    if (!mem || mem.status !== 'active') {
      throw new ForbiddenError('Only active Circle members can create or propose custom features.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(mem.role);
    const initialStatus = isStaff ? 'active' : 'pending_approval';

    let slug = parsed.slug ? slugifyModuleName(parsed.slug) : slugifyModuleName(parsed.name);
    const existingSlug = await tx.query<{ id: string }>(
      `SELECT id FROM public.circle_custom_modules WHERE circle_id = $1 AND slug = $2 LIMIT 1;`,
      [parsed.circleId, slug]
    );
    if (existingSlug.rows[0]) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const inserted = await tx.query<CircleCustomModuleItem>(
      `INSERT INTO public.circle_custom_modules (
         id, circle_id, creator_id, slug, name, description, icon,
         layout_type, embed_url, fields_schema, board_columns,
         reaction_label, enable_payments, payment_label, default_currency,
         posting_policy, is_shared_template, status
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9, $10::jsonb, $11::jsonb,
         $12, $13, $14, $15,
         $16, $17, $18
       ) RETURNING *;`,
      [
        crypto.randomUUID(),
        parsed.circleId,
        actorUserId,
        slug,
        parsed.name,
        parsed.description,
        parsed.icon,
        parsed.layoutType,
        parsed.embedUrl ?? null,
        JSON.stringify(parsed.fieldsSchema),
        JSON.stringify(parsed.boardColumns),
        parsed.reactionLabel,
        parsed.enablePayments,
        parsed.paymentLabel,
        parsed.defaultCurrency.toUpperCase(),
        parsed.postingPolicy,
        parsed.isSharedTemplate,
        initialStatus,
      ]
    );

    const row = inserted.rows[0];
    return {
      ...row,
      fields_schema: Array.isArray(row.fields_schema) ? row.fields_schema : [],
      board_columns: Array.isArray(row.board_columns)
        ? row.board_columns
        : ['Open', 'In Progress', 'Completed'],
      entry_count: 0,
    };
  });
}

export async function updateCircleCustomModule(
  actorUserId: string,
  circleId: string,
  moduleId: string,
  input: z.input<typeof updateCustomModuleSchema>
): Promise<CircleCustomModuleItem> {
  const parsed = updateCustomModuleSchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const modRes = await tx.query<CircleCustomModuleItem>(
      `SELECT * FROM public.circle_custom_modules WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [moduleId, circleId]
    );
    const mod = modRes.rows[0];
    if (!mod) throw new NotFoundError('Custom feature not found.');

    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const mem = memRes.rows[0];
    const isStaff =
      mem?.status === 'active' && ['owner', 'admin', 'moderator'].includes(mem.role);

    if (!isStaff && mod.creator_id !== actorUserId) {
      throw new ForbiddenError('You do not have permission to modify this custom feature.');
    }

    if (parsed.status === 'active' && mod.status === 'pending_approval' && !isStaff) {
      throw new ForbiddenError('Only Circle Admins can approve a proposed feature.');
    }

    const updated = await tx.query<CircleCustomModuleItem>(
      `UPDATE public.circle_custom_modules
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           icon = COALESCE($3, icon),
           layout_type = COALESCE($4, layout_type),
           embed_url = COALESCE($5, embed_url),
           fields_schema = COALESCE($6::jsonb, fields_schema),
           reaction_label = COALESCE($7, reaction_label),
           enable_payments = COALESCE($8, enable_payments),
           payment_label = COALESCE($9, payment_label),
           default_currency = COALESCE($10, default_currency),
           posting_policy = COALESCE($11, posting_policy),
           is_shared_template = COALESCE($12, is_shared_template),
           status = COALESCE($13, status),
           updated_at = NOW()
       WHERE id = $14 AND circle_id = $15
       RETURNING *;`,
      [
        parsed.name ?? null,
        parsed.description ?? null,
        parsed.icon ?? null,
        parsed.layoutType ?? null,
        parsed.embedUrl !== undefined ? parsed.embedUrl : null,
        parsed.fieldsSchema ? JSON.stringify(parsed.fieldsSchema) : null,
        parsed.reactionLabel ?? null,
        parsed.enablePayments ?? null,
        parsed.paymentLabel ?? null,
        parsed.defaultCurrency ? parsed.defaultCurrency.toUpperCase() : null,
        parsed.postingPolicy ?? null,
        parsed.isSharedTemplate ?? null,
        parsed.status ?? null,
        moduleId,
        circleId,
      ]
    );

    return updated.rows[0];
  });
}

export async function getCustomModuleWithEntries(
  actorUserId: string | null,
  circleId: string,
  moduleSlugOrId: string
): Promise<{
  module: CircleCustomModuleItem;
  entries: CircleCustomModuleEntryItem[];
}> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const modRes = await tx.query<CircleCustomModuleItem>(
      `SELECT * FROM public.circle_custom_modules
       WHERE circle_id = $1 AND (slug = $2 OR id::text = $2)
       LIMIT 1;`,
      [circleId, moduleSlugOrId]
    );
    const mod = modRes.rows[0];
    if (!mod) throw new NotFoundError('Custom feature not found.');

    const entriesRes = await tx.query<
      CircleCustomModuleEntryItem & {
        author_username: string;
        author_display_name: string;
        author_avatar_url: string | null;
      }
    >(
      `SELECT e.*,
         COALESCE(u.username, 'member') AS author_username,
         COALESCE(u.display_name, 'Member') AS author_display_name,
         u.avatar_url AS author_avatar_url
       FROM public.circle_custom_module_entries e
       LEFT JOIN public.profiles u ON u.id = e.author_id
       WHERE e.module_id = $1 AND e.circle_id = $2
       ORDER BY e.upvote_count DESC, e.created_at DESC;`,
      [mod.id, circleId]
    );

    const entries: CircleCustomModuleEntryItem[] = entriesRes.rows.map((r) => {
      const upvoters = Array.isArray(r.upvoter_ids) ? (r.upvoter_ids as string[]) : [];
      return {
        id: r.id,
        module_id: r.module_id,
        circle_id: r.circle_id,
        author_id: r.author_id,
        title: r.title,
        body: r.body,
        image_url: r.image_url,
        board_status: r.board_status,
        field_values:
          r.field_values && typeof r.field_values === 'object' ? r.field_values : {},
        price_amount: r.price_amount !== null ? Number(r.price_amount) : null,
        currency: r.currency,
        upvoter_ids: upvoters,
        upvote_count: Number(r.upvote_count ?? upvoters.length),
        tips_total: Number(r.tips_total ?? 0),
        created_at: r.created_at,
        updated_at: r.updated_at,
        author: {
          id: r.author_id,
          username: r.author_username,
          display_name: r.author_display_name,
          avatar_url: r.author_avatar_url,
        },
        viewer_has_upvoted: Boolean(actorUserId && upvoters.includes(actorUserId)),
      };
    });

    return {
      module: {
        ...mod,
        fields_schema: Array.isArray(mod.fields_schema) ? mod.fields_schema : [],
        board_columns: Array.isArray(mod.board_columns)
          ? mod.board_columns
          : ['Open', 'In Progress', 'Completed'],
      },
      entries,
    };
  });
}

export async function createCustomModuleEntry(
  actorUserId: string,
  circleId: string,
  moduleId: string,
  input: z.input<typeof createCustomModuleEntrySchema>
): Promise<CircleCustomModuleEntryItem> {
  const parsed = createCustomModuleEntrySchema.parse(input);

  return withRlsTransaction(actorUserId, async (tx) => {
    const modRes = await tx.query<CircleCustomModuleItem>(
      `SELECT * FROM public.circle_custom_modules WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [moduleId, circleId]
    );
    const mod = modRes.rows[0];
    if (!mod) throw new NotFoundError('Custom feature not found.');

    const memRes = await tx.query<{ role: CircleRole; status: MembershipStatus }>(
      `SELECT role, status FROM public.circle_memberships
       WHERE circle_id = $1 AND user_id = $2 LIMIT 1;`,
      [circleId, actorUserId]
    );
    const mem = memRes.rows[0];
    if (!mem || mem.status !== 'active') {
      throw new ForbiddenError('Join this Circle to add an entry.');
    }

    const isStaff = ['owner', 'admin', 'moderator'].includes(mem.role);
    if (mod.posting_policy === 'admins_only' && !isStaff) {
      throw new ForbiddenError('Only Circle Admins and Moderators can post in this feature.');
    }

    const defaultBoardStatus =
      Array.isArray(mod.board_columns) && mod.board_columns.length > 0
        ? String(mod.board_columns[0])
        : 'Open';

    const inserted = await tx.query<CircleCustomModuleEntryItem>(
      `INSERT INTO public.circle_custom_module_entries (
         id, module_id, circle_id, author_id, title, body, image_url,
         board_status, field_values, price_amount, currency
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
       RETURNING *;`,
      [
        crypto.randomUUID(),
        moduleId,
        circleId,
        actorUserId,
        parsed.title,
        parsed.body,
        parsed.imageUrl ?? null,
        parsed.boardStatus || defaultBoardStatus,
        JSON.stringify(parsed.fieldValues ?? {}),
        parsed.priceAmount ?? null,
        (parsed.currency || mod.default_currency || 'USD').toUpperCase(),
      ]
    );

    const userRes = await tx.query<{
      username: string;
      display_name: string;
      avatar_url: string | null;
    }>(`SELECT username, display_name, avatar_url FROM public.profiles WHERE id = $1 LIMIT 1;`, [
      actorUserId,
    ]);
    const u = userRes.rows[0];

    const row = inserted.rows[0];
    return {
      ...row,
      field_values:
        row.field_values && typeof row.field_values === 'object' ? row.field_values : {},
      price_amount: row.price_amount !== null ? Number(row.price_amount) : null,
      upvoter_ids: [],
      upvote_count: 0,
      tips_total: 0,
      author: {
        id: actorUserId,
        username: u?.username || 'member',
        display_name: u?.display_name || 'Member',
        avatar_url: u?.avatar_url ?? null,
      },
      viewer_has_upvoted: false,
    };
  });
}

export async function interactWithCustomModuleEntry(
  actorUserId: string,
  circleId: string,
  entryId: string,
  payload: {
    action: 'toggle_upvote' | 'update_board_status' | 'pay_or_tip';
    boardStatus?: string;
    amount?: number;
    paymentMethod?: 'card' | 'wallet' | 'bank_transfer';
  }
): Promise<CircleCustomModuleEntryItem> {
  return withRlsTransaction(actorUserId, async (tx) => {
    const entryRes = await tx.query<CircleCustomModuleEntryItem>(
      `SELECT * FROM public.circle_custom_module_entries WHERE id = $1 AND circle_id = $2 LIMIT 1;`,
      [entryId, circleId]
    );
    const entry = entryRes.rows[0];
    if (!entry) throw new NotFoundError('Entry not found.');

    if (payload.action === 'toggle_upvote') {
      const currentUpvoters = Array.isArray(entry.upvoter_ids)
        ? (entry.upvoter_ids as string[])
        : [];
      const hasUpvoted = currentUpvoters.includes(actorUserId);
      const nextUpvoters = hasUpvoted
        ? currentUpvoters.filter((id) => id !== actorUserId)
        : [...currentUpvoters, actorUserId];

      const updated = await tx.query<CircleCustomModuleEntryItem>(
        `UPDATE public.circle_custom_module_entries
         SET upvoter_ids = $1::jsonb,
             upvote_count = $2,
             updated_at = NOW()
         WHERE id = $3 AND circle_id = $4
         RETURNING *;`,
        [JSON.stringify(nextUpvoters), nextUpvoters.length, entryId, circleId]
      );
      return {
        ...updated.rows[0],
        upvoter_ids: nextUpvoters,
        upvote_count: nextUpvoters.length,
        tips_total: Number(updated.rows[0].tips_total ?? 0),
        viewer_has_upvoted: !hasUpvoted,
      };
    }

    if (payload.action === 'update_board_status') {
      if (!payload.boardStatus) throw new ConflictError('boardStatus is required.');
      const updated = await tx.query<CircleCustomModuleEntryItem>(
        `UPDATE public.circle_custom_module_entries
         SET board_status = $1,
             updated_at = NOW()
         WHERE id = $2 AND circle_id = $3
         RETURNING *;`,
        [payload.boardStatus, entryId, circleId]
      );
      return {
        ...updated.rows[0],
        upvote_count: Number(updated.rows[0].upvote_count ?? 0),
        tips_total: Number(updated.rows[0].tips_total ?? 0),
      };
    }

    if (payload.action === 'pay_or_tip') {
      const amt = Number(payload.amount ?? entry.price_amount ?? 0);
      if (!amt || amt <= 0) throw new ConflictError('Valid amount is required.');

      if (payload.paymentMethod === 'wallet') {
        const balRes = await tx.query<{ balance: string | number }>(
          `SELECT COALESCE(SUM(
             CASE WHEN tx_type IN ('deposit', 'sale_credit', 'refund') THEN amount
                  ELSE -amount END
           ), 0) AS balance
           FROM public.member_wallet_transactions
           WHERE circle_id = $1 AND user_id = $2 AND currency = $3 AND status = 'completed';`,
          [circleId, actorUserId, entry.currency]
        );
        const bal = Number(balRes.rows[0]?.balance ?? 0);
        if (bal < amt) {
          throw new ConflictError(
            `Insufficient ${entry.currency} wallet balance (${entry.currency} ${bal.toFixed(2)} available).`
          );
        }

        await tx.query(
          `INSERT INTO public.member_wallet_transactions (
             id, circle_id, user_id, tx_type, amount, currency, description, status
           ) VALUES ($1, $2, $3, 'purchase_debit', $4, $5, $6, 'completed');`,
          [
            crypto.randomUUID(),
            circleId,
            actorUserId,
            amt,
            entry.currency,
            `Payment / Tip on "${entry.title}"`,
          ]
        );
      }

      // Credit the entry creator's Member Wallet
      await tx.query(
        `INSERT INTO public.member_wallet_transactions (
           id, circle_id, user_id, tx_type, amount, currency, description, status
         ) VALUES ($1, $2, $3, 'sale_credit', $4, $5, $6, 'completed');`,
        [
          crypto.randomUUID(),
          circleId,
          entry.author_id,
          amt,
          entry.currency,
          `Received on "${entry.title}"`,
        ]
      );

      const updated = await tx.query<CircleCustomModuleEntryItem>(
        `UPDATE public.circle_custom_module_entries
         SET tips_total = COALESCE(tips_total, 0) + $1,
             updated_at = NOW()
         WHERE id = $2 AND circle_id = $3
         RETURNING *;`,
        [amt, entryId, circleId]
      );

      return {
        ...updated.rows[0],
        upvote_count: Number(updated.rows[0].upvote_count ?? 0),
        tips_total: Number(updated.rows[0].tips_total ?? 0),
      };
    }

    throw new ConflictError('Unsupported entry action.');
  });
}
