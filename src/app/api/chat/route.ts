import { runChatPost, type ChatPostBody } from "@/src/lib/chat/run-chat-post";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as ChatPostBody;
  return runChatPost(body);
}
