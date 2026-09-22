import { Hogamping } from "@/components/hogamping/app";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Hogamping page="profile" userId={id} />;
}
