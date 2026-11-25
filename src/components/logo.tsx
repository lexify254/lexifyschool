import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link className={`brand${light ? " brand--light" : ""}`} href="/" aria-label="Lexify School home">
      <img className="brand__mark" src="/lexify-school-seal-transparent.png" alt="" width="49" height="49" />
    </Link>
  );
}
