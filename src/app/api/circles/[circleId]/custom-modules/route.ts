import { NextRequest, NextResponse } from 'next/server';
import {
  createCircleCustomModule,
  createCustomModuleEntry,
  generateCustomModuleFromPrompt,
  getCustomModuleWithEntries,
  interactWithCustomModuleEntry,
  listCircleCustomModules,
  updateCircleCustomModule,
} from '@/features/custom-modules/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');

    if (slug) {
      const data = await getCustomModuleWithEntries(
        user?.id ?? null,
        params.circleId,
        slug
      );
      return NextResponse.json(data);
    }

    const data = await listCircleCustomModules(user?.id ?? null, params.circleId);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const body = await req.json();

    if (body.action === 'generate_from_prompt') {
      const preset = generateCustomModuleFromPrompt(String(body.prompt || ''));
      return NextResponse.json({ preset });
    }

    if (!user) throw new UnauthorizedError();

    if (body.action === 'create_module') {
      const mod = await createCircleCustomModule(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ module: mod }, { status: 201 });
    }

    if (body.action === 'create_entry') {
      if (!body.moduleId) throw new ValidationError('moduleId is required.');
      const entry = await createCustomModuleEntry(
        user.id,
        params.circleId,
        String(body.moduleId),
        {
          title: body.title,
          body: body.body,
          imageUrl: body.imageUrl,
          boardStatus: body.boardStatus,
          fieldValues: body.fieldValues,
          priceAmount: body.priceAmount,
          currency: body.currency,
        }
      );
      return NextResponse.json({ entry }, { status: 201 });
    }

    if (body.action === 'interact_entry') {
      if (!body.entryId) throw new ValidationError('entryId is required.');
      const entry = await interactWithCustomModuleEntry(
        user.id,
        params.circleId,
        String(body.entryId),
        {
          action: body.interactionType || 'toggle_upvote',
          boardStatus: body.boardStatus,
          amount: body.amount,
          paymentMethod: body.paymentMethod,
        }
      );
      return NextResponse.json({ entry });
    }

    throw new ValidationError('Unsupported custom-modules action.');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();
    const body = await req.json();

    if (!body.moduleId) throw new ValidationError('moduleId is required.');

    const updated = await updateCircleCustomModule(
      user.id,
      params.circleId,
      String(body.moduleId),
      body
    );
    return NextResponse.json({ module: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
