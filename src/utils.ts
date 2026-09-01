type CustomPayload = {
  website: string;
  [key: string]: unknown;
};

type TrackCallback = (props: {
  hostname: string;
  language: string;
  referrer: string;
  screen: string;
  title: string;
  url: string;
  website: string;
}) => { website: string; [key: string]: unknown };

type TrackingOptions = {
  getPathname?: () => string;
  processUrl?: (url: string) => string;
};

export const getTrackFunction = function <
  TEventNames extends readonly string[],
  TEventData extends Partial<
    Record<TEventNames[number], { [key: string]: unknown }>
  >,
>(eventNames: TEventNames, trackingOptions?: TrackingOptions) {
  // These definitions are based on https://www.npmjs.com/package/@types/umami
  // however, note that these are created with generics so we get intellisense on the events defined
  function track(): Promise<string> | undefined;
  function track<K extends TEventNames[number]>(
    // Here this is changed in relation to the original implementation, to add event type-checking!
    eventName: K,
    eventData?: K extends keyof TEventData
      ? TEventData[K]
      : { [key: string]: unknown },
  ): Promise<string> | undefined;
  function track(customPayload: CustomPayload): Promise<string> | undefined;
  function track(callback: TrackCallback): Promise<string> | undefined;

  // Function implementation
  function track(
    firstParameter?: TEventNames[number] | CustomPayload | TrackCallback,
    eventData?: TEventNames[number] extends keyof TEventData
      ? TEventData[TEventNames[number]]
      : { [key: string]: unknown },
  ): Promise<string> | undefined {
    if (firstParameter === undefined) {
      // This is a page view - call with no parameters
      return window.umami.track((parameters) => ({
        ...parameters,
        url: trackingOptions?.processUrl
          ? trackingOptions.processUrl(
              trackingOptions.getPathname?.() ?? parameters.url,
            )
          : parameters.url,
      }));
    }
    if (typeof firstParameter === "string") {
      const eventName = firstParameter;
      // here the first parameter is an eventName.
      if (!eventNames.includes(eventName)) {
        return Promise.reject(`Event ${eventName} not supported`);
      }
      return window.umami.track((parameters) => ({
        ...parameters,
        ...(!!eventData && { data: eventData }),
        name: eventName,
        url: trackingOptions?.processUrl
          ? trackingOptions.processUrl(
              trackingOptions.getPathname?.() ?? parameters.url,
            )
          : parameters.url,
      }));
    }
    if (typeof firstParameter === "object") {
      if (!("website" in firstParameter)) {
        throw new Error("Custom payload must include a string website");
      }
      if (typeof firstParameter.website !== "string") {
        throw new Error("Website must be a string");
      }
      const customPayload = firstParameter;
      // as this overrides the normal payload sent, and website is not sent by default,
      // we shouldn't use processUrl here
      return window.umami.track(customPayload);
    }
    if (typeof firstParameter === "function") {
      const callback = firstParameter;
      // as this overrides the normal payload sent, and website is not sent by default,
      // we shouldn't use processUrl here
      return window.umami.track(callback);
    }
    throw new Error("unsupported parameters");
  }
  return track;
};

type ScriptOptions = {
  autoTrack: boolean;
  domains?: string;
  onLoad: () => void;
  src: string;
  websiteId: string;
};

export const appendTrackerScript = function ({
  autoTrack,
  domains,
  onLoad,
  src,
  websiteId,
}: ScriptOptions) {
  // Keyed by src, like next/script was: effects run twice under StrictMode, and
  // a second provider must attach to the running script rather than start another.
  const existing = Array.from(document.scripts).find(
    (script) => script.getAttribute("src") === src,
  );
  if (existing) {
    if (existing.dataset.loaded) {
      onLoad();
      return undefined;
    }
    existing.addEventListener("load", onLoad);
    return () => existing.removeEventListener("load", onLoad);
  }

  const script = document.createElement("script");
  script.async = true;
  script.dataset.autoTrack = autoTrack.toString();
  script.dataset.websiteId = websiteId;
  if (domains) {
    script.dataset.domains = domains;
  }
  script.src = src;
  // Marked on the element, and never removed on cleanup, so a later caller can
  // tell a finished load from one still in flight even if the tracker itself
  // never installed (a blocked or missing script still fires load).
  script.addEventListener("load", function markLoaded() {
    script.dataset.loaded = "true";
  });
  script.addEventListener("load", onLoad);
  // The script is left in place on purpose: removing it would not unload the
  // tracker, and appending it again would run it twice.
  document.body.appendChild(script);
  return () => script.removeEventListener("load", onLoad);
};
