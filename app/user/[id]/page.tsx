import { Chingchanping } from "@/components/hogamping/app";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Chingchanping page="profile" userId={id} />;
}
