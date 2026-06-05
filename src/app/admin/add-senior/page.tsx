import { requireAdmin } from "@/lib/auth";
import SeniorForm from "@/components/SeniorForm";

export default async function AddSeniorPage() {
  await requireAdmin();
  return <SeniorForm mode="add" />;
}
