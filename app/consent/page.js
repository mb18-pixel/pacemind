import ConsentDialog from "@/components/ConsentDialog";

export const metadata = {
  title: "Einwilligung – Ascend",
};

export default function ConsentPage() {
  return (
    <div className="animate-fade-up">
      <ConsentDialog />
    </div>
  );
}
