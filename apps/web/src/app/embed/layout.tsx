/** Bare layout for the iframe: no site header, no dashboard chrome. */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col">{children}</div>;
}
