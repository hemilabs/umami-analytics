# umami-analytics

![NPM Version](https://img.shields.io/npm/v/umami-analytics)![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/hemilabs/umami-analytics/js-checks.yml?branch=main)

A simple type-safe integration between the [Umami Analytics](https://umami.is) API and React. The tracker script is appended when the provider mounts, so it works in any React application regardless of the framework or bundler.

## Installation

```sh
npm install umami-analytics
```

## Usage

```tsx
import { umamiAnalyticsContextFactory } from "umami-analytics";


The package exposes a `umamiAnalyticsContextFactory` function that accepts a list of events to track (with the possibility of typing the event data), and returns the Providers and hooks for you to use.

const events = ["buy", "cancel", "gift", "sell", "signup", "view"] as const;
const { UmamiAnalyticsContext, UmamiAnalyticsProvider, useUmami } =
  umamiAnalyticsContextFactory(eventNames);

// Then, at the root of your app:
<UmamiAnalyticsProvider
  autoTrack={false} // defaults to true
  src="script-url"
  websiteId="website-id-provided-by-umami"
>
  {children}
</UmamiAnalyticsProvider>;

// and in any component that can consume this context:
const { track } = useUmami();
// Tracks a pageView - only needed if autoTrack is set to false
track();
// track has type-safe autocompletion for the event names
track("view");
track("buy", {
  amountItems: 3,
  couponCode: "C2024",
  success: true,
});
```

## Advanced usage

Tracking events may require custom data associated to each event. The library allows to pass a generic TEventData type that allows to type the event data for each event. This way, the `track` function will be type-safe, and will autocomplete the event names and the event data.

```tsx
import { umamiAnalyticsContextFactory } from 'umami-analytics'

const events = ['buy', 'cancel', 'gift', 'sell', 'signup', 'view'] as const

type Events = typeof events
type Event = Events[number]

// add a custom type for each custom event data you want to add type-safe
type SignUpEventData = {
  receiveUpdates: boolean
}
type OperationsEventData = {
  amountItems: number
  success: boolean
  couponCode?: string
}

type SignUpEvents = Extract<Event, 'signup'>
type OperationsEvents = Extract<Event, 'buy' | 'cancel' | 'gift' | 'sell'>

type AllEventsWithData = OperationsEvents | SignUpEvents

// Map each type with the corresponding event data
type EventDataMap = {
  [K in AllEventsWithData]: K extends SignUpEvents
    ? SignUpEventData
    : K extends OperationsEvents
      ? OperationsEventData
      : // be flexible with untyped events
        { [key: string]: unknown }
}

// Generic types are optional, but type-safety for event data will be missing if not provided
const { UmamiAnalyticsContext, UmamiAnalyticsProvider, useUmami } =
  umamiAnalyticsContextFactory<EventDataMap, Events>(
    eventNames,
  )

  // As above, at the root of your app:
  <UmamiAnalyticsProvider
    autoTrack={false} // defaults to true
    processUrl={removeLocaleAndTrailingSlash}
    src="script-url"
    websiteId="website-id-provided-by-umami"
  >
    {children}
  </UmamiAnalyticsProvider>

  // and in any component that can consume this context:
  const { track } = useUmami()
  // track has type-safe autocompletion in both the event name and the data
  // The event data is optional, but if provided, it must match the type of the event
  track('buy', {
    amountItems: 3,
    couponCode: 'C2024',
    success: true
  })
  track('signup', {
    receiveUpdates: true
  })
```

## API

### umamiAnalyticsContextFactory(events, options?)

Returns an object with `UmamiAnalyticsContext`, `UmamiAnalyticsProvider`, `useUmami`.

#### events

Type: `string[]`

The array of events. For type-safety, it must be a [const assertion](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-4.html#const-assertions) array.

### UmamiAnalyticsProvider

The React provider. The tracker is appended once per `src`: changing any of the properties below after mount does not reconfigure a script that is already on the page.

It accepts the following properties:

#### autoTrack?

Type: `boolean`
Default: `true`

Whether to use the autotrack feature from Umami or not.

#### domains?

Type: `string[]`
Default: `undefined`

A list of domains in which the tracker will run.

The properties accepted are:

#### processUrl?

Type: `function`
Default: `undefined`

A function which receives the pathname and returns the processed URL. Useful for removing locale prefixes or trailing slashes.

#### src

Type: `string`

The URL of the script to load.

#### websiteId

Type: `string`

The umami website ID.

### UmamiAnalyticsContext

The React context. It must be read with [React's useContext](https://react.dev/reference/react/useContext). It reads all values given to the Provider, plus the value `loaded`

#### loaded

Type: `boolean`

Whether the script has been loaded or not.

### useUmami

A custom hook which returns an object with the property `track`, which is undefined until `loaded` is true in the context

#### track

Type: `function`

It uses the same API as [umami tracker functions](https://umami.is/docs/tracker-functions), but with the type-safety from the event names and event data.
