import Sidebar from "@/components/Sidebar";
import ThemeProvider from "@/components/ThemeProvider";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
