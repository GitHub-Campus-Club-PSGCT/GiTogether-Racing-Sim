// A full-screen layer whose glass card "lens-reveals" from its own centre:
// the card is clipped to a small rounded lens and grows to full size, while
// an optional blurred scrim fades in behind it. Closing reverses it, faster.
import { usePresence } from "./motion";

export default function GlassLayer({ open, scrim = true, align = "center", className = "", cardClassName = "", children, exitMs = 280 }) {
  const { mounted, state } = usePresence(open, exitMs);
  if (!mounted) return null;
  return (
    <div className={`lens-layer align-${align} ${className}`} data-state={state}>
      {scrim && <div className="lens-scrim" />}
      <div className={`lens-card ${cardClassName}`}>{children}</div>
    </div>
  );
}
