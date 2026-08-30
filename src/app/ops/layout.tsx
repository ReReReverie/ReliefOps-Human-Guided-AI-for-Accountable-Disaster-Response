import { OpsThemeBridge } from "@/components/OpsTheme";

const themeBootstrap = `(function(){try{var k="reliefops-ops-theme";var t=window.localStorage.getItem(k);if(t!=="emergency-light"&&t!=="emergency-dark"){t="emergency-light";}var r=document.getElementById("ops-root");if(r){r.setAttribute("data-theme",t);}document.documentElement.setAttribute("data-ops-theme",t);}catch(e){}})();`;

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="ops-root"
      data-theme="emergency-light"
      suppressHydrationWarning
      className="ops-theme-root"
    >
      <script id="ops-theme-bootstrap" dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      <OpsThemeBridge />
      {children}
    </div>
  );
}
