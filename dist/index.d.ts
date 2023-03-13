import { Overlay } from "ol";
import Stream from "xstream";
import VectorSource from "ol/source/Vector";
import VectorLayer from 'ol/layer/Vector';
import { Geometry } from 'ol/geom';
import { Options, OlSink, OlSource } from '../types';
export declare const olSink: (options: Options, sinks$: Stream<OlSink>, proxy$: Stream<OlSink>) => {
    layers$: Record<string, Stream<VectorLayer<VectorSource<Geometry>>>>;
    overlays$: Record<string, Stream<Overlay>>;
};
export declare const makeOlDriver: (options: Options) => (sinks$: Stream<OlSink>) => OlSource;
