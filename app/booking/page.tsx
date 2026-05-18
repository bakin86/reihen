import { redirect } from "next/navigation";

export default function BookingRedirect({
  searchParams,
}: {
  searchParams?: { center?: string };
}) {
  if (searchParams?.center) {
    redirect(`/centers/${encodeURIComponent(searchParams.center)}#seats-section`);
  }

  redirect("/#centers");
}
