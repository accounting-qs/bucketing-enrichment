import { redirect } from "next/navigation";

// Redirect the old SPA page to the new dashboard
export default function OldHomePage() {
  redirect("/");
}
