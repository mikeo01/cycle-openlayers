import { adapt } from '@cycle/run/lib/adapt';
import { Feature, Map, Overlay, View } from "ol";
import { Control, defaults as defaultControls } from 'ol/control.js';
import Stream from "xstream";
import OSM from "ol/source/OSM";
import TileLayer from "ol/layer/Tile";
import VectorSource from "ol/source/Vector";
import { circular } from "ol/geom/Polygon";
import Point from "ol/geom/Point";
import VectorLayer from 'ol/layer/Vector';
import Style from 'ol/style/Style';
import { Circle } from "ol/style.js";
import { compose, cond, equals, evolve, head, identity, isNil, juxt, map, not, reduce, values } from "ramda";
import Icon from 'ol/style/Icon';
import Text from 'ol/style/Text';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
const { createWithMemory } = Stream;
// Type guards
const isView = (sink) => sink.action === "view";
const isTrackLocation = (sink) => sink.action === "track-location";
const isAddFeature = (sink) => sink.action === "add-feature";
const isRemoveFeature = (sink) => sink.action === "remove-feature";
const isRemoveAllFeatures = (sink) => sink.action === "remove-all-features";
const isShowOverlay = (sink) => sink.action === "show-overlay";
const isHideOverlay = (sink) => sink.action === "hide-overlay";
const makeControls = (elements) => {
    return elements
        .map(element => document.querySelector(element))
        .filter(element => !!element)
        .map(element => {
        return new (class extends Control {
            constructor(element) {
                super({ element });
            }
        })(element);
    });
};
const clear = (source) => source.clear();
const view = new View({
    center: [0, 0],
    zoom: 0
});
const point = new Point([0, 0]);
const isCircle = (t) => t === "circle";
const isIcon = (t) => t === "icon";
const imageType = (t) => isCircle(t) ? Circle :
    isIcon(t) ? Icon :
        Icon;
const evolveStyles = map(compose(d => new Style(d), evolve({
    image: d => new (imageType(d.type))(evolve({
        src: identity,
        radius: identity,
        stroke: d => new Stroke(d),
        fill: d => new Fill(d)
    })),
    text: d => new Text(evolve({
        text: identity,
        font: identity,
        textBaseline: identity,
        fill: d => new Fill(d),
        stroke: d => new Stroke(d)
    }, d))
})));
const makeLayer = evolve({
    vector: d => new VectorLayer(evolve({
        source: cond([
            [equals("vector-source"), _ => new VectorSource]
        ]),
        style: evolveStyles
    }, d))
});
const makeFeature = (options) => {
    const f = new Feature({
        geometry: new Point(options.geometry),
        attributes: options.attributes,
    });
    if (options.styles) {
        f.setStyle(evolveStyles(options.styles));
    }
    return f;
};
export const olSink = (options, sinks$, proxy$) => {
    var _a, _b, _c;
    // Layer, overlay & feature streams
    const layers$ = reduce((acc, [name, data]) => (Object.assign(Object.assign({}, acc), { [name]: createWithMemory() })), {}, ((_a = options.layers) !== null && _a !== void 0 ? _a : []));
    const layers = map(([name, data]) => {
        var _a;
        const feature = head(values(makeLayer(data)));
        if (!feature)
            return;
        (_a = layers$[name]) === null || _a === void 0 ? void 0 : _a.shamefullySendNext(feature);
        return feature;
    }, ((_b = options.layers) !== null && _b !== void 0 ? _b : []));
    let overlays = [];
    const overlays$ = reduce((acc, sel) => (Object.assign(Object.assign({}, acc), { [sel]: createWithMemory() })), {}, ((_c = options.overlays) !== null && _c !== void 0 ? _c : []));
    const listener = (proxy$, sources, map) => {
        return {
            next: (sink) => {
                var _a, _b, _c;
                if (isView(sink)) {
                    point.setCoordinates(sink.data.coordinates);
                    view.fit(point, { minResolution: 15 });
                }
                if (isTrackLocation(sink)) {
                    sink.data.coordinates$.subscribe({
                        next: ([longitude, latitude, accuracy]) => {
                            clear(sources.locationDot);
                            sources.locationDot.addFeature(new Feature(point));
                            sources.locationDot.addFeature(new Feature(circular([longitude, latitude], accuracy)
                                .transform("EPSG:4326", map.getView().getProjection())));
                            point.setCoordinates([longitude, latitude]);
                        }
                    });
                }
                if (isAddFeature(sink)) {
                    (_a = sink.data.layer.getSource()) === null || _a === void 0 ? void 0 : _a.addFeature(sink.data.feature);
                }
                if (isRemoveFeature(sink)) {
                    (_b = sink.data.layer.getSource()) === null || _b === void 0 ? void 0 : _b.removeFeature(sink.data.feature);
                }
                if (isRemoveAllFeatures(sink)) {
                    (_c = sink.data.layer.getSource()) === null || _c === void 0 ? void 0 : _c.clear();
                }
                if (isShowOverlay(sink)) {
                    sink.data.overlay.setPosition(sink.data.coordinates);
                }
                if (isHideOverlay(sink)) {
                    sink.data.overlay.setPosition(undefined);
                }
            }
        };
    };
    const observer = new MutationObserver(_ => {
        var _a, _b;
        ((_a = options.overlays) !== null && _a !== void 0 ? _a : [])
            .map((sel) => [sel, document.querySelector(sel)])
            .filter(([_, element]) => not(isNil(element)))
            .forEach(([sel, element]) => {
            const overlay = new Overlay({
                element: element,
                autoPan: { animation: { duration: 250 } }
            });
            overlays = overlays.concat(overlay);
            overlays$[sel].shamefullySendNext(overlay);
        });
        const mapEl = document.querySelector(options.target);
        if (mapEl) {
            const sources = {
                locationDot: new VectorSource
            };
            const map = new Map({
                target: mapEl,
                controls: defaultControls().extend(makeControls((_b = options.controlElements) !== null && _b !== void 0 ? _b : [])),
                layers: [
                    new TileLayer({ source: new OSM }),
                    new VectorLayer({ source: sources.locationDot }),
                    ...layers,
                ],
                overlays: [
                    ...overlays
                ],
                view
            });
            const notifyIfFeatureAtLocation = (event) => {
                // Fire off that a feature has been detected
                if (map.hasFeatureAtPixel(event.pixel)) {
                    proxy$.shamefullySendNext({ sel: "feature-at-pixel", data: head(map.getFeaturesAtPixel(event.pixel)) });
                }
                else {
                    proxy$.shamefullySendNext({ sel: "feature-at-pixel", data: null });
                }
            };
            map.on("singleclick", juxt([
                event => proxy$.shamefullySendNext({ sel: "singleclick", data: event }),
                notifyIfFeatureAtLocation
            ]));
            map.on("dblclick", juxt([
                event => proxy$.shamefullySendNext({ sel: "dblclick", data: event }),
                notifyIfFeatureAtLocation
            ]));
            map.on("loadend", event => proxy$.shamefullySendNext({ sel: "loadend", data: event }));
            sinks$
                .filter(({ action }) => {
                var _a;
                switch (action) {
                    case "track-location": return (_a = options.showLocationDot) !== null && _a !== void 0 ? _a : true;
                    default: return true;
                }
            })
                .subscribe(listener(proxy$, sources, map));
            observer.disconnect();
        }
    });
    observer.observe(document, { childList: true, subtree: true });
    return { layers$, overlays$ };
};
export const makeOlDriver = (options) => (sinks$) => {
    const proxy$ = adapt(createWithMemory());
    const { layers$, overlays$ } = olSink(options, sinks$, proxy$);
    return {
        get: (sel) => proxy$.filter(sink => sink.sel === sel),
        features: {
            getAll: (sel) => layers$[sel].map(l => { var _a; return (_a = l.getSource()) === null || _a === void 0 ? void 0 : _a.getFeatures(); }),
            create: makeFeature
        },
        layers: {
            get: (sel) => layers$[sel]
        },
        overlays: {
            get: (sel) => overlays$[sel]
        }
    };
};
