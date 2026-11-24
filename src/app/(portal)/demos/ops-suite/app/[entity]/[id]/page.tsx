import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDetail } from "@/features/demos/ops-suite/data/detail";
import { getEntityMeta } from "@/features/demos/ops-suite/entities";
import { PORTAL_BASE } from "@/features/demos/ops-suite/nav";
import { RecordPage } from "@/features/demos/ops-suite/ui/record/RecordPage";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ entity: string; id: string }> };

const load = async ({ params }: Props) => {
  const { entity, id } = await params;
  if (!getEntityMeta(entity) || !/^\d{1,9}$/.test(id)) return null;
  return getDetail(entity, Number(id));
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const d = await load(props).catch(() => null);
  return { title: d ? `${d.title} — Ops Suite` : "Ops Suite" };
}

export default async function RecordRoute(props: Props) {
  const { entity } = await props.params;
  const detail = await load(props);
  if (!detail) notFound();
  const meta = getEntityMeta(entity)!;
  return (
    <>
      <Link href={`${PORTAL_BASE}/${entity}`} className="ops-back-link">
        <ArrowLeft size={14} /> {meta.label}
      </Link>
      <RecordPage detail={detail} />
    </>
  );
}
