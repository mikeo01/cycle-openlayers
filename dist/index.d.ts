import { Overlay } from "ol";
import { Geometry } from 'ol/geom';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from "ol/source/Vector";
import Stream from "xstream";
import { OlSink, OlSource, Options } from '../types';
export declare const olSink: (options: Options, sinks$: Stream<OlSink>, proxy$: Stream<OlSink>) => {
    layers$: Record<string, Stream<VectorLayer<VectorSource<Geometry>>>>;
    overlays$: Record<string, Stream<Overlay>>;
};
export declare const makeOlDriver: (options: Options) => (sinks$: Stream<OlSink>) => OlSource;
