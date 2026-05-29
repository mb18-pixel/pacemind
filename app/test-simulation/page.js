import { notFound } from "next/navigation";
import TestSimulationClient from "@/components/TestSimulationClient";

export const dynamic = "force-dynamic";

export default function TestSimulationPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <TestSimulationClient />;
}

