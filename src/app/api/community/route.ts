import {
  communityActionHttpStatus,
  loadCommunityState,
  performCommunityAction,
} from "@/lib/community/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const channelId = url.searchParams.get("channelId");
  const result = await loadCommunityState(channelId);
  const status =
    result.status === "unauthenticated"
      ? 401
      : result.status === "blocked"
        ? 403
        : result.status === "error"
          ? 503
          : 200;
  return Response.json(result, { status });
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json(
      {
        ok: false,
        status: "invalid",
        message: "A valid JSON request is required.",
      },
      { status: 400 }
    );
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Response.json(
      {
        ok: false,
        status: "invalid",
        message: "A valid community action is required.",
      },
      { status: 400 }
    );
  }
  const result = await performCommunityAction(input);
  return Response.json(result, { status: communityActionHttpStatus(result) });
}
