import { ClerkProvider } from "@clerk/nextjs";

/**
 * Photographer side. ClerkProvider lives here (not in the root) so client
 * booking pages on tenant subdomains never load Clerk's script.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      dynamic
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: "#c67139",
          colorBackground: "#f5ead8",
          colorForeground: "#201e1d",
          colorInput: "#f9f4ed",
          borderRadius: "16px",
          fontFamily: "var(--font-figtree), system-ui, sans-serif",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
