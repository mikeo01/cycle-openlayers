import type { AddFeatureAction, FeatureOptions, HideOverlay, ImageOptionTypes, OlSink, RemoveAllFeaturesAction, RemoveFeatureAction, ShowOverlayAction, TrackLocationAction, ViewAction, Options, OlSources, OlSource, Get } from "./makeOlDriver.d"
import { adapt } from '@cycle/run/lib/adapt';
import { Feature, Map, MapBrowserEvent, Overlay, View } from "ol";
import { Control, defaults as defaultControls } from 'ol/control.js';
import Stream, { MemoryStream } from "xstream";
import OSM from "ol/source/OSM"
import TileLayer from "ol/layer/Tile";
import VectorSource from "ol/source/Vector";
import TileSource from "ol/source/Tile";
import { circular } from "ol/geom/Polygon";
import Point from "ol/geom/Point";
import VectorLayer from 'ol/layer/Vector';
import Style from 'ol/style/Style';
import { Circle } from "ol/style.js"
import { compose, cond, equals, evolve, head, identity, isNil, juxt, map, not, reduce, T, values } from "ramda"
import Icon from 'ol/style/Icon';
import BaseLayer from 'ol/layer/Base';
import Text from 'ol/style/Text';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { Geometry } from 'ol/geom';

const { createWithMemory } = Stream;

// Type guards
const isView = (sink: OlSink): sink is ViewAction => sink.action === "view"
const isTrackLocation = (sink: OlSink): sink is TrackLocationAction => sink.action === "track-location"
const isAddFeature = (sink: OlSink): sink is AddFeatureAction => sink.action === "add-feature"
const isRemoveFeature = (sink: OlSink): sink is RemoveFeatureAction => sink.action === "remove-feature"
const isRemoveAllFeatures = (sink: OlSink): sink is RemoveAllFeaturesAction => sink.action === "remove-all-features"
const isShowOverlay = (sink: OlSink): sink is ShowOverlayAction => sink.action === "show-overlay"
const isHideOverlay = (sink: OlSink): sink is HideOverlay => sink.action === "hide-overlay"

const makeControls = (elements: string[]) => {
  return elements
    .map(element => document.querySelector(element))
    .filter(element => !!element)
    .map(element => {
      return new (class extends Control {
        constructor(element: HTMLElement) {
          super({ element })
        }
      })(element as HTMLElement);
    })
}

const clear = (source: VectorSource | TileSource) => source.clear()
const view = new View({
  center: [0, 0],
  zoom: 0
})
const point = new Point([0, 0])

const isCircle = (t: ImageOptionTypes): t is "circle" => equals("circle");
const isIcon = (t: ImageOptionTypes): t is "icon" => equals("icon");
const imageType = (t: ImageOptionTypes) =>
  isCircle(t) ? Circle :
  isIcon(t) ? Icon :
  Icon

const evolveStyles = map(
  compose(
    d => new Style(d as any),
    evolve({
      image: d =>  new (imageType(d.type))(
        evolve({
          src: identity,
          radius: identity,
          stroke: d => new Stroke(d),
          fill: d => new Fill(d)
        }) as any,
      ),
      text: d => new Text(evolve({
        text: identity,
        font: identity,
        textBaseline: identity,
        fill: d => new Fill(d),
        stroke: d => new Stroke(d)
      }, d))
    })
  )
)

const makeLayer = evolve({
  vector: d => new VectorLayer(evolve({
    source: cond([
      [equals("vector-source"), _ => new VectorSource]
    ]),
    style: evolveStyles
  }, d))
})
const makeFeature = (options: FeatureOptions) => {
  const f = new Feature({
    geometry: new Point(options.geometry),
    attributes: options.attributes,
  })
  
  if (options.styles) {
    f.setStyle(evolveStyles(options.styles))
  }

  return f
}

export const olSink = (options: Options, sinks$: Stream<OlSink>, proxy$: Stream<OlSink>) => {
  // Layer, overlay & feature streams
  const layers$: Record<string, Stream<VectorLayer<VectorSource<Geometry>>>> = reduce((acc, [name, data]) => ({
    ...acc,
    [name]: createWithMemory<BaseLayer>()
  }), {}, (options.layers ?? []))

  const layers = map(
    ([name, data]) => {
      const feature = head(values(makeLayer(data)))
      if (!feature) return;
      layers$[name]?.shamefullySendNext(feature)
      return feature;
    },
    (options.layers ?? [])
  )
  let overlays: Overlay[] = []
  const overlays$: Record<string, Stream<Overlay>> = reduce((acc, sel) => ({
    ...acc,
    [sel]: createWithMemory<Overlay>()
  }), {}, (options.overlays ?? []))

  const listener = (proxy$: Stream<OlSink>, sources: OlSources, map: Map) => {
    return {
      next: (sink: OlSink) => {
        if (isView(sink)) {
          point.setCoordinates(sink.data.coordinates)
          view.fit(point, { minResolution: 15 })
        }
        
        if (isTrackLocation(sink)) {
          sink.data.coordinates$.subscribe({
            next: ([longitude, latitude, accuracy]) => {
              clear(sources.locationDot)

              sources.locationDot.addFeature(new Feature(point))
              sources.locationDot.addFeature(new Feature(
                circular([longitude, latitude], accuracy)
                  .transform("EPSG:4326", map.getView().getProjection())
              ))
              point.setCoordinates([longitude, latitude])
            }
          })
        }

        if (isAddFeature(sink)) {
          sink.data.layer.getSource()?.addFeature(
            sink.data.feature
          )
        }

        if (isRemoveFeature(sink)) {
          sink.data.layer.getSource()?.removeFeature(
            sink.data.feature
          )
        }

        if (isRemoveAllFeatures(sink)) {
          sink.data.layer.getSource()?.clear()
        }

        if (isShowOverlay(sink)) {
          sink.data.overlay.setPosition(sink.data.coordinates)
        }

        if (isHideOverlay(sink)) {
          sink.data.overlay.setPosition(undefined)
        }
      }
    }
  }
  
  const observer = new MutationObserver(_ => {
    (options.overlays ?? [])
      .map((sel) => [sel, document.querySelector(sel)])
      .filter(([_, element ]) => not(isNil(element)))
      .forEach(([sel, element]) => {
        const overlay = new Overlay({
          element: element as HTMLElement,
          autoPan: { animation: { duration: 250 } }
        })
        overlays = overlays.concat(overlay)
        overlays$[sel as string].shamefullySendNext(overlay)
      })
    const mapEl = document.querySelector(options.target) as HTMLElement
    
    if (mapEl) {
      const sources: OlSources = {
        locationDot: new VectorSource
      };

      const map = new Map({
        target: mapEl,
        controls: defaultControls().extend(
          makeControls(options.controlElements ?? [])
        ),
        layers: [
          new TileLayer({ source: new OSM }),
          new VectorLayer({ source: sources.locationDot }),
          ...layers as VectorLayer<any>[],
        ],
        overlays: [
          ...overlays
        ],
        view
      })

      const notifyIfFeatureAtLocation = (event: MapBrowserEvent<any>) => {
        // Fire off that a feature has been detected
        if (map.hasFeatureAtPixel(event.pixel)) {
          proxy$.shamefullySendNext({ sel: "feature-at-pixel", data: head(map.getFeaturesAtPixel(event.pixel)) })
        } else {
          proxy$.shamefullySendNext({ sel: "feature-at-pixel", data: null })
        }
      }
      map.on("singleclick", juxt([
        event => proxy$.shamefullySendNext({sel: "singleclick", data: event }),
        notifyIfFeatureAtLocation
      ]))
      map.on("dblclick", juxt([
        event => proxy$.shamefullySendNext({sel: "dblclick", data: event }),
        notifyIfFeatureAtLocation
      ]))
      map.on("loadend", event => proxy$.shamefullySendNext({sel: "loadend", data: event }))

      sinks$
        .filter(({ action }) => {
          switch(action) {
            case "track-location": return options.showLocationDot ?? true;
            default: return true;
          }
        })
        .subscribe(listener(proxy$, sources, map))

      observer.disconnect();
    }
  });

  observer.observe(document, { childList: true, subtree: true });

  return { layers$, overlays$ }
}

export const makeOlDriver = (options: Options) => (sinks$: Stream<OlSink>): OlSource => {
  const proxy$: MemoryStream<OlSink> = adapt(createWithMemory());
  const { layers$, overlays$ } = olSink(options, sinks$, proxy$)

  return {
    get: (sel: Get) => proxy$.filter(sink => sink.sel === sel),
    features: {
      getAll: (sel: string) => layers$[sel].map(l => l.getSource()?.getFeatures()),
      create: makeFeature
    },
    layers: {
      get: (sel: string) => layers$[sel]
    },
    overlays: {
      get: (sel: string) => overlays$[sel]
    }
  }
}
