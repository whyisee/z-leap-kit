import { useCallback, useState } from "react";
import type { LocationInput } from "./api";

function finiteOrNull(value: number | null): number | null {
  return value !== null && Number.isFinite(value) ? value : null;
}

export function useLocationCapture() {
  const [location, setLocation] = useState<LocationInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator;

  const capture = useCallback(() => {
    if (!supported || busy) {
      setError("当前浏览器不支持定位");
      return;
    }

    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { coords } = position;
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyM: finiteOrNull(coords.accuracy),
          altitudeM: finiteOrNull(coords.altitude),
          altitudeAccuracyM: finiteOrNull(coords.altitudeAccuracy),
          headingDeg: finiteOrNull(coords.heading),
          speedMps: finiteOrNull(coords.speed),
          capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
          source: "browser_geolocation",
          label: null,
          defaultEventRole: "occurred_at",
          socialMatching: false,
        });
        setBusy(false);
      },
      (geolocationError) => {
        const message =
          geolocationError.code === geolocationError.PERMISSION_DENIED
            ? "没有获得定位权限，请在浏览器设置中允许后重试"
            : geolocationError.code === geolocationError.TIMEOUT
              ? "获取位置超时，请到开阔处后重试"
              : "暂时无法获取位置，请检查系统定位服务";
        setError(message);
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  }, [busy, supported]);

  const update = useCallback((patch: Partial<LocationInput>) => {
    setLocation((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const reset = useCallback(() => {
    setLocation(null);
    setError(null);
    setBusy(false);
  }, []);

  return { location, busy, error, supported, capture, update, reset };
}
