import "./nf.css";
import { NfNav } from "./Nav";
import { NfFooter } from "./Footer";

export function NfShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="nf-bg" aria-hidden="true"></div>
      <div className="nf-app">
        <NfNav />
        <main>{children}</main>
        <NfFooter />
      </div>
    </>
  );
}
