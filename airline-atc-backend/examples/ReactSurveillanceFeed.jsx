import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_ATC_BACKEND_URL || "http://localhost:3001";

/**
 * Minimal React example. Feed aircraft with latitude/longitude into your
 * map/globe component; keep your visual layer separate from this data hook.
 */
export function useSurveillanceFeed() {
  const [aircraft, setAircraft] = useState([]);
  const [status, setStatus] = useState({
    connected: false,
    lastSuccessAt: null,
    lastError: null
  });

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000
    });

    socket.on("connect", () => setStatus((s) => ({ ...s, connected: true })));
    socket.on("disconnect", () => setStatus((s) => ({ ...s, connected: false })));

    socket.on("surveillance:snapshot", (snapshot) => {
      setAircraft(snapshot.aircraft || []);
    });

    socket.on("surveillance:update", (update) => {
      setAircraft((current) => {
        const next = new Map(current.map((item) => [item.icao24, item]));
        for (const id of update.removed || []) next.delete(id);
        for (const item of update.aircraft || []) next.set(item.icao24, item);
        return [...next.values()].filter((item) => item.hasPosition);
      });
    });

    socket.on("surveillance:status", setStatus);

    return () => socket.disconnect();
  }, []);

  return { aircraft, status };
}

/**
 * Example ATC-style strip/list. Replace this with your radar scope, map,
 * selected-target panel, and flight strips.
 */
export function AircraftList() {
  const { aircraft, status } = useSurveillanceFeed();

  return (
    <section>
      <header>
        <strong>LIVE SURVEILLANCE</strong>
        <span>{status.connected ? " • SOCKET CONNECTED" : " • RECONNECTING"}</span>
        <span> • {aircraft.length} TARGETS</span>
      </header>

      <table>
        <thead>
          <tr>
            <th>CALLSIGN</th><th>ICAO24</th><th>ALT (FT)</th>
            <th>SPD (KT)</th><th>HDG</th><th>V/S (FPM)</th><th>SQUAWK</th>
          </tr>
        </thead>
        <tbody>
          {aircraft
            .slice()
            .sort((a, b) => (a.callsign || a.icao24).localeCompare(b.callsign || b.icao24))
            .map((a) => (
              <tr key={a.icao24}>
                <td>{a.callsign || "—"}</td>
                <td>{a.icao24.toUpperCase()}</td>
                <td>{a.baroAltitudeFt ?? "—"}</td>
                <td>{a.groundspeedKt ?? "—"}</td>
                <td>{a.headingDeg == null ? "—" : Math.round(a.headingDeg).toString().padStart(3, "0")}</td>
                <td>{a.verticalRateFpm ?? "—"}</td>
                <td>{a.squawk || "—"}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </section>
  );
}
