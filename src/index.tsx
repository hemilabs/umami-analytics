"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { appendTrackerScript, getTrackFunction } from "./utils";

type UmamiAnalyticsContextType = {
  autoTrack?: boolean;
  domains?: string[];
  loaded: boolean;
  processUrl?: (url: string) => string;
  src?: string;
  websiteId?: string;
};

type Props = Omit<UmamiAnalyticsContextType, "loaded"> & {
  children: ReactNode;
};

export const umamiAnalyticsContextFactory = function <
  TEventNames extends readonly string[],
  TEventData extends Partial<
    Record<TEventNames[number], { [key: string]: unknown }>
  >,
>(eventNames: TEventNames) {
  const UmamiAnalyticsContext = createContext<
    UmamiAnalyticsContextType | undefined
  >(undefined);

  const UmamiAnalyticsProvider = function ({
    autoTrack = true,
    children,
    src,
    websiteId,
    ...options
  }: Props) {
    const [loaded, setLoaded] = useState(false);
    const { domains } = options;
    const domainList =
      Array.isArray(domains) && domains.length > 0
        ? domains.join(",")
        : undefined;

    useEffect(
      function loadTracker() {
        if (!src || !websiteId) {
          return undefined;
        }
        return appendTrackerScript({
          autoTrack,
          domains: domainList,
          onLoad: () => setLoaded(true),
          src,
          websiteId,
        });
      },
      [autoTrack, domainList, src, websiteId],
    );

    return (
      <UmamiAnalyticsContext.Provider
        value={{ autoTrack, loaded, src, websiteId, ...options }}
      >
        {children}
      </UmamiAnalyticsContext.Provider>
    );
  };

  const useUmami = function () {
    const context = useContext(UmamiAnalyticsContext);
    const pathname = usePathname();
    if (!context) {
      throw new Error(
        "UmamiAnalyticsProvider must be used to access the context",
      );
    }
    const { autoTrack, loaded, processUrl } = context;
    return useMemo(
      () =>
        loaded
          ? {
              track: getTrackFunction<TEventNames, TEventData>(eventNames, {
                processUrl,
                // if autotrack is set to false (undefined defaults to true in umami), internal url is not updated
                // so we must do it ourselves! (that's why we send pathname)
                ...(autoTrack === false && { pathname }),
              }),
            }
          : {},
      [autoTrack, loaded, processUrl, pathname],
    );
  };

  return {
    UmamiAnalyticsContext,
    UmamiAnalyticsProvider,
    useUmami,
  };
};
