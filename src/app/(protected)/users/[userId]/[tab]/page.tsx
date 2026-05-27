import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getUserProfileServer } from "@/entities/user/api/user-api.server";
import { UserTabContent } from "@/screens/user";

interface PageProps {
  params: Promise<{
    userId: string;
    tab: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { userId, tab } = await params;

  // [demo-mock] Same defense-in-depth as the parent layout: resolve "me"
  // from the cookie if the middleware didn't rewrite the URL.
  if (userId === "me") {
    const cookieStore = await cookies();
    const myId = cookieStore.get("userId")?.value;
    if (myId) {
      redirect(`/users/${myId}/${tab}`);
    }
    redirect("/auth/login");
  }

  const targetUserId = Number(userId);
  const profile = await getUserProfileServer(targetUserId);

  return <UserTabContent tabId={tab} targetUserId={targetUserId} initialData={profile} />;
}
