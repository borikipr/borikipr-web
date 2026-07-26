export default function AdminFooter() {
  return (
    <footer className="border-t border-[#d9d9d9] bg-white/70 px-4 py-4 text-center text-xs text-[#6b7280] md:px-6">
      <p>
        Borikí Admin · Uso interno · © {new Date().getFullYear()} Erickson Real Estate
      </p>
    </footer>
  );
}
