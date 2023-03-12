import type VectorSource from "ol/source/Vector";
import type VectorLayer from 'ol/layer/Vector';
import type { Feature, Map, MapBrowserEvent, Overlay, View } from "ol";
import type { Coordinate } from "ol/coordinate";
import type { Stream, MemoryStream } from "xstream";
import type { Geometry } from "ol/geom";

export interface TrackLocationAction extends OlSink {
  data: {
    coordinates$: Stream<Coordinate>
  }
}

export interface ViewAction extends OlSink {
  data: {
    coordinates: Coordinate
  }
}

export interface AddFeatureAction extends OlSink {
  data: {
    layer: VectorLayer<any>,
    feature: Feature
  }
}
export interface RemoveFeatureAction extends AddFeatureAction { }

export interface RemoveAllFeaturesAction extends OlSink {
  data: {
    layer: VectorLayer<any>
  }
}

export interface ShowOverlayAction extends OlSink {
  data: {
    overlay: Overlay
    coordinates: Coordinate
  }
}
export interface HideOverlay extends OlSink {
  data: {
    overlay: Overlay
  }
}

export type Action = "view" | "track-location" | "add-feature" | "remove-feature" | "remove-all-features" | "show-overlay" | "hide-overlay"
export interface OlSink {
  sel?: string
  action?: Action
  data: any
}

export interface OlSources {
  locationDot: VectorSource
}

export type Get = "singleclick" | "dblclick" | "feature-at-pixel" | "loadend"

type ImageOptionTypes = "circle" | "icon"
export interface ImageOptions {
  type?: ImageOptionTypes
  src?: string
  stroke?: {
    color: string
  }
  fill?: {
    color: string
  }
}

export interface TextOptions {
  text: string
  font: string
  textBaseline?: string
  fill?: {
    color: string
  }
  stroke?: {
    color: string
    width: number
  }
}
export interface StyleOptions {
  image?: ImageOptions
  text?: TextOptions
}
export interface DataLayerOptions {
  source: string
  style?: StyleOptions[]
}

export interface FeatureOptions {
  geometry: Coordinate
  attributes: any
  styles: StyleOptions[]
}

export interface Options {
  target: string

  /**
   * Denotes whether to show your current location as a "dot"
   * The coordinates for this should be derived from another driver and streamed into the action "track-location"
   */
  showLocationDot?: boolean

  /**
   * The element ids of the markup that will act as controls for the map
   * Internally, these elements will be passed to a control constructor
   * You simply need to handle the DOM events as usual since they'll be controlled by snabbdom
   */
  controlElements?: string[]

  /**
   * The element ids of the markup that will act as overlays for the map
   * Internally, these elements will be passed to an overlays constructor
   * 
   * @example
   * overlays: ["#my-popup"]
   * 
   * These overlays are then provided to you via the "overlays" selector
   * @example
   * Ol.overlays.get("#my-popup")
   */
  overlays?: string[]

  /**
   * A data-driven approach to layer generation.
   * Provide a tuple consisting of the layer and it's respective configuration
   * @example
   * layers: [
   *  ["my-layer", "vector", { style: { image: { src: "https://foo.com/bar.png" } } }]
   * ]
   * 
   * This is then provided to you via the "layers" selector
   * @example
   * Ol.layers.get("my-layer")
   */
  layers?: Array<[string, {
    "vector"?: DataLayerOptions
  }]>
}

export interface OlSource {
  get: (sel: Get) => MemoryStream<OlSink>
  features: {
    getAll: (sel: string) => Stream<Feature[] | undefined>
    create: (options: FeatureOptions) => Feature
  }
  layers: {
    get: (sel: string) => Stream<VectorLayer<VectorSource<Geometry>>>
  },
  overlays: {
    get: (sel: string) => Stream<Overlay>
  }
}