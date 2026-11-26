import { Workspace } from "@/features/demos/document-intelligence/ui/Workspace";

type Tab = "ask" | "fields" | "checks";

export default async function DocPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const initial: Tab = tab === "fields" || tab === "checks" ? tab : "ask";
  return <Workspace id={id} initialTab={initial} />;
}
