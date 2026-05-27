import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

import { getUserProfileServer } from "@/entities/user/api/user-api.server";
import { userKeys } from "@/features/user/api/use-my-profile";
import { UserDashboardHeader } from "@/widgets/user";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}

export default async function UserLayout({ children, params }: LayoutProps) {
  const { userId } = await params;

  // [demo-mock] Resolve "me" to a numeric id from the cookie if middleware
  // didn't rewrite the URL (defense in depth — the proxy middleware should
  // handle this, but client navigations or edge cases sometimes don't).
  if (userId === "me") {
    const cookieStore = await cookies();
    const myId = cookieStore.get("userId")?.value;
    if (myId) {
      redirect(`/users/${myId}`);
    }
    redirect("/auth/login");
  }

  const targetUserId = Number(userId);

  if (Number.isNaN(targetUserId)) {
    notFound();
  }

  const queryClient = new QueryClient();

  const profile = await getUserProfileServer(targetUserId);

  if (!profile) notFound();

  await queryClient.setQueryData(userKeys.profile(targetUserId), profile);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <main className="bg-background mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center gap-4 px-4 py-6 2xl:px-0">
        <UserDashboardHeader targetUserId={targetUserId} initialData={profile} />
        <div className="w-full">{children}</div>
      </main>
    </HydrationBoundary>
  );
}
