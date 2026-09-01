import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import { appendTrackerScript, getTrackFunction } from "../src/utils";

const eventNames = ["buy", "view"] as const;

describe("getTrackFunction", function () {
  let track: Mock;

  const reportedPayload = function (url = "/url-known-to-umami") {
    const [callback] = track.mock.lastCall as [
      (parameters: { url: string }) => Record<string, unknown>,
    ];
    return callback({ url });
  };

  beforeEach(function stubTracker() {
    track = vi.fn();
    Object.assign(window, { umami: { identify: vi.fn(), track } });
  });

  afterEach(function removeTracker() {
    Reflect.deleteProperty(window, "umami");
  });

  it("sends a page view when called without arguments", function () {
    getTrackFunction(eventNames)();

    expect(track).toHaveBeenCalledOnce();
    expect(reportedPayload().url).toBe("/url-known-to-umami");
    expect(reportedPayload().name).toBeUndefined();
  });

  it("processes the pathname instead of the url known to umami", function () {
    getTrackFunction(eventNames, {
      getPathname: () => "/en/tunnel",
      processUrl: (url) => url.replace("/en", ""),
    })();

    expect(reportedPayload().url).toBe("/tunnel");
  });

  it("reads the pathname when the event fires, not when track is built", function () {
    const getPathname = vi.fn(() => "/en/tunnel");

    const trackEvent = getTrackFunction(eventNames, {
      getPathname,
      processUrl: (url) => url,
    });
    expect(getPathname).not.toHaveBeenCalled();

    trackEvent();
    reportedPayload();
    expect(getPathname).toHaveBeenCalledOnce();
  });

  it("ignores the pathname when there is no processUrl", function () {
    const getPathname = vi.fn(() => "/en/tunnel");

    getTrackFunction(eventNames, { getPathname })();

    expect(reportedPayload().url).toBe("/url-known-to-umami");
    expect(getPathname).not.toHaveBeenCalled();
  });

  it("sends a named event with its data", function () {
    getTrackFunction(eventNames)("buy", { amountItems: 3 });

    expect(reportedPayload().name).toBe("buy");
    expect(reportedPayload().data).toStrictEqual({ amountItems: 3 });
  });

  it("rejects an event outside the declared list", async function () {
    // Types already forbid this, so reaching the runtime guard needs a cast.
    const trackEvent = getTrackFunction(eventNames) as (
      eventName: string,
    ) => Promise<string>;

    await expect(trackEvent("unknown")).rejects.toBe(
      "Event unknown not supported",
    );
  });

  it("throws when a custom payload has no website", function () {
    const trackEvent = getTrackFunction(eventNames) as (
      customPayload: Record<string, unknown>,
    ) => void;

    expect(() => trackEvent({ name: "buy" })).toThrow(
      "Custom payload must include a string website",
    );
  });

  it("forwards a custom payload untouched", function () {
    const customPayload = { url: "/raw", website: "id" };

    getTrackFunction(eventNames, { processUrl: () => "/processed" })(
      customPayload,
    );

    expect(track).toHaveBeenCalledWith(customPayload);
  });
});

describe("appendTrackerScript", function () {
  const options = {
    autoTrack: false,
    onLoad: () => undefined,
    src: "https://umami.example/script.js",
    websiteId: "website-id",
  };

  const appendedScript = function () {
    const script = document.querySelector("script");
    if (!script) {
      throw new Error("no script was appended");
    }
    return script;
  };

  beforeEach(function resetDocument() {
    document.body.innerHTML = "";
    Reflect.deleteProperty(window, "umami");
  });

  it("appends the script umami reads its configuration from", function () {
    appendTrackerScript(options);

    const script = appendedScript();
    expect(script.async).toBe(true);
    expect(script.src).toBe(options.src);
    expect(script.dataset.autoTrack).toBe("false");
    expect(script.dataset.websiteId).toBe("website-id");
    expect(script.dataset.domains).toBeUndefined();
  });

  it("joins the domains it restricts the tracker to", function () {
    appendTrackerScript({ ...options, domains: "a.com,b.com" });

    expect(appendedScript().dataset.domains).toBe("a.com,b.com");
  });

  it("does not append the script twice", function () {
    appendTrackerScript(options);
    appendTrackerScript(options);

    expect(document.querySelectorAll("script")).toHaveLength(1);
  });

  it("reports the tracker as loaded once the script loads", function () {
    const onLoad = vi.fn();

    appendTrackerScript({ ...options, onLoad });
    expect(onLoad).not.toHaveBeenCalled();

    appendedScript().dispatchEvent(new Event("load"));
    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("reports a finished load to a later caller", function () {
    const onLoad = vi.fn();

    appendTrackerScript(options);
    // Deliberately no window.umami: a blocked or missing script still fires
    // load, and a later caller must not wait forever on an event that is gone.
    appendedScript().dispatchEvent(new Event("load"));
    appendTrackerScript({ ...options, onLoad });

    expect(onLoad).toHaveBeenCalledOnce();
  });

  it("does not append a second script when the website id changes", function () {
    appendTrackerScript({ ...options, websiteId: "one" });
    appendTrackerScript({ ...options, websiteId: "two" });

    expect(document.querySelectorAll("script")).toHaveLength(1);
    expect(appendedScript().dataset.websiteId).toBe("one");
  });

  it("accepts a website id that is not a valid selector", function () {
    expect(() =>
      appendTrackerScript({ ...options, websiteId: 'a"]b' }),
    ).not.toThrow();
  });

  it("stops listening once cleaned up", function () {
    const onLoad = vi.fn();

    const stopListening = appendTrackerScript({ ...options, onLoad });
    expect(stopListening).toBeDefined();
    stopListening?.();
    appendedScript().dispatchEvent(new Event("load"));

    expect(onLoad).not.toHaveBeenCalled();
  });
});
